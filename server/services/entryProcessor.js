import { Entry, Connection } from '../models/index.js';
import * as aiService from './aiService.js';
import { notifyUser } from './socketService.js';
import { findMatchesForEntry } from './passiveMatchingService.js';

const MATCH_THRESHOLD = 0.85;
const HIGH_CONFIDENCE_THRESHOLD = 0.92;
const RERANK_THRESHOLD = 0.75; // Rerank score threshold for auto-connections
const USE_VECTOR_SEARCH = process.env.USE_VECTOR_SEARCH === 'true';

// Process a journal entry with AI
export async function processEntry(entryId) {
  const entry = await Entry.findById(entryId);
  if (!entry) {
    throw new Error('Entry not found');
  }

  console.log(`Processing entry ${entryId}...`);

  // Run AI analysis in parallel
  const [sentiment, intent, themes] = await Promise.all([
    aiService.analyzeSentiment(entry.content),
    aiService.classifyIntent(entry.content),
    aiService.extractThemes(entry.content)
  ]);

  // Generate embedding only if discoverable
  let embedding = null;
  if (entry.isDiscoverable) {
    embedding = await aiService.generateEmbedding(entry.content);
  }

  // Update entry with AI analysis
  await Entry.findByIdAndUpdate(entryId, {
    sentiment,
    intentLabel: intent.label,
    intentConfidence: intent.confidence,
    themes,
    embedding,
    aiProcessed: true
  });

  console.log(`Entry ${entryId} processed: ${intent.label} (${intent.confidence})`);

  // Generate follow-up question if low confidence
  let followUpQuestion = null;
  if (intent.confidence < 0.6) {
    followUpQuestion = await aiService.generateFollowUp(entry.content, intent);
  }

  // Find matches if discoverable and has embedding
  if (entry.isDiscoverable && embedding) {
    // Use new passive matching service for comprehensive matching
    await findMatchesForEntry(entryId);
  }

  return { sentiment, intent, themes, followUpQuestion };
}

// MongoDB Atlas Vector Search - Production-ready semantic search
async function vectorSearchCandidates(embedding, targetIntent, userId, limit = 100) {
  if (!USE_VECTOR_SEARCH) {
    // Fallback to in-memory cosine similarity
    return null;
  }
  
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: 'embedding_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: limit * 2,
          limit: limit,
          filter: {
            $and: [
              { intentLabel: { $eq: targetIntent } },
              { isDiscoverable: { $eq: true } },
              { userId: { $ne: userId } },
              { aiProcessed: { $eq: true } }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          themes: 1,
          sentiment: 1,
          embedding: 1,
          content: 1,
          intentLabel: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];
    
    const results = await Entry.aggregate(pipeline);
    console.log(`Vector search found ${results.length} candidates for ${targetIntent}`);
    return results;
  } catch (error) {
    console.error('Vector search failed, falling back to in-memory:', error.message);
    return null;
  }
}

// Find semantic matches and create connections
async function findAndCreateMatches(entryId, intentLabel, embedding, userId, sourceEntry) {
  // Problem entries search for Solutions, Solutions search for Problems
  const targetIntent = intentLabel === 'Problem' ? 'Solution' : 
                       intentLabel === 'Solution' ? 'Problem' : null;

  if (!targetIntent) {
    // Reflections could match with other Reflections (future feature)
    return [];
  }

  // Try MongoDB Atlas Vector Search first
  let candidates = await vectorSearchCandidates(embedding, targetIntent, userId);
  let initialMatches;
  
  if (candidates && candidates.length > 0) {
    // Use vector search results (already sorted by score)
    initialMatches = candidates
      .filter(c => c.score >= MATCH_THRESHOLD)
      .map(c => ({
        candidate: c,
        similarity: c.score
      }))
      .slice(0, 50);
    console.log(`Vector search: ${initialMatches.length} matches above threshold`);
  } else {
    // Fallback: in-memory cosine similarity search
    const dbCandidates = await Entry.find({
      intentLabel: targetIntent,
      isDiscoverable: true,
      userId: { $ne: userId },
      embedding: { $ne: null },
      aiProcessed: true
    })
    .select('userId themes sentiment embedding content intentLabel')
    .limit(100);

    // Calculate cosine similarity
    initialMatches = dbCandidates
      .map(candidate => {
        const similarity = cosineSimilarity(embedding, candidate.embedding);
        return { candidate, similarity };
      })
      .filter(m => m.similarity >= MATCH_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 50);
  }

  console.log(`Found ${initialMatches.length} initial matches for entry ${entryId}`);

  // Apply cross-encoder reranking for Problem→Solution matches
  let rerankedMatches = initialMatches;
  if (intentLabel === 'Problem' && initialMatches.length > 0) {
    try {
      const candidatesForRerank = initialMatches.map(m => ({
        _id: m.candidate._id,
        content: m.candidate.content,
        themes: m.candidate.themes,
        sentiment: m.candidate.sentiment,
        similarity: m.similarity
      }));

      const reranked = await aiService.rerankMatches(sourceEntry, candidatesForRerank);
      
      if (reranked && reranked.length > 0) {
        // Merge rerank scores back
        rerankedMatches = reranked.map(r => {
          const original = initialMatches.find(m => 
            m.candidate._id.toString() === r._id.toString()
          );
          return {
            candidate: original?.candidate || r,
            similarity: original?.similarity || 0.5,
            rerankScore: r.rerankScore,
            combinedScore: r.combinedScore
          };
        }).sort((a, b) => b.combinedScore - a.combinedScore);
        
        console.log(`Reranked matches for entry ${entryId}:`, 
          rerankedMatches.slice(0, 3).map(m => ({
            score: m.combinedScore.toFixed(2),
            rerank: m.rerankScore?.toFixed(2)
          }))
        );
      }
    } catch (error) {
      console.error('Reranking failed, using similarity-only:', error.message);
    }
  }

  const matches = rerankedMatches.slice(0, 5);

  // Create connections for high-confidence matches
  const entry = await Entry.findById(entryId);
  
  for (const match of matches) {
    // Use combined score if available, otherwise similarity
    const effectiveScore = match.combinedScore || match.similarity;
    const rerankScore = match.rerankScore || null;
    
    // Only auto-connect if both similarity AND rerank are high enough
    const shouldAutoConnect = match.similarity >= HIGH_CONFIDENCE_THRESHOLD && 
                              (!rerankScore || rerankScore >= RERANK_THRESHOLD);
    
    if (shouldAutoConnect) {
      try {
        // Determine seeker vs sage
        const isProblem = intentLabel === 'Problem';
        
        // Check if connection already exists
        const existingConnection = await Connection.findOne({
          problemEntryId: isProblem ? entryId : match.candidate._id,
          solutionEntryId: isProblem ? match.candidate._id : entryId
        });

        if (existingConnection) continue;

        // Generate bridge message
        const problemEntry = isProblem ? entry : match.candidate;
        const solutionEntry = isProblem ? match.candidate : entry;
        
        const bridgeMessage = await aiService.generateBridgeMessage(
          problemEntry,
          solutionEntry
        );

        // Generate privacy-preserving summary
        const theirEntrySummary = await aiService.generateEntrySummary(
          isProblem ? solutionEntry : problemEntry
        );

        // Create connection
        const connection = await Connection.create({
          seekerId: isProblem ? userId : match.candidate.userId,
          sageId: isProblem ? match.candidate.userId : userId,
          problemEntryId: isProblem ? entryId : match.candidate._id,
          solutionEntryId: isProblem ? match.candidate._id : entryId,
          similarityScore: match.similarity,
          rerankScore: rerankScore,
          combinedScore: effectiveScore,
          bridgeMessage,
          theirEntrySummary,
          status: 'pending'
        });

        console.log(`Created connection ${connection._id} with combined score ${effectiveScore.toFixed(2)}`);

        // Notify both users with resonance card data
        const sharedThemes = entry.themes?.filter(t => 
          match.candidate.themes?.includes(t)
        ) || [];

        notifyUser(connection.seekerId.toString(), 'resonance', {
          connectionId: connection._id,
          bridgeMessage,
          similarity: match.similarity,
          combinedScore: effectiveScore,
          role: 'seeker',
          sharedThemes,
          theirEntry: {
            intentLabel: solutionEntry.intentLabel,
            sentiment: solutionEntry.sentiment,
            themes: solutionEntry.themes
          },
          summary: theirEntrySummary
        });

        notifyUser(connection.sageId.toString(), 'resonance', {
          connectionId: connection._id,
          bridgeMessage,
          similarity: match.similarity,
          combinedScore: effectiveScore,
          role: 'sage',
          sharedThemes,
          theirEntry: {
            intentLabel: problemEntry.intentLabel,
            sentiment: problemEntry.sentiment,
            themes: problemEntry.themes
          },
          summary: await aiService.generateEntrySummary(problemEntry)
        });

      } catch (error) {
        console.error('Error creating connection:', error.message);
      }
    }
  }

  return matches;
}

// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

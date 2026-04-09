import { Entry, Connection, User } from '../models/index.js';
import * as aiService from './aiService.js';
import { notifyUser } from './socketService.js';

// Thresholds for different connection types
const THRESHOLDS = {
  'seeker-sage': 0.75,        // Problem → Solution (lowered from 0.82)
  'solidarity': 0.75,          // Problem ↔ Problem (lowered from 0.78)
  'wisdom-exchange': 0.75,     // Solution ↔ Solution (lowered from 0.80)
  'kindred-spirits': 0.70,     // Reflection ↔ Reflection (lowered from 0.75)
  'insight-share': 0.80        // Cross-type (lowered from 0.85)
};

const MAX_MATCHES_PER_ENTRY = 5;
const BATCH_SIZE = 50;

/**
 * Run passive matching for all unmatched discoverable entries
 * This scans the database and creates connections based on historical data
 */
export async function runPassiveMatching(options = {}) {
  const { 
    limit = 100,           // Max entries to process
    userId = null,         // Optional: only process entries for specific user
    entryId = null,        // Optional: only process specific entry
    dryRun = false         // If true, don't create connections, just return matches
  } = options;

  console.log('🔍 Starting passive matching scan...');
  
  const query = {
    isDiscoverable: true,
    aiProcessed: true,
    embedding: { $ne: null }
  };
  
  if (userId) query.userId = userId;
  if (entryId) query._id = entryId;

  const entries = await Entry.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id userId content themes sentiment intentLabel embedding createdAt');

  console.log(`📝 Found ${entries.length} entries to process`);

  const allMatches = [];
  let connectionsCreated = 0;

  for (const entry of entries) {
    console.log(`\n🔍 Processing entry ${entry._id}: ${entry.intentLabel}, User: ${entry.userId}`);
    const matches = await findAllMatches(entry);
    
    for (const match of matches) {
      // Skip if connection already exists
      const exists = await connectionExists(entry._id, match.entry._id);
      if (exists) continue;

      if (!dryRun) {
        const connection = await createConnection(entry, match);
        if (connection) {
          connectionsCreated++;
          allMatches.push({
            connection,
            type: match.connectionType,
            score: match.similarity
          });
        }
      } else {
        allMatches.push({
          entry1: entry._id,
          entry2: match.entry._id,
          type: match.connectionType,
          score: match.similarity
        });
      }
    }
  }

  console.log(`✅ Passive matching complete: ${connectionsCreated} connections created`);
  
  return {
    entriesProcessed: entries.length,
    connectionsCreated,
    matches: allMatches
  };
}

/**
 * Find all types of matches for a single entry
 */
async function findAllMatches(sourceEntry) {
  const allMatches = [];
  
  // Determine what types of matches to look for based on entry intent
  const matchTypes = getMatchTypesForIntent(sourceEntry.intentLabel);
  
  for (const matchType of matchTypes) {
    const matches = await findMatchesByType(sourceEntry, matchType);
    allMatches.push(...matches);
  }
  
  // Sort by similarity and take top matches
  return allMatches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_MATCHES_PER_ENTRY);
}

/**
 * Determine which match types to look for based on entry intent
 */
function getMatchTypesForIntent(intentLabel) {
  switch (intentLabel) {
    case 'Problem':
      return ['seeker-sage', 'solidarity', 'insight-share'];
    case 'Solution':
      return ['seeker-sage', 'wisdom-exchange', 'insight-share'];
    case 'Reflection':
      return ['kindred-spirits', 'insight-share'];
    default:
      return ['insight-share'];
  }
}

/**
 * Find matches of a specific type
 */
async function findMatchesByType(sourceEntry, connectionType) {
  const threshold = THRESHOLDS[connectionType];
  let targetIntents;
  
  switch (connectionType) {
    case 'seeker-sage':
      // Problem looks for Solution, Solution looks for Problem
      targetIntents = sourceEntry.intentLabel === 'Problem' ? ['Solution'] : ['Problem'];
      break;
    case 'solidarity':
      // Problem looks for Problem (shared struggles)
      targetIntents = ['Problem'];
      break;
    case 'wisdom-exchange':
      // Solution looks for Solution
      targetIntents = ['Solution'];
      break;
    case 'kindred-spirits':
      // Reflection looks for Reflection
      targetIntents = ['Reflection'];
      break;
    case 'insight-share':
      // Any intent can match any other (cross-type)
      targetIntents = ['Problem', 'Solution', 'Reflection'];
      break;
    default:
      targetIntents = [];
  }

  // Find candidate entries
  const candidates = await Entry.find({
    intentLabel: { $in: targetIntents },
    isDiscoverable: true,
    aiProcessed: true,
    embedding: { $ne: null },
    userId: { $ne: sourceEntry.userId }, // Don't match with own entries
    _id: { $ne: sourceEntry._id }
  })
  .select('_id userId content themes sentiment intentLabel embedding')
  .limit(BATCH_SIZE);

  // Calculate similarity for each candidate
  const matches = [];
  
  console.log(`   Checking ${candidates.length} candidates for ${connectionType}`);
  
  for (const candidate of candidates) {
    const similarity = cosineSimilarity(sourceEntry.embedding, candidate.embedding);
    
    console.log(`   Similarity: ${similarity.toFixed(3)} (threshold: ${threshold.toFixed(3)}) - ${candidate.intentLabel}`);
    
    if (similarity >= threshold) {
      matches.push({
        entry: candidate,
        similarity,
        connectionType
      });
      console.log(`   ✅ Match found! Similarity ${similarity.toFixed(3)} >= threshold ${threshold.toFixed(3)}`);
    }
  }
  
  console.log(`   Found ${matches.length} matches above threshold for ${connectionType}`);
  
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Check if a connection already exists between two entries
 */
async function connectionExists(entry1Id, entry2Id) {
  const existing = await Connection.findOne({
    $or: [
      { entry1Id: entry1Id, entry2Id: entry2Id },
      { entry1Id: entry2Id, entry2Id: entry1Id },
      { problemEntryId: entry1Id, solutionEntryId: entry2Id },
      { problemEntryId: entry2Id, solutionEntryId: entry1Id }
    ]
  });
  return !!existing;
}

/**
 * Create a connection between two entries
 */
async function createConnection(entry1, match) {
  try {
    const entry2 = match.entry;
    const connectionType = match.connectionType;
    
    // Generate appropriate bridge message based on connection type
    const bridgeMessage = await generateBridgeMessage(entry1, entry2, connectionType);
    
    // Generate privacy-preserving summaries
    const [summary1, summary2] = await Promise.all([
      aiService.generateEntrySummary(entry1),
      aiService.generateEntrySummary(entry2)
    ]);

    // Build connection data
    const connectionData = {
      connectionType,
      user1Id: entry1.userId,
      user2Id: entry2.userId,
      entry1Id: entry1._id,
      entry2Id: entry2._id,
      similarityScore: match.similarity,
      combinedScore: match.similarity,
      bridgeMessage,
      theirEntrySummary: summary2,
      status: 'pending'
    };

    // For seeker-sage type, also populate legacy fields
    if (connectionType === 'seeker-sage') {
      if (entry1.intentLabel === 'Problem') {
        connectionData.seekerId = entry1.userId;
        connectionData.sageId = entry2.userId;
        connectionData.problemEntryId = entry1._id;
        connectionData.solutionEntryId = entry2._id;
      } else {
        connectionData.seekerId = entry2.userId;
        connectionData.sageId = entry1.userId;
        connectionData.problemEntryId = entry2._id;
        connectionData.solutionEntryId = entry1._id;
      }
    }

    const connection = await Connection.create(connectionData);
    console.log(`✨ Created ${connectionType} connection: ${connection._id}`);

    // Find shared themes
    const sharedThemes = entry1.themes?.filter(t => 
      entry2.themes?.some(t2 => t2.toLowerCase() === t.toLowerCase())
    ) || [];

    // Notify both users
    const notificationPayload1 = {
      connectionId: connection._id,
      connectionType,
      bridgeMessage,
      similarity: match.similarity,
      sharedThemes,
      theirEntry: {
        intentLabel: entry2.intentLabel,
        sentiment: entry2.sentiment,
        themes: entry2.themes
      },
      summary: summary2
    };

    const notificationPayload2 = {
      connectionId: connection._id,
      connectionType,
      bridgeMessage,
      similarity: match.similarity,
      sharedThemes,
      theirEntry: {
        intentLabel: entry1.intentLabel,
        sentiment: entry1.sentiment,
        themes: entry1.themes
      },
      summary: summary1
    };

    // Add role information based on connection type
    if (connectionType === 'seeker-sage') {
      if (entry1.intentLabel === 'Problem') {
        notificationPayload1.role = 'seeker';
        notificationPayload2.role = 'sage';
      } else {
        notificationPayload1.role = 'sage';
        notificationPayload2.role = 'seeker';
      }
    } else {
      // For non seeker-sage types, both are peers
      notificationPayload1.role = 'peer';
      notificationPayload2.role = 'peer';
    }

    notifyUser(entry1.userId.toString(), 'resonance', notificationPayload1);
    notifyUser(entry2.userId.toString(), 'resonance', notificationPayload2);

    return connection;
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate connection, ignore
      return null;
    }
    console.error('Error creating connection:', error.message);
    return null;
  }
}

/**
 * Generate appropriate bridge message based on connection type
 */
async function generateBridgeMessage(entry1, entry2, connectionType) {
  const prompts = {
    'seeker-sage': null, // Use existing aiService.generateBridgeMessage
    'solidarity': `You are a compassionate connector. Two people are going through similar challenges. 
Write a brief, warm message (2-3 sentences) that introduces them to each other as kindred spirits who understand each other's struggle. 
Don't reveal specific details, just acknowledge they're facing similar situations.

Person 1's situation themes: ${entry1.themes?.join(', ')}
Person 2's situation themes: ${entry2.themes?.join(', ')}

Mood 1: ${entry1.sentiment?.mood}, Mood 2: ${entry2.sentiment?.mood}`,

    'wisdom-exchange': `You are connecting two people who both have wisdom to share.
Write a brief message (2-3 sentences) introducing them as people with complementary insights who could learn from each other.

Person 1's expertise themes: ${entry1.themes?.join(', ')}
Person 2's expertise themes: ${entry2.themes?.join(', ')}`,

    'kindred-spirits': `You are connecting two reflective souls who think similarly.
Write a warm, brief message (2-3 sentences) introducing them as kindred spirits whose thoughts resonate.

Person 1 reflects on: ${entry1.themes?.join(', ')}
Person 2 reflects on: ${entry2.themes?.join(', ')}`,

    'insight-share': `You are connecting two people whose thoughts might benefit each other.
Write a brief, curious message (2-3 sentences) suggesting they might find value in each other's perspective.

Person 1 (${entry1.intentLabel}): ${entry1.themes?.join(', ')}
Person 2 (${entry2.intentLabel}): ${entry2.themes?.join(', ')}`
  };

  if (connectionType === 'seeker-sage') {
    // Use existing method for seeker-sage
    const problemEntry = entry1.intentLabel === 'Problem' ? entry1 : entry2;
    const solutionEntry = entry1.intentLabel === 'Solution' ? entry1 : entry2;
    return await aiService.generateBridgeMessage(problemEntry, solutionEntry);
  }

  try {
    const response = await aiService.chat([
      { role: 'system', content: prompts[connectionType] },
      { role: 'user', content: 'Generate the connection message.' }
    ]);
    return response || getDefaultBridgeMessage(connectionType);
  } catch (error) {
    console.error('Error generating bridge message:', error.message);
    return getDefaultBridgeMessage(connectionType);
  }
}

/**
 * Default bridge messages if AI fails
 */
function getDefaultBridgeMessage(connectionType) {
  const defaults = {
    'solidarity': "You're not alone. Someone else understands what you're going through. Perhaps sharing your experiences could help you both.",
    'wisdom-exchange': "Two minds with wisdom to share. Your insights could complement each other beautifully.",
    'kindred-spirits': "Your thoughts resonate with someone else's reflections. There might be something meaningful in connecting.",
    'insight-share': "Your journeys might intersect in unexpected ways. Consider reaching out."
  };
  return defaults[connectionType] || "A meaningful connection awaits.";
}

/**
 * Cosine similarity calculation
 */
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

/**
 * Process a single entry for matches (called from entryProcessor)
 */
export async function findMatchesForEntry(entryId) {
  const entry = await Entry.findById(entryId)
    .select('_id userId content themes sentiment intentLabel embedding');
  
  if (!entry || !entry.embedding) {
    return [];
  }

  const matches = await findAllMatches(entry);
  const createdConnections = [];

  for (const match of matches) {
    const exists = await connectionExists(entry._id, match.entry._id);
    if (exists) continue;

    const connection = await createConnection(entry, match);
    if (connection) {
      createdConnections.push(connection);
    }
  }

  return createdConnections;
}

/**
 * Get match statistics for an entry
 */
export async function getMatchStats(entryId) {
  const entry = await Entry.findById(entryId)
    .select('_id userId themes sentiment intentLabel embedding');
  
  if (!entry || !entry.embedding) {
    return { potentialMatches: 0, byType: {} };
  }

  const matchTypes = getMatchTypesForIntent(entry.intentLabel);
  const stats = { potentialMatches: 0, byType: {} };

  for (const type of matchTypes) {
    const matches = await findMatchesByType(entry, type);
    stats.byType[type] = matches.length;
    stats.potentialMatches += matches.length;
  }

  return stats;
}

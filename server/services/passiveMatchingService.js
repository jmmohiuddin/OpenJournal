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
const FALLBACK_MIN_THRESHOLD = parseFloat(process.env.MATCH_FALLBACK_MIN_THRESHOLD || '0.55');

const MAX_MATCHES_PER_ENTRY = 5;
const BATCH_SIZE = 50;
const KNOWN_INTENTS = ['Problem', 'Solution', 'Reflection'];
const AI_CALL_TIMEOUT_MS = parseInt(process.env.MATCH_AI_TIMEOUT_MS || '4000', 10);

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
    isDiscoverable: true
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
      return ['seeker-sage', 'solidarity', 'wisdom-exchange', 'kindred-spirits', 'insight-share'];
  }
}

/**
 * Find matches of a specific type
 */
async function findMatchesByType(sourceEntry, connectionType) {
  const threshold = THRESHOLDS[connectionType];
  const sourceIntent = resolveIntent(sourceEntry);
  let targetIntents;
  
  switch (connectionType) {
    case 'seeker-sage':
      // Problem looks for Solution, Solution looks for Problem
      targetIntents = sourceIntent === 'Problem' ? ['Solution'] : sourceIntent === 'Solution' ? ['Problem'] : ['Problem', 'Solution'];
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
    isDiscoverable: true,
    userId: { $ne: sourceEntry.userId }, // Don't match with own entries
    _id: { $ne: sourceEntry._id }
  })
  .select('_id userId content themes sentiment intentLabel embedding')
  .limit(BATCH_SIZE);

  // Calculate similarity for each candidate
  const scoredCandidates = [];
  
  console.log(`   Checking ${candidates.length} candidates for ${connectionType}`);
  
  for (const candidate of candidates) {
    const candidateIntent = resolveIntent(candidate);
    if (!targetIntents.includes(candidateIntent)) {
      continue;
    }
    const similarity = computeSimilarity(sourceEntry, candidate);
    
    console.log(`   Similarity: ${similarity.toFixed(3)} (threshold: ${threshold.toFixed(3)}) - ${candidateIntent}`);
    
    scoredCandidates.push({
      entry: candidate,
      similarity,
      connectionType,
      sourceIntent,
      candidateIntent
    });
  }

  const strictMatches = scoredCandidates.filter((m) => m.similarity >= threshold);
  if (strictMatches.length > 0) {
    console.log(`   Found ${strictMatches.length} matches above threshold for ${connectionType}`);
    return strictMatches.sort((a, b) => b.similarity - a.similarity);
  }

  const fallbackMatches = scoredCandidates.filter((m) => m.similarity >= FALLBACK_MIN_THRESHOLD);
  if (fallbackMatches.length > 0) {
    console.log(
      `   Using fallback threshold ${FALLBACK_MIN_THRESHOLD.toFixed(2)} for ${connectionType}; found ${fallbackMatches.length} matches`
    );
    return fallbackMatches.sort((a, b) => b.similarity - a.similarity);
  }

  console.log(`   Found 0 matches for ${connectionType}`);
  return [];
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
    const sourceIntent = match.sourceIntent || resolveIntent(entry1);
    const candidateIntent = match.candidateIntent || resolveIntent(entry2);
    
    // Generate copy with strict timeout + deterministic fallbacks.
    const [bridgeMessage, summary1, summary2] = await Promise.all([
      safelyGenerateBridgeMessage(entry1, entry2, connectionType),
      safelyGenerateEntrySummary(entry1),
      safelyGenerateEntrySummary(entry2)
    ]);

    // Build connection data
    const connectionData = {
      connectionType,
      user1Id: entry1.userId,
      user2Id: entry2.userId,
      entry1Id: entry1._id,
      entry2Id: entry2._id,
      // Always set legacy pair fields to avoid null/null unique-index collisions.
      problemEntryId: entry1._id,
      solutionEntryId: entry2._id,
      similarityScore: match.similarity,
      combinedScore: match.similarity,
      bridgeMessage,
      theirEntrySummary: summary2,
      status: 'pending'
    };

    // For seeker-sage type, also populate legacy fields
    if (connectionType === 'seeker-sage') {
      if (sourceIntent === 'Problem' && candidateIntent === 'Solution') {
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
    } else {
      connectionData.seekerId = entry1.userId;
      connectionData.sageId = entry2.userId;
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
      if (sourceIntent === 'Problem' && candidateIntent === 'Solution') {
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
    const entry1Intent = resolveIntent(entry1);
    const problemEntry = entry1Intent === 'Problem' ? entry1 : entry2;
    const solutionEntry = entry1Intent === 'Solution' ? entry1 : entry2;
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

async function safelyGenerateBridgeMessage(entry1, entry2, connectionType) {
  try {
    return await withTimeout(
      generateBridgeMessage(entry1, entry2, connectionType),
      AI_CALL_TIMEOUT_MS,
      `bridge message timeout for ${connectionType}`
    );
  } catch (error) {
    console.error('Bridge generation fallback:', error.message);
    return getDefaultBridgeMessage(connectionType);
  }
}

async function safelyGenerateEntrySummary(entry) {
  try {
    return await withTimeout(
      aiService.generateEntrySummary(entry),
      AI_CALL_TIMEOUT_MS,
      'entry summary timeout'
    );
  } catch (error) {
    console.error('Summary generation fallback:', error.message);
    return getHeuristicSummary(entry);
  }
}

function getHeuristicSummary(entry) {
  const mood = entry?.sentiment?.mood || 'thoughtful';
  const intent = resolveIntent(entry).toLowerCase();
  const primaryTheme = (entry?.themes && entry.themes[0]) ? entry.themes[0] : 'life';
  return `A ${mood} ${intent} about ${primaryTheme}.`;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
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
 * Compute similarity with resilient fallback:
 * - Use embedding cosine when both vectors are available and compatible.
 * - Otherwise use lexical/theme overlap so matching still works for users whose
 *   embedding provider is temporarily unavailable.
 */
function computeSimilarity(entryA, entryB) {
  const embeddingScore = cosineSimilarity(entryA.embedding, entryB.embedding);
  if (embeddingScore > 0) return embeddingScore;

  const themesA = (entryA.themes || []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  const themesB = (entryB.themes || []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  const themeScore = jaccardScore(themesA, themesB);

  const tokensA = tokenize(entryA.content);
  const tokensB = tokenize(entryB.content);
  const tokenScore = jaccardScore(tokensA, tokensB);

  // Themes are denser intent signals than raw token overlap.
  return (themeScore * 0.65) + (tokenScore * 0.35);
}

function resolveIntent(entry) {
  const labeledIntent = entry?.intentLabel;
  if (KNOWN_INTENTS.includes(labeledIntent)) {
    return labeledIntent;
  }

  const text = `${entry?.content || ''}`.toLowerCase();
  const themes = (entry?.themes || []).join(' ').toLowerCase();
  const combined = `${text} ${themes}`;

  const problemSignals = ['stuck', 'struggle', 'anxious', 'anxiety', 'overwhelmed', 'need help', 'cannot', "can't", 'problem', 'difficult', 'hard'];
  const solutionSignals = ['helped me', 'what worked', 'steps', 'framework', 'routine', 'advice', 'tip', 'solution', 'try this', 'recommend'];

  const problemHits = problemSignals.reduce((count, token) => count + (combined.includes(token) ? 1 : 0), 0);
  const solutionHits = solutionSignals.reduce((count, token) => count + (combined.includes(token) ? 1 : 0), 0);

  if (solutionHits > problemHits) return 'Solution';
  if (problemHits > 0) return 'Problem';
  return 'Reflection';
}

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function jaccardScore(listA, listB) {
  if (!listA.length || !listB.length) return 0;
  const setA = new Set(listA);
  const setB = new Set(listB);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

/**
 * Process a single entry for matches (called from entryProcessor)
 */
export async function findMatchesForEntry(entryId) {
  const entry = await Entry.findById(entryId)
    .select('_id userId content themes sentiment intentLabel embedding');
  
  if (!entry) {
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
  
  if (!entry) {
    return { potentialMatches: 0, byType: {} };
  }

  const matchTypes = getMatchTypesForIntent(resolveIntent(entry));
  const stats = { potentialMatches: 0, byType: {} };

  for (const type of matchTypes) {
    const matches = await findMatchesByType(entry, type);
    stats.byType[type] = matches.length;
    stats.potentialMatches += matches.length;
  }

  return stats;
}

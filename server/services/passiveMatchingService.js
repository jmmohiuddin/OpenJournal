import { Entry, Connection, User } from '../models/index.js';
import * as aiService from './aiService.js';
import { notifyUser } from './socketService.js';

// ---------------------------------------------------------------------------
// Thresholds for different connection types
// ---------------------------------------------------------------------------
const THRESHOLDS = {
  'seeker-sage':     0.75,
  'solidarity':      0.75,
  'wisdom-exchange': 0.75,
  'kindred-spirits': 0.70,
  'insight-share':   0.80
};
const FALLBACK_MIN_THRESHOLD = parseFloat(process.env.MATCH_FALLBACK_MIN_THRESHOLD || '0.55');

const MAX_MATCHES_PER_ENTRY = 5;
// How many entries to load into memory at once when iterating the full collection.
// Keeps RAM usage manageable even with thousands of entries.
const PAGE_SIZE = 200;
const KNOWN_INTENTS = ['Problem', 'Solution', 'Reflection'];
const AI_CALL_TIMEOUT_MS = parseInt(process.env.MATCH_AI_TIMEOUT_MS || '8000', 10);

// ---------------------------------------------------------------------------
// Public: Run passive matching for all (or filtered) discoverable entries
// ---------------------------------------------------------------------------
/**
 * Scans every discoverable, AI-processed entry and creates connections where
 * the semantic similarity exceeds the threshold.
 *
 * Fixes vs. previous version:
 *  - Paginated cursor (PAGE_SIZE=200) replaces the BATCH_SIZE=50 cap so ALL
 *    entries in the database are considered, not just the first 50.
 *  - The `userId` filter no longer restricts candidate-fetching — when called
 *    globally (no userId option) every user's entries are matched against
 *    every other user's entries.
 *  - AI message generation is fire-and-forget: connections are persisted
 *    immediately with heuristic fallbacks; AI enrichment patches the record
 *    and re-notifies users once complete.
 */
export async function runPassiveMatching(options = {}) {
  const {
    limit   = 500,   // Max total entries to process in this run
    userId  = null,  // Optional: only process entries belonging to this user
    entryId = null,  // Optional: only process this one specific entry
    dryRun  = false  // If true, return potential matches without persisting
  } = options;

  console.log('🔍 Starting passive matching scan...');

  // Build the source-entry query
  const sourceQuery = {
    isDiscoverable: true,
    aiProcessed:    true,
    embedding:      { $ne: null }   // Only match entries that have an embedding
  };
  if (userId)  sourceQuery.userId = userId;
  if (entryId) sourceQuery._id    = entryId;

  const allMatches       = [];
  let   connectionsCreated = 0;
  let   totalProcessed   = 0;
  let   skip             = 0;

  // Paginated loop — prevents loading the entire collection into RAM at once
  while (totalProcessed < limit) {
    const batchSize = Math.min(PAGE_SIZE, limit - totalProcessed);
    const entries   = await Entry.find(sourceQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(batchSize)
      .select('_id userId content themes sentiment intentLabel embedding createdAt');

    if (entries.length === 0) break; // No more entries

    console.log(`📄 Processing page starting at ${skip} (${entries.length} entries)`);

    for (const entry of entries) {
      console.log(`\n🔍 Processing entry ${entry._id}: ${entry.intentLabel}, User: ${entry.userId}`);
      const matches = await findAllMatches(entry);

      for (const match of matches) {
        const exists = await connectionExists(entry._id, match.entry._id);
        if (exists) continue;

        if (!dryRun) {
          const connection = await createConnectionFast(entry, match);
          if (connection) {
            connectionsCreated++;
            allMatches.push({
              connection,
              type:  match.connectionType,
              score: match.similarity
            });
          }
        } else {
          allMatches.push({
            entry1: entry._id,
            entry2: match.entry._id,
            type:   match.connectionType,
            score:  match.similarity
          });
        }
      }
    }

    totalProcessed += entries.length;
    skip           += entries.length;

    if (entries.length < batchSize) break; // Last page
  }

  console.log(`✅ Passive matching complete: ${connectionsCreated} connections created (${totalProcessed} entries scanned)`);

  return {
    entriesProcessed:    totalProcessed,
    connectionsCreated,
    matches:             allMatches
  };
}

// ---------------------------------------------------------------------------
// Internal: find all match types for a single source entry
// ---------------------------------------------------------------------------
async function findAllMatches(sourceEntry) {
  const matchTypes = getMatchTypesForIntent(sourceEntry.intentLabel);
  const allMatches = [];

  for (const matchType of matchTypes) {
    const matches = await findMatchesByType(sourceEntry, matchType);
    allMatches.push(...matches);
  }

  return allMatches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_MATCHES_PER_ENTRY);
}

function getMatchTypesForIntent(intentLabel) {
  switch (intentLabel) {
    case 'Problem':    return ['seeker-sage', 'solidarity', 'insight-share'];
    case 'Solution':   return ['seeker-sage', 'wisdom-exchange', 'insight-share'];
    case 'Reflection': return ['kindred-spirits', 'insight-share'];
    default:           return ['seeker-sage', 'solidarity', 'wisdom-exchange', 'kindred-spirits', 'insight-share'];
  }
}

// ---------------------------------------------------------------------------
// Internal: find candidates for a single connection type
// Paginated — fetches all qualifying candidates in batches instead of
// hard-capping at 50 (old BATCH_SIZE bug).
// ---------------------------------------------------------------------------
async function findMatchesByType(sourceEntry, connectionType) {
  const threshold    = THRESHOLDS[connectionType];
  const sourceIntent = resolveIntent(sourceEntry);
  let   targetIntents;

  switch (connectionType) {
    case 'seeker-sage':
      targetIntents = sourceIntent === 'Problem'    ? ['Solution']
                    : sourceIntent === 'Solution'   ? ['Problem']
                    : ['Problem', 'Solution'];
      break;
    case 'solidarity':      targetIntents = ['Problem'];             break;
    case 'wisdom-exchange': targetIntents = ['Solution'];            break;
    case 'kindred-spirits': targetIntents = ['Reflection'];          break;
    case 'insight-share':   targetIntents = ['Problem', 'Solution', 'Reflection']; break;
    default:                targetIntents = [];
  }

  // Query — no BATCH_SIZE cap; paginate if needed
  const candidateQuery = {
    isDiscoverable: true,
    aiProcessed:    true,
    embedding:      { $ne: null },
    userId:         { $ne: sourceEntry.userId },   // never self-match
    _id:            { $ne: sourceEntry._id }
  };

  const scoredCandidates = [];
  let   candidateSkip    = 0;
  const CANDIDATE_PAGE   = 500;

  while (true) {
    const batch = await Entry.find(candidateQuery)
      .select('_id userId content themes sentiment intentLabel embedding')
      .skip(candidateSkip)
      .limit(CANDIDATE_PAGE);

    if (batch.length === 0) break;

    for (const candidate of batch) {
      const candidateIntent = resolveIntent(candidate);
      if (!targetIntents.includes(candidateIntent)) continue;

      const similarity = computeSimilarity(sourceEntry, candidate);

      scoredCandidates.push({
        entry:          candidate,
        similarity,
        connectionType,
        sourceIntent,
        candidateIntent
      });
    }

    candidateSkip += batch.length;
    if (batch.length < CANDIDATE_PAGE) break;
  }

  console.log(`   Checked ${scoredCandidates.length} candidates for ${connectionType}`);

  const strictMatches = scoredCandidates.filter(m => m.similarity >= threshold);
  if (strictMatches.length > 0) {
    console.log(`   Found ${strictMatches.length} matches above threshold for ${connectionType}`);
    return strictMatches.sort((a, b) => b.similarity - a.similarity);
  }

  const fallbackMatches = scoredCandidates.filter(m => m.similarity >= FALLBACK_MIN_THRESHOLD);
  if (fallbackMatches.length > 0) {
    console.log(`   Using fallback threshold ${FALLBACK_MIN_THRESHOLD.toFixed(2)} for ${connectionType}; found ${fallbackMatches.length} matches`);
    return fallbackMatches.sort((a, b) => b.similarity - a.similarity);
  }

  console.log(`   Found 0 matches for ${connectionType}`);
  return [];
}

// ---------------------------------------------------------------------------
// Internal: duplicate connection check
// ---------------------------------------------------------------------------
async function connectionExists(entry1Id, entry2Id) {
  const existing = await Connection.findOne({
    $or: [
      { entry1Id: entry1Id,  entry2Id: entry2Id  },
      { entry1Id: entry2Id,  entry2Id: entry1Id  },
      { problemEntryId: entry1Id,  solutionEntryId: entry2Id  },
      { problemEntryId: entry2Id,  solutionEntryId: entry1Id  }
    ]
  });
  return !!existing;
}

// ---------------------------------------------------------------------------
// Internal: create connection FAST (no blocking AI calls on critical path)
//
// The connection is saved immediately with heuristic-generated text so the
// user sees the card in their inbox right away. AI enrichment (bridge message
// + entry summaries) then runs in the background and patches the record.
// ---------------------------------------------------------------------------
async function createConnectionFast(entry1, match) {
  try {
    const entry2          = match.entry;
    const connectionType  = match.connectionType;
    const sourceIntent    = match.sourceIntent    || resolveIntent(entry1);
    const candidateIntent = match.candidateIntent || resolveIntent(entry2);

    // --- Immediate heuristic text so we can persist right away ---
    const heuristicBridge  = getDefaultBridgeMessage(connectionType);
    const heuristicSummary = getHeuristicSummary(entry2);

    // Build connection data
    const connectionData = {
      connectionType,
      user1Id:         entry1.userId,
      user2Id:         entry2.userId,
      entry1Id:        entry1._id,
      entry2Id:        entry2._id,
      problemEntryId:  entry1._id,      // always set to avoid null-null collision
      solutionEntryId: entry2._id,
      similarityScore: match.similarity,
      combinedScore:   match.similarity,
      bridgeMessage:   heuristicBridge,
      theirEntrySummary: heuristicSummary,
      status:          'pending'
    };

    // Seeker-sage role assignment
    if (connectionType === 'seeker-sage') {
      if (sourceIntent === 'Problem' && candidateIntent === 'Solution') {
        connectionData.seekerId         = entry1.userId;
        connectionData.sageId           = entry2.userId;
        connectionData.problemEntryId   = entry1._id;
        connectionData.solutionEntryId  = entry2._id;
      } else {
        connectionData.seekerId         = entry2.userId;
        connectionData.sageId           = entry1.userId;
        connectionData.problemEntryId   = entry2._id;
        connectionData.solutionEntryId  = entry1._id;
      }
    } else {
      connectionData.seekerId = entry1.userId;
      connectionData.sageId   = entry2.userId;
    }

    // Persist immediately — no AI needed yet
    const connection = await Connection.create(connectionData);
    console.log(`✨ Created ${connectionType} connection: ${connection._id}`);

    // Find shared themes for notifications
    const sharedThemes = (entry1.themes || []).filter(t =>
      (entry2.themes || []).some(t2 => t2.toLowerCase() === t.toLowerCase())
    );

    // Notify both users right away with heuristic text
    buildAndSendNotifications(connection, entry1, entry2, match, sharedThemes, heuristicBridge, heuristicSummary);

    // --- Fire-and-forget AI enrichment ---
    // Runs after the connection is already saved; patches the record with
    // better AI-generated text and re-emits an enriched notification.
    enrichConnectionInBackground(connection._id, entry1, entry2, connectionType).catch(err =>
      console.error(`Background AI enrichment failed for ${connection._id}:`, err.message)
    );

    return connection;

  } catch (error) {
    if (error.code === 11000) {
      // Duplicate connection — silently ignore (race-condition harmless)
      return null;
    }
    console.error('Error creating connection:', error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal: build notifications and emit to both users
// ---------------------------------------------------------------------------
function buildAndSendNotifications(connection, entry1, entry2, match, sharedThemes, bridgeMessage, summary2) {
  const connectionType = connection.connectionType;

  const base = {
    connectionId:  connection._id,
    connectionType,
    bridgeMessage,
    similarity:    match.similarity,
    sharedThemes
  };

  const payload1 = {
    ...base,
    theirEntry: {
      intentLabel: entry2.intentLabel,
      sentiment:   entry2.sentiment,
      themes:      entry2.themes
    },
    summary: summary2,
    role:    connectionType === 'seeker-sage'
               ? (match.sourceIntent === 'Problem' ? 'seeker' : 'sage')
               : 'peer'
  };

  const payload2 = {
    ...base,
    theirEntry: {
      intentLabel: entry1.intentLabel,
      sentiment:   entry1.sentiment,
      themes:      entry1.themes
    },
    summary: getHeuristicSummary(entry1),
    role:    connectionType === 'seeker-sage'
               ? (match.sourceIntent === 'Problem' ? 'sage' : 'seeker')
               : 'peer'
  };

  notifyUser(entry1.userId.toString(), 'resonance', payload1);
  notifyUser(entry2.userId.toString(), 'resonance', payload2);
}

// ---------------------------------------------------------------------------
// Internal: AI enrichment runs in the background after connection is saved
// ---------------------------------------------------------------------------
async function enrichConnectionInBackground(connectionId, entry1, entry2, connectionType) {
  try {
    const [bridgeMessage, summary1, summary2] = await Promise.all([
      withTimeout(generateBridgeMessage(entry1, entry2, connectionType), AI_CALL_TIMEOUT_MS, 'bridge timeout'),
      withTimeout(aiService.generateEntrySummary(entry1), AI_CALL_TIMEOUT_MS, 'summary1 timeout'),
      withTimeout(aiService.generateEntrySummary(entry2), AI_CALL_TIMEOUT_MS, 'summary2 timeout')
    ]);

    // Patch the connection with AI-generated content
    const updated = await Connection.findByIdAndUpdate(
      connectionId,
      { bridgeMessage, theirEntrySummary: summary2 },
      { new: true }
    )
      .populate('seekerId',  'displayName')
      .populate('sageId',    'displayName')
      .populate('user1Id',   'displayName')
      .populate('user2Id',   'displayName');

    if (!updated) return;

    // Re-notify users with the enriched bridge message
    const user1Id = (updated.user1Id?._id || updated.user1Id)?.toString();
    const user2Id = (updated.user2Id?._id || updated.user2Id)?.toString();

    const enriched = {
      connectionId,
      bridgeMessage,
      enriched: true
    };

    if (user1Id) notifyUser(user1Id, 'connection_enriched', { ...enriched, summary: summary2 });
    if (user2Id) notifyUser(user2Id, 'connection_enriched', { ...enriched, summary: summary1 });

    console.log(`🤖 AI enrichment complete for connection ${connectionId}`);
  } catch (err) {
    console.error(`AI enrichment error for ${connectionId}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Internal: Generate bridge message based on connection type
// ---------------------------------------------------------------------------
async function generateBridgeMessage(entry1, entry2, connectionType) {
  if (connectionType === 'seeker-sage') {
    const entry1Intent  = resolveIntent(entry1);
    const problemEntry  = entry1Intent === 'Problem' ? entry1 : entry2;
    const solutionEntry = entry1Intent === 'Solution' ? entry1 : entry2;
    return await aiService.generateBridgeMessage(problemEntry, solutionEntry);
  }

  const prompts = {
    'solidarity': `You are a compassionate connector. Two people are facing similar challenges.
Write a brief, warm message (2-3 sentences) introducing them as kindred spirits who understand each other's struggle.
Don't reveal specific details.

Person 1's themes: ${entry1.themes?.join(', ')}
Person 2's themes: ${entry2.themes?.join(', ')}
Mood 1: ${entry1.sentiment?.mood}, Mood 2: ${entry2.sentiment?.mood}`,

    'wisdom-exchange': `You are connecting two people who both have wisdom to share.
Write a brief message (2-3 sentences) introducing them as people with complementary insights.

Person 1's themes: ${entry1.themes?.join(', ')}
Person 2's themes: ${entry2.themes?.join(', ')}`,

    'kindred-spirits': `You are connecting two reflective souls who think similarly.
Write a warm, brief message (2-3 sentences) introducing them as kindred spirits.

Person 1 reflects on: ${entry1.themes?.join(', ')}
Person 2 reflects on: ${entry2.themes?.join(', ')}`,

    'insight-share': `You are connecting two people whose thoughts might benefit each other.
Write a brief, curious message (2-3 sentences) suggesting they might find value in each other's perspective.

Person 1 (${entry1.intentLabel}): ${entry1.themes?.join(', ')}
Person 2 (${entry2.intentLabel}): ${entry2.themes?.join(', ')}`
  };

  try {
    const response = await aiService.chat([
      { role: 'system', content: prompts[connectionType] || prompts['insight-share'] },
      { role: 'user',   content: 'Generate the connection message.' }
    ]);
    return response || getDefaultBridgeMessage(connectionType);
  } catch (error) {
    console.error('Error generating bridge message:', error.message);
    return getDefaultBridgeMessage(connectionType);
  }
}

function getDefaultBridgeMessage(connectionType) {
  const defaults = {
    'seeker-sage':     "Someone here might have a perspective that speaks to what you're exploring.",
    'solidarity':      "You're not alone. Someone else understands what you're going through. Perhaps sharing your experiences could help you both.",
    'wisdom-exchange': "Two minds with wisdom to share. Your insights could complement each other beautifully.",
    'kindred-spirits': "Your thoughts resonate with someone else's reflections. There might be something meaningful in connecting.",
    'insight-share':   "Your journeys might intersect in unexpected ways. Consider reaching out."
  };
  return defaults[connectionType] || 'A meaningful connection awaits.';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getHeuristicSummary(entry) {
  const mood         = entry?.sentiment?.mood || 'thoughtful';
  const intent       = resolveIntent(entry).toLowerCase();
  const primaryTheme = entry?.themes?.[0] || 'life';
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

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA      += vecA[i] * vecA[i];
    normB      += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeSimilarity(entryA, entryB) {
  const embeddingScore = cosineSimilarity(entryA.embedding, entryB.embedding);
  if (embeddingScore > 0) return embeddingScore;

  // Lexical fallback when embeddings are unavailable
  const themesA  = (entryA.themes || []).map(t => t.toLowerCase().trim()).filter(Boolean);
  const themesB  = (entryB.themes || []).map(t => t.toLowerCase().trim()).filter(Boolean);
  const themeScore = jaccardScore(themesA, themesB);

  const tokensA    = tokenize(entryA.content);
  const tokensB    = tokenize(entryB.content);
  const tokenScore = jaccardScore(tokensA, tokensB);

  return (themeScore * 0.65) + (tokenScore * 0.35);
}

function resolveIntent(entry) {
  const labeledIntent = entry?.intentLabel;
  if (KNOWN_INTENTS.includes(labeledIntent)) return labeledIntent;

  const text     = `${entry?.content || ''}`.toLowerCase();
  const themes   = (entry?.themes || []).join(' ').toLowerCase();
  const combined = `${text} ${themes}`;

  const problemSignals  = ['stuck', 'struggle', 'anxious', 'anxiety', 'overwhelmed', 'need help', 'cannot', "can't", 'problem', 'difficult', 'hard'];
  const solutionSignals = ['helped me', 'what worked', 'steps', 'framework', 'routine', 'advice', 'tip', 'solution', 'try this', 'recommend'];

  const problemHits  = problemSignals.reduce((c, t)  => c + (combined.includes(t) ? 1 : 0), 0);
  const solutionHits = solutionSignals.reduce((c, t) => c + (combined.includes(t) ? 1 : 0), 0);

  if (solutionHits > problemHits) return 'Solution';
  if (problemHits  > 0)           return 'Problem';
  return 'Reflection';
}

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

function jaccardScore(listA, listB) {
  if (!listA.length || !listB.length) return 0;
  const setA    = new Set(listA);
  const setB    = new Set(listB);
  let   intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
// Public: Match a single entry (called from entryProcessor on new entries)
// ---------------------------------------------------------------------------
export async function findMatchesForEntry(entryId) {
  const entry = await Entry.findById(entryId)
    .select('_id userId content themes sentiment intentLabel embedding');

  if (!entry) return [];

  const matches             = await findAllMatches(entry);
  const createdConnections  = [];

  for (const match of matches) {
    const exists = await connectionExists(entry._id, match.entry._id);
    if (exists) continue;

    const connection = await createConnectionFast(entry, match);
    if (connection) createdConnections.push(connection);
  }

  return createdConnections;
}

// ---------------------------------------------------------------------------
// Public: Stats (used by matching route)
// ---------------------------------------------------------------------------
export async function getMatchStats(entryId) {
  const entry = await Entry.findById(entryId)
    .select('_id userId themes sentiment intentLabel embedding');

  if (!entry) return { potentialMatches: 0, byType: {} };

  const matchTypes = getMatchTypesForIntent(resolveIntent(entry));
  const stats      = { potentialMatches: 0, byType: {} };

  for (const type of matchTypes) {
    const matches        = await findMatchesByType(entry, type);
    stats.byType[type]   = matches.length;
    stats.potentialMatches += matches.length;
  }

  return stats;
}

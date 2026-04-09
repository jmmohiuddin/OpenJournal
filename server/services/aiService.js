// AI Service - supports Hugging Face (hosted), Ollama (localhost), and OpenAI fallback.
import * as ollama from './ollamaService.js';
import OpenAI from 'openai';
import { InferenceClient } from '@huggingface/inference';

const PROVIDERS = {
  AUTO: 'auto',
  OLLAMA: 'ollama',
  HUGGINGFACE: 'huggingface',
  OPENAI: 'openai'
};

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

const HF_PROVIDER = process.env.HF_PROVIDER || 'hf-inference';
const HF_INTENT_MODEL = process.env.HF_INTENT_MODEL || 'microsoft/deberta-v3-large';
const HF_EMBED_MODEL = process.env.HF_EMBED_MODEL || 'BAAI/bge-large-en-v1.5';
const HF_RERANK_MODEL = process.env.HF_RERANK_MODEL || 'BAAI/bge-reranker-large';
const HF_CHAT_MODEL = process.env.HF_CHAT_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
const HF_ASR_MODEL = process.env.HF_ASR_MODEL || 'openai/whisper-large-v3';

const configuredProvider = (process.env.AI_PROVIDER || PROVIDERS.AUTO).toLowerCase();
let activeProvider = configuredProvider;
let openaiClient = null;
let hfClient = null;

function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getHFClient() {
  if (!hfClient && process.env.HF_TOKEN) {
    hfClient = new InferenceClient(process.env.HF_TOKEN);
  }
  return hfClient;
}

function normalizeProvider(provider) {
  if (!provider) return PROVIDERS.AUTO;
  const p = provider.toLowerCase();
  if (Object.values(PROVIDERS).includes(p)) return p;
  return PROVIDERS.AUTO;
}

async function resolveProvider() {
  const requested = normalizeProvider(configuredProvider);

  if (requested === PROVIDERS.OLLAMA) {
    activeProvider = PROVIDERS.OLLAMA;
    return activeProvider;
  }

  if (requested === PROVIDERS.HUGGINGFACE) {
    if (!getHFClient()) {
      throw new Error('AI_PROVIDER=huggingface but HF_TOKEN is missing');
    }
    activeProvider = PROVIDERS.HUGGINGFACE;
    return activeProvider;
  }

  if (requested === PROVIDERS.OPENAI) {
    if (!getOpenAIClient()) {
      throw new Error('AI_PROVIDER=openai but OPENAI_API_KEY is missing');
    }
    activeProvider = PROVIDERS.OPENAI;
    return activeProvider;
  }

  // AUTO mode: prefer localhost Ollama, then Hugging Face, then OpenAI.
  const ollamaHealth = await ollama.checkOllamaHealth();
  if (ollamaHealth.healthy) {
    activeProvider = PROVIDERS.OLLAMA;
    return activeProvider;
  }

  if (getHFClient()) {
    activeProvider = PROVIDERS.HUGGINGFACE;
    return activeProvider;
  }

  if (getOpenAIClient()) {
    activeProvider = PROVIDERS.OPENAI;
    return activeProvider;
  }

  activeProvider = PROVIDERS.OLLAMA;
  return activeProvider;
}

async function getChatClientAndModel() {
  await resolveProvider();
  if (activeProvider === PROVIDERS.HUGGINGFACE) {
    return { client: getHFClient(), model: HF_CHAT_MODEL, provider: activeProvider };
  }
  if (activeProvider === PROVIDERS.OPENAI) {
    return { client: getOpenAIClient(), model: OPENAI_CHAT_MODEL, provider: activeProvider };
  }
  return { client: null, model: null, provider: PROVIDERS.OLLAMA };
}

async function getEmbeddingClientAndModel() {
  await resolveProvider();
  if (activeProvider === PROVIDERS.HUGGINGFACE) {
    return { client: getHFClient(), model: HF_EMBED_MODEL, provider: activeProvider };
  }
  if (activeProvider === PROVIDERS.OPENAI) {
    return { client: getOpenAIClient(), model: OPENAI_EMBED_MODEL, provider: activeProvider };
  }
  return { client: null, model: null, provider: PROVIDERS.OLLAMA };
}

function parseJsonOrNull(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {}

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock?.[1]) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch (_) {}
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (_) {}
  }
  return null;
}

function normalizeToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/[^a-z\-]/g, '');
}

function mapIntentFromFillMask(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { label: 'Reflection', confidence: 0.5, reasoning: 'No fill-mask output' };
  }

  const buckets = {
    Problem: 0,
    Solution: 0,
    Reflection: 0
  };

  for (const item of items) {
    const token = normalizeToken(item.token_str || item.sequence);
    const score = Number(item.score || 0);

    if (['problem', 'issue', 'struggle', 'challenge', 'pain', 'stuck'].includes(token)) {
      buckets.Problem += score;
      continue;
    }

    if (['solution', 'answer', 'advice', 'approach', 'method', 'fix'].includes(token)) {
      buckets.Solution += score;
      continue;
    }

    if (['reflection', 'thought', 'feeling', 'journal', 'insight', 'pondering'].includes(token)) {
      buckets.Reflection += score;
    }
  }

  const ranked = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  const [label, bestScore] = ranked[0];
  const confidence = bestScore > 0 ? Math.min(1, Math.max(0.35, bestScore)) : 0.5;
  return { label, confidence, reasoning: 'Mapped from DeBERTa fill-mask predictions' };
}

function parseHFRerankScore(output) {
  if (typeof output === 'number') return Math.min(1, Math.max(0, output));

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];

    if (typeof first === 'number') {
      return Math.min(1, Math.max(0, first));
    }

    if (typeof first?.score === 'number') {
      const labels = output.map((item) => ({
        label: String(item.label || '').toLowerCase(),
        score: Number(item.score || 0)
      }));

      const positive = labels.find((l) =>
        ['label_1', 'relevant', 'entailment', 'true', 'yes', 'positive'].includes(l.label)
      );

      if (positive) return Math.min(1, Math.max(0, positive.score));
      return Math.min(1, Math.max(0, labels[0]?.score || 0.5));
    }
  }

  return 0.5;
}

function normalizeEmbeddingVector(result) {
  if (!result) return null;

  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) {
      return result[0].map((v) => Number(v));
    }
    return result.map((v) => Number(v));
  }

  if (ArrayBuffer.isView(result)) {
    return Array.from(result, Number);
  }

  return null;
}

async function hfChatCompletion(messages, options = {}) {
  const client = getHFClient();
  if (!client) return null;

  const { temperature = 0.7, maxTokens = 500 } = options;
  const response = await client.chatCompletion({
    model: HF_CHAT_MODEL,
    provider: HF_PROVIDER,
    messages,
    temperature,
    max_tokens: maxTokens
  });

  return response?.choices?.[0]?.message?.content || null;
}

async function chatCompletion(messages, options = {}) {
  const { temperature = 0.7, maxTokens = 500, responseFormat } = options;
  const providerInfo = await getChatClientAndModel();

  if (providerInfo.provider === PROVIDERS.OLLAMA) {
    return await ollama.chat(messages, { temperature, maxTokens });
  }

  if (providerInfo.provider === PROVIDERS.HUGGINGFACE) {
    return await hfChatCompletion(messages, { temperature, maxTokens, responseFormat });
  }

  const { client, model } = providerInfo;
  if (!client) return null;

  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  const response = await client.chat.completions.create(payload);
  return response?.choices?.[0]?.message?.content || null;
}

export async function initializeAI() {
  const provider = await resolveProvider();
  const health = await checkAIHealth();

  if (provider === PROVIDERS.OLLAMA) {
    console.log('✅ Using Ollama for AI:', (health.ollama?.models || []).join(', '));
  } else if (provider === PROVIDERS.HUGGINGFACE) {
    console.log(`✅ Using Hugging Face for AI (${HF_CHAT_MODEL})`);
  } else {
    console.log(`✅ Using OpenAI for AI (${OPENAI_CHAT_MODEL})`);
  }

  return { provider, ...health };
}

export async function checkAIHealth() {
  const requested = normalizeProvider(configuredProvider);
  const ollamaHealth = await ollama.checkOllamaHealth();
  let hfHealthy = false;
  let openaiHealthy = false;

  try {
    hfHealthy = !!getHFClient();
  } catch (_) {
    hfHealthy = false;
  }

  try {
    openaiHealthy = !!getOpenAIClient();
  } catch (_) {
    openaiHealthy = false;
  }

  await resolveProvider();

  return {
    healthy:
      activeProvider === PROVIDERS.OLLAMA
        ? ollamaHealth.healthy
        : activeProvider === PROVIDERS.HUGGINGFACE
        ? hfHealthy
        : openaiHealthy,
    requestedProvider: requested,
    activeProvider,
    ollama: ollamaHealth,
    huggingface: {
      healthy: hfHealthy,
      provider: HF_PROVIDER,
      intentModel: HF_INTENT_MODEL,
      embedModel: HF_EMBED_MODEL,
      rerankModel: HF_RERANK_MODEL,
      chatModel: HF_CHAT_MODEL,
      asrModel: HF_ASR_MODEL
    },
    openai: {
      healthy: openaiHealthy,
      chatModel: OPENAI_CHAT_MODEL,
      embedModel: OPENAI_EMBED_MODEL
    }
  };
}

export async function generateEmbedding(text) {
  const providerInfo = await getEmbeddingClientAndModel();

  if (providerInfo.provider === PROVIDERS.OLLAMA) {
    const embedding = await ollama.generateEmbedding(text);
    if (embedding) return embedding;
    return null;
  }

  if (providerInfo.provider === PROVIDERS.HUGGINGFACE) {
    try {
      const output = await providerInfo.client.featureExtraction({
        model: HF_EMBED_MODEL,
        provider: HF_PROVIDER,
        inputs: text.slice(0, 8000)
      });
      return normalizeEmbeddingVector(output);
    } catch (error) {
      console.error('Hugging Face embedding error:', error.message);
      return null;
    }
  }

  const { client, model } = providerInfo;
  if (!client) return null;

  try {
    const response = await client.embeddings.create({
      model,
      input: text.slice(0, 8000),
      dimensions: 1024
    });
    return response.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Embedding error:', error.message);
    return null;
  }
}

export async function analyzeSentiment(text) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.analyzeSentiment(text);
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content: `Analyze the sentiment of this journal entry. Return JSON only:\n{\n  "score": <number from -1 (very negative) to 1 (very positive)>,\n  "mood": "<one of: hopeful, anxious, reflective, frustrated, grateful, confused, determined, melancholic>"\n}`
        },
        { role: 'user', content: text.slice(0, 4000) }
      ],
      { temperature: 0.3 }
    );

    const parsed = parseJsonOrNull(content);
    if (parsed && typeof parsed.score === 'number' && parsed.mood) return parsed;
  } catch (error) {
    console.error('Sentiment analysis error:', error.message);
  }

  return { score: 0, mood: 'reflective' };
}

export async function classifyIntent(text) {
  await resolveProvider();

  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.classifyIntent(text);
  }

  if (activeProvider === PROVIDERS.HUGGINGFACE) {
    try {
      const outputs = await getHFClient().fillMask({
        model: HF_INTENT_MODEL,
        provider: HF_PROVIDER,
        inputs: `This journal entry is mostly about [MASK].\n\n${text.slice(0, 1200)}`
      });

      const mapped = mapIntentFromFillMask(outputs);
      if (mapped) return mapped;
    } catch (error) {
      console.error('HF intent classification error:', error.message);
    }
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content: `Classify this journal entry's primary intent. Return JSON only:\n{\n  "label": "Problem" | "Solution" | "Reflection",\n  "confidence": <number 0-1>,\n  "reasoning": "<brief 10-word explanation>"\n}\n\nDefinitions:\n- Problem: User is struggling, seeking help, describing a challenge, venting frustration\n- Solution: User is documenting a framework, lesson learned, advice, or successful approach\n- Reflection: User is exploring thoughts, wondering, philosophizing without clear problem/solution`
        },
        { role: 'user', content: text.slice(0, 4000) }
      ],
      { temperature: 0.3 }
    );

    const parsed = parseJsonOrNull(content);
    if (parsed && ['Problem', 'Solution', 'Reflection'].includes(parsed.label)) {
      return {
        label: parsed.label,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || 'Classified by AI'
      };
    }
  } catch (error) {
    console.error('Intent classification error:', error.message);
  }

  return { label: 'Reflection', confidence: 0.5, reasoning: 'Classification failed' };
}

export async function extractThemes(text) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.extractThemes(text);
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content: `Extract 2-5 key themes from this journal entry. Return JSON only:\n{\n  "themes": ["theme1", "theme2", ...]\n}\nThemes should be concise (1-3 words), e.g., "career transition", "burnout", "relationships", "self-doubt", "personal growth".`
        },
        { role: 'user', content: text.slice(0, 4000) }
      ],
      { temperature: 0.3 }
    );

    const parsed = parseJsonOrNull(content);
    if (Array.isArray(parsed?.themes)) return parsed.themes.slice(0, 5);
  } catch (error) {
    console.error('Theme extraction error:', error.message);
  }

  return [];
}

export async function generateFollowUp(text, intent) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateFollowUp(text, intent);
  }

  try {
    return await chatCompletion(
      [
        {
          role: 'system',
          content: `You are "The Guide" - a warm, thoughtful AI companion in a journaling app.\nThe user's entry was classified as "${intent.label}" with low confidence (${intent.confidence}).\nAsk ONE gentle follow-up question to help clarify their intent.\nKeep it brief (1-2 sentences), supportive, and open-ended.`
        },
        { role: 'user', content: text.slice(0, 2000) }
      ],
      { temperature: 0.7, maxTokens: 200 }
    );
  } catch (error) {
    console.error('Follow-up generation error:', error.message);
    return null;
  }
}

export async function generateBridgeMessage(problemEntry, solutionEntry) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateBridgeMessage(problemEntry, solutionEntry);
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are the AI Mediator introducing two users who might help each other.\nWrite a warm, contextual introduction (2-3 sentences).\nDo not reveal private details, names, or identifiable info.`
        },
        {
          role: 'user',
          content: `Problem entry themes: ${problemEntry.themes?.join(', ') || 'general'}\nProblem mood: ${problemEntry.sentiment?.mood || 'neutral'}\n\nSolution entry themes: ${solutionEntry.themes?.join(', ') || 'general'}\nSolution mood: ${solutionEntry.sentiment?.mood || 'neutral'}`
        }
      ],
      { temperature: 0.7, maxTokens: 220 }
    );
    return content || 'You both seem to be exploring similar thoughts. This might be a meaningful connection!';
  } catch (error) {
    console.error('Bridge message error:', error.message);
    return 'You both seem to be exploring similar thoughts. This might be a meaningful connection!';
  }
}

export async function generateWingmanMessage(problemEntry, solutionEntry, context = 'opener') {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateWingmanMessage(problemEntry, solutionEntry, context);
  }

  const prompts = {
    opener: 'You are the AI "Social Wingman" facilitating a conversation between two users. Generate a warm opening message (2-3 sentences) with collaborative tone.',
    stuck: 'The conversation has stalled. Suggest one thoughtful question to re-engage them.',
    deepen: 'The conversation is going well. Suggest a way to deepen discussion.'
  };

  try {
    const sharedThemes = problemEntry.themes?.filter((t) => solutionEntry.themes?.includes(t)) || [];
    const content = await chatCompletion(
      [
        { role: 'system', content: prompts[context] || prompts.opener },
        {
          role: 'user',
          content: `Shared themes: ${sharedThemes.join(', ') || 'personal growth'}\nProblem mood: ${problemEntry.sentiment?.mood || 'neutral'}\nSolution mood: ${solutionEntry.sentiment?.mood || 'neutral'}`
        }
      ],
      { temperature: 0.7, maxTokens: 220 }
    );

    return content || 'Welcome to your conversation! Feel free to share openly.';
  } catch (error) {
    console.error('Wingman message error:', error.message);
    return 'Welcome to your conversation! Feel free to share openly.';
  }
}

export async function transcribeAudio(buffer, mimeType) {
  await resolveProvider();

  if (activeProvider === PROVIDERS.HUGGINGFACE) {
    const client = getHFClient();
    if (!client) {
      throw new Error('No Hugging Face token configured (set HF_TOKEN)');
    }

    try {
      const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
      const transcript = await client.automaticSpeechRecognition({
        model: HF_ASR_MODEL,
        provider: HF_PROVIDER,
        data: blob
      });

      if (typeof transcript === 'string') return transcript;
      return transcript?.text || '';
    } catch (error) {
      console.error('Hugging Face transcription error:', error.message);
      throw error;
    }
  }

  const transcriptionClient = getOpenAIClient();
  if (!transcriptionClient) {
    throw new Error('No transcription backend configured (set HF_TOKEN or OPENAI_API_KEY)');
  }

  try {
    const ext = mimeType?.includes('webm')
      ? 'webm'
      : mimeType?.includes('mp3')
      ? 'mp3'
      : mimeType?.includes('mp4')
      ? 'm4a'
      : 'wav';

    const file = new File([buffer], `audio.${ext}`, { type: mimeType });
    const response = await transcriptionClient.audio.transcriptions.create({
      file,
      model: process.env.AUDIO_TRANSCRIBE_MODEL || 'whisper-1',
      language: 'en',
      response_format: 'text'
    });
    return response;
  } catch (error) {
    console.error('Transcription error:', error.message);
    throw error;
  }
}

export async function chat(messages, options = {}) {
  const { temperature = 0.7, maxTokens = 500 } = options;
  try {
    return await chatCompletion(messages, { temperature, maxTokens });
  } catch (error) {
    console.error('Chat error:', error.message);
    return null;
  }
}

export async function generateGhostText(currentText, cursorContext = '') {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateGhostText(currentText, cursorContext);
  }

  if (!currentText || currentText.length < 20) return null;
  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You are helping someone write a journal entry. Suggest a natural continuation (one short sentence or phrase). Return only the continuation text.'
        },
        { role: 'user', content: currentText.slice(-500) }
      ],
      { temperature: 0.8, maxTokens: 60 }
    );
    if (!content) return null;
    const cleaned = content.trim().replace(/^["']|["']$/g, '');
    return cleaned.length > 0 && cleaned.length < 200 ? cleaned : null;
  } catch (error) {
    console.error('Ghost text error:', error.message);
    return null;
  }
}

export async function generateOnboardingQuestion(stage, previousAnswers = {}) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateOnboardingQuestion(stage, previousAnswers);
  }

  const prompts = {
    welcome:
      'You are "The Guide", a warm AI companion. Ask one friendly opening onboarding question about what brings them to Open Journal.',
    values: `Based on this prior answer, ask one conversational question about their core values:\n${previousAnswers.welcome || 'They just joined.'}`,
    challenges: `Ask one empathetic question about current life challenges or areas they want to explore:\n${JSON.stringify(previousAnswers)}`,
    goals: `Ask one encouraging question about what they hope to discover through journaling:\n${JSON.stringify(previousAnswers)}`,
    summary: `Create a warm 2-3 sentence summary acknowledging their answers, then say you are excited to be their journaling companion:\n${JSON.stringify(previousAnswers)}`
  };

  try {
    return await chatCompletion([{ role: 'system', content: prompts[stage] || prompts.welcome }], {
      temperature: 0.8,
      maxTokens: 170
    });
  } catch (error) {
    console.error('Onboarding generation error:', error.message);
    return null;
  }
}

export async function rerankMatches(problemEntry, candidateSolutions) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.rerankMatches(problemEntry, candidateSolutions);
  }

  if (!candidateSolutions || candidateSolutions.length === 0) return [];

  if (activeProvider === PROVIDERS.HUGGINGFACE) {
    const client = getHFClient();
    const scored = [];

    for (const solution of candidateSolutions.slice(0, 20)) {
      try {
        const output = await client.textClassification({
          model: HF_RERANK_MODEL,
          provider: HF_PROVIDER,
          inputs: `query: ${problemEntry.content?.slice(0, 500) || 'General challenge'}\npassage: ${solution.content?.slice(0, 500) || 'General advice'}`
        });

        const rerankScore = parseHFRerankScore(output);
        scored.push({
          ...solution,
          rerankScore,
          combinedScore: (solution.similarity || 0.5) * 0.4 + rerankScore * 0.6
        });
      } catch (error) {
        console.error('HF rerank item error:', error.message);
        scored.push({
          ...solution,
          rerankScore: 0.5,
          combinedScore: (solution.similarity || 0.5) * 0.4 + 0.3
        });
      }
    }

    return scored.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  const scoredCandidates = [];
  for (const solution of candidateSolutions.slice(0, 10)) {
    try {
      const content = await chatCompletion(
        [
          {
            role: 'system',
            content: 'Rate how well this Solution addresses the Problem on a 0-100 scale. Return only the number.'
          },
          {
            role: 'user',
            content: `PROBLEM:\n${problemEntry.content?.slice(0, 500) || 'General challenge'}\nThemes: ${problemEntry.themes?.join(', ') || 'general'}\n\nSOLUTION:\n${solution.content?.slice(0, 500) || 'General advice'}\nThemes: ${solution.themes?.join(', ') || 'general'}`
          }
        ],
        { temperature: 0.1, maxTokens: 10 }
      );

      const scoreMatch = content?.match(/\d+/);
      const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[0], 10))) : 50;
      scoredCandidates.push({
        ...solution,
        rerankScore: score / 100,
        combinedScore: (solution.similarity || 0.5) * 0.4 + (score / 100) * 0.6
      });
    } catch (error) {
      console.error('Rerank item error:', error.message);
      scoredCandidates.push({
        ...solution,
        rerankScore: 0.5,
        combinedScore: (solution.similarity || 0.5) * 0.4 + 0.3
      });
    }
  }

  return scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);
}

export async function generateEntrySummary(entry) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateEntrySummary(entry);
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'Create a brief privacy-preserving summary (1-2 sentences) without specific details, names, or identifiers.'
        },
        {
          role: 'user',
          content: `Entry themes: ${entry.themes?.join(', ') || 'general'}\nMood: ${entry.sentiment?.mood || 'reflective'}\nType: ${entry.intentLabel || 'reflection'}\nContent preview: ${entry.content?.slice(0, 300)}`
        }
      ],
      { temperature: 0.5, maxTokens: 120 }
    );
    return (
      content ||
      `A ${entry.sentiment?.mood || 'thoughtful'} ${entry.intentLabel?.toLowerCase() || 'reflection'} about ${entry.themes?.[0] || 'life'}.`
    );
  } catch (error) {
    console.error('Entry summary error:', error.message);
    return `A ${entry.sentiment?.mood || 'thoughtful'} ${entry.intentLabel?.toLowerCase() || 'reflection'} about ${entry.themes?.[0] || 'life'}.`;
  }
}

export async function generateMatchExplanation(entry1, entry2) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateMatchExplanation(entry1, entry2);
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'Explain in simple warm terms (2-3 sentences) why two entries were matched based on shared themes and potential mutual support.'
        },
        {
          role: 'user',
          content: `Entry 1 themes: ${entry1.themes?.join(', ') || 'general'}\nEntry 1 type: ${entry1.intentLabel || 'reflection'}\nEntry 1 mood: ${entry1.sentiment?.mood || 'neutral'}\n\nEntry 2 themes: ${entry2.themes?.join(', ') || 'general'}\nEntry 2 type: ${entry2.intentLabel || 'reflection'}\nEntry 2 mood: ${entry2.sentiment?.mood || 'neutral'}`
        }
      ],
      { temperature: 0.6, maxTokens: 170 }
    );
    return content || 'You both seem to be exploring similar ideas. This connection might offer valuable perspective.';
  } catch (error) {
    console.error('Match explanation error:', error.message);
    return 'You both seem to be exploring similar ideas. This connection might offer valuable perspective.';
  }
}

export async function generateCircleWelcome(name, topic, themes) {
  await resolveProvider();
  if (activeProvider === PROVIDERS.OLLAMA) {
    return await ollama.generateCircleWelcome(name, topic, themes);
  }

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'Write a warm, inclusive 2-3 sentence welcome message for a group discussion. Encourage sharing openly.'
        },
        {
          role: 'user',
          content: `Circle name: ${name}\nTopic: ${topic}\nThemes: ${themes?.join(', ') || 'general discussion'}`
        }
      ],
      { temperature: 0.7, maxTokens: 170 }
    );
    return (
      content ||
      `Welcome to "${name}"! This is a supportive space to explore ${topic} together. Feel free to share your thoughts and experiences.`
    );
  } catch (error) {
    console.error('Circle welcome error:', error.message);
    return `Welcome to "${name}"! This is a supportive space to explore ${topic} together. Feel free to share your thoughts and experiences.`;
  }
}

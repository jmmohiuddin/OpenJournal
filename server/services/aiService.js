// AI Service - Uses Ollama (local) by default, OpenAI as fallback
import * as ollama from './ollamaService.js';
import OpenAI from 'openai';

let openai = null;
let useOllama = true; // Default to local Ollama

const getOpenAI = () => {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

// Check and set AI backend on startup
export async function initializeAI() {
  const health = await ollama.checkOllamaHealth();
  if (health.healthy) {
    console.log('✅ Using Ollama for AI:', health.models.join(', '));
    useOllama = true;
  } else {
    console.log('⚠️  Ollama not available, falling back to OpenAI');
    useOllama = false;
  }
  return { useOllama, ollamaModels: health.models || [] };
}

// Generate embedding
export async function generateEmbedding(text) {
  if (useOllama) {
    const embedding = await ollama.generateEmbedding(text);
    if (embedding) return embedding;
  }
  
  // Fallback to OpenAI
  const client = getOpenAI();
  if (!client) {
    console.warn('No AI backend available for embeddings');
    return null;
  }

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
      dimensions: 1024
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding error:', error.message);
    return null;
  }
}

// Analyze sentiment
export async function analyzeSentiment(text) {
  if (useOllama) {
    return await ollama.analyzeSentiment(text);
  }
  
  const client = getOpenAI();
  if (!client) {
    return { score: 0, mood: 'reflective' };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze the sentiment of this journal entry. Return JSON only:
{
  "score": <number from -1 (very negative) to 1 (very positive)>,
  "mood": "<one of: hopeful, anxious, reflective, frustrated, grateful, confused, determined, melancholic>"
}`
        },
        { role: 'user', content: text.slice(0, 4000) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Sentiment analysis error:', error.message);
    return { score: 0, mood: 'reflective' };
  }
}

// Classify intent as Problem, Solution, or Reflection
export async function classifyIntent(text) {
  if (useOllama) {
    return await ollama.classifyIntent(text);
  }
  
  const client = getOpenAI();
  if (!client) {
    return { label: 'Reflection', confidence: 0.5, reasoning: 'AI not configured' };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify this journal entry's primary intent. Return JSON only:
{
  "label": "Problem" | "Solution" | "Reflection",
  "confidence": <number 0-1>,
  "reasoning": "<brief 10-word explanation>"
}

Definitions:
- Problem: User is struggling, seeking help, describing a challenge, venting frustration
- Solution: User is documenting a framework, lesson learned, advice, or successful approach  
- Reflection: User is exploring thoughts, wondering, philosophizing without clear problem/solution`
        },
        { role: 'user', content: text.slice(0, 4000) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Intent classification error:', error.message);
    return { label: 'Reflection', confidence: 0.5, reasoning: 'Classification failed' };
  }
}

// Extract key themes
export async function extractThemes(text) {
  if (useOllama) {
    return await ollama.extractThemes(text);
  }
  
  const client = getOpenAI();
  if (!client) {
    return [];
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract 2-5 key themes from this journal entry. Return JSON only:
{
  "themes": ["theme1", "theme2", ...]
}
Themes should be concise (1-3 words), e.g., "career transition", "burnout", "relationships", "self-doubt", "personal growth"`
        },
        { role: 'user', content: text.slice(0, 4000) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.themes || [];
  } catch (error) {
    console.error('Theme extraction error:', error.message);
    return [];
  }
}

// Generate follow-up question for low-confidence entries
export async function generateFollowUp(text, intent) {
  if (useOllama) {
    return await ollama.generateFollowUp(text, intent);
  }
  
  const client = getOpenAI();
  if (!client) {
    return null;
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are "The Guide" - a warm, thoughtful AI companion in a journaling app.
The user's entry was classified as "${intent.label}" with low confidence (${intent.confidence}).
Ask ONE gentle follow-up question to help clarify their intent.
Keep it brief (1-2 sentences), supportive, and open-ended.`
        },
        { role: 'user', content: text.slice(0, 2000) }
      ],
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Follow-up generation error:', error.message);
    return null;
  }
}

// Generate bridge message for a match
export async function generateBridgeMessage(problemEntry, solutionEntry) {
  if (useOllama) {
    return await ollama.generateBridgeMessage(problemEntry, solutionEntry);
  }
  
  const client = getOpenAI();
  if (!client) {
    return 'You both seem to be thinking about similar topics. Perhaps you could help each other!';
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the AI Mediator introducing two users who might help each other.
One user has a problem, another has documented a solution that might help.
Write a warm, contextual introduction (2-3 sentences) that:
1. Acknowledges the shared theme without revealing private details
2. Explains why this connection might be valuable
3. Encourages them to connect

Do NOT include names or specific personal details. Be encouraging but not overly enthusiastic.`
        },
        {
          role: 'user',
          content: `Problem entry themes: ${problemEntry.themes?.join(', ') || 'general'}
Problem sentiment: ${problemEntry.sentiment?.mood || 'neutral'}

Solution entry themes: ${solutionEntry.themes?.join(', ') || 'general'}  
Solution sentiment: ${solutionEntry.sentiment?.mood || 'neutral'}`
        }
      ],
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Bridge message error:', error.message);
    return 'You both seem to be exploring similar thoughts. This might be a meaningful connection!';
  }
}

// Generate AI wingman message for chat
export async function generateWingmanMessage(problemEntry, solutionEntry, context = 'opener') {
  if (useOllama) {
    return await ollama.generateWingmanMessage(problemEntry, solutionEntry, context);
  }
  
  const client = getOpenAI();
  if (!client) {
    return 'Welcome! Feel free to share your thoughts with each other.';
  }

  const prompts = {
    opener: `You are the AI "Social Wingman" facilitating a conversation between two users.
One user (the Seeker) wrote about a challenge. Another (the Sage) documented wisdom that might help.
Generate a warm opening message that:
1. Sets a collaborative, supportive tone
2. Suggests specific aspects they might explore together
3. Keeps it brief (2-3 sentences)

Do NOT reveal specific details from their entries.`,
    
    stuck: `The conversation seems to have stalled. Suggest a thoughtful question or talking point to re-engage them.
Keep it natural and relevant to their shared themes.`,
    
    deepen: `The conversation is going well. Suggest a way to deepen the discussion.
Perhaps a question that explores root causes or long-term implications.`
  };

  try {
    const sharedThemes = problemEntry.themes?.filter(t => 
      solutionEntry.themes?.includes(t)
    ) || [];

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompts[context] || prompts.opener },
        { 
          role: 'user', 
          content: `Shared themes: ${sharedThemes.join(', ') || 'personal growth'}
Problem mood: ${problemEntry.sentiment?.mood || 'neutral'}
Solution mood: ${solutionEntry.sentiment?.mood || 'neutral'}

Generate the wingman message.`
        }
      ],
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Wingman message error:', error.message);
    return 'Welcome to your conversation! Feel free to share openly—this is a safe space for mutual support.';
  }
}

// Transcribe audio using OpenAI Whisper API
export async function transcribeAudio(buffer, mimeType) {
  const client = getOpenAI();
  if (!client) {
    throw new Error('OpenAI API key required for transcription');
  }
  
  try {
    // Convert buffer to File-like object for OpenAI SDK
    const ext = mimeType.includes('webm') ? 'webm' : 
                mimeType.includes('mp3') ? 'mp3' : 
                mimeType.includes('mp4') ? 'm4a' : 'wav';
    
    const file = new File([buffer], `audio.${ext}`, { type: mimeType });
    
    const response = await client.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });
    
    return response;
  } catch (error) {
    console.error('Whisper transcription error:', error.message);
    throw error;
  }
}

// Re-export Ollama-specific functions for new features
export const generateGhostText = ollama.generateGhostText;
export const generateOnboardingQuestion = ollama.generateOnboardingQuestion;
export const rerankMatches = ollama.rerankMatches;
export const generateEntrySummary = ollama.generateEntrySummary;
export const generateMatchExplanation = ollama.generateMatchExplanation;
export const checkOllamaHealth = ollama.checkOllamaHealth;
export const generateCircleWelcome = ollama.generateCircleWelcome;

// Ollama-based AI Service - Local AI for Open Journal
import fetch from 'node-fetch';

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:7b';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'qwen2.5:7b';

// Helper: Call Ollama generate endpoint
async function ollamaGenerate(prompt, options = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || CHAT_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.3,
          num_predict: options.maxTokens || 500
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama generate error:', error.message);
    return null;
  }
}

// Helper: Parse JSON from LLM response (handles markdown code blocks)
function parseJsonResponse(text) {
  if (!text) return null;
  
  // Try to extract JSON from code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {}
  }
  
  // Try direct parse
  try {
    return JSON.parse(text.trim());
  } catch (e) {}
  
  // Try to find JSON object in response
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (e) {}
  }
  
  return null;
}

// Helper: Chat with messages format (supports multi-turn)
export async function chat(messages, options = {}) {
  try {
    // Convert messages to simple prompt format for Ollama
    let prompt = '';
    for (const msg of messages) {
      if (msg.role === 'system') {
        prompt += `System: ${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    }
    prompt += 'Assistant: ';

    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || CHAT_MODEL,
        prompt: prompt.trim(),
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 500
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama chat error:', error.message);
    return null;
  }
}

// Generate embedding using Ollama
export async function generateEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text.slice(0, 8000)
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama embedding error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Embedding error:', error.message);
    return null;
  }
}

// Analyze sentiment
export async function analyzeSentiment(text) {
  const prompt = `Analyze the sentiment of this journal entry. Return ONLY valid JSON, no other text:
{
  "score": <number from -1 (very negative) to 1 (very positive)>,
  "mood": "<one of: hopeful, anxious, reflective, frustrated, grateful, confused, determined, melancholic>"
}

Journal entry:
${text.slice(0, 3000)}

JSON response:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.3 });
  const parsed = parseJsonResponse(response);
  
  if (parsed && typeof parsed.score === 'number' && parsed.mood) {
    return parsed;
  }
  
  return { score: 0, mood: 'reflective' };
}

// Classify intent as Problem, Solution, or Reflection
export async function classifyIntent(text) {
  const prompt = `Classify this journal entry's primary intent. Return ONLY valid JSON, no other text:
{
  "label": "Problem" or "Solution" or "Reflection",
  "confidence": <number 0-1>,
  "reasoning": "<brief 10-word explanation>"
}

Definitions:
- Problem: User is struggling, seeking help, describing a challenge, venting frustration
- Solution: User is documenting a framework, lesson learned, advice, or successful approach  
- Reflection: User is exploring thoughts, wondering, philosophizing without clear problem/solution

Journal entry:
${text.slice(0, 3000)}

JSON response:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.3 });
  const parsed = parseJsonResponse(response);
  
  if (parsed && ['Problem', 'Solution', 'Reflection'].includes(parsed.label)) {
    return {
      label: parsed.label,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || 'Classified by local AI'
    };
  }
  
  return { label: 'Reflection', confidence: 0.5, reasoning: 'Classification uncertain' };
}

// Extract key themes
export async function extractThemes(text) {
  const prompt = `Extract 2-5 key themes from this journal entry. Return ONLY valid JSON array, no other text:
["theme1", "theme2", "theme3"]

Themes should be concise (1-3 words), e.g., "career transition", "burnout", "relationships", "self-doubt", "personal growth"

Journal entry:
${text.slice(0, 3000)}

JSON array:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.3 });
  const parsed = parseJsonResponse(response);
  
  if (Array.isArray(parsed)) {
    return parsed.filter(t => typeof t === 'string').slice(0, 5);
  }
  
  // Try to extract themes object
  if (parsed && Array.isArray(parsed.themes)) {
    return parsed.themes.filter(t => typeof t === 'string').slice(0, 5);
  }
  
  return [];
}

// Generate follow-up question for low-confidence entries
export async function generateFollowUp(text, intent) {
  const prompt = `You are "The Guide" - a warm, thoughtful AI companion in a journaling app.
The user's entry was classified as "${intent.label}" with low confidence (${intent.confidence.toFixed(2)}).
Ask ONE gentle follow-up question to help clarify their intent.
Keep it brief (1-2 sentences), supportive, and open-ended.

User's entry:
${text.slice(0, 2000)}

Your follow-up question:`;

  return await ollamaGenerate(prompt, { temperature: 0.7, maxTokens: 150 });
}

// Generate bridge message for a match
export async function generateBridgeMessage(problemEntry, solutionEntry) {
  const prompt = `You are the AI Mediator introducing two users who might help each other.
One user has a problem, another has documented a solution that might help.
Write a warm, contextual introduction (2-3 sentences) that:
1. Acknowledges the shared theme without revealing private details
2. Explains why this connection might be valuable
3. Encourages them to connect

Do NOT include names or specific personal details. Be encouraging but not overly enthusiastic.

Problem entry themes: ${problemEntry.themes?.join(', ') || 'general'}
Problem sentiment: ${problemEntry.sentiment?.mood || 'neutral'}

Solution entry themes: ${solutionEntry.themes?.join(', ') || 'general'}  
Solution sentiment: ${solutionEntry.sentiment?.mood || 'neutral'}

Introduction message:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.7, maxTokens: 200 });
  return response || 'You both seem to be exploring similar thoughts. This might be a meaningful connection!';
}

// Generate AI wingman message for chat
export async function generateWingmanMessage(problemEntry, solutionEntry, context = 'opener') {
  const prompts = {
    opener: `You are the AI "Social Wingman" facilitating a conversation between two users.
One user (the Seeker) wrote about a challenge. Another (the Sage) documented wisdom that might help.
Generate a warm opening message (2-3 sentences) that sets a collaborative, supportive tone.`,
    
    stuck: `The conversation has stalled. Suggest a thoughtful question to re-engage them.`,
    
    deepen: `The conversation is going well. Suggest a way to deepen the discussion.`
  };

  const sharedThemes = problemEntry.themes?.filter(t => 
    solutionEntry.themes?.includes(t)
  ) || [];

  const prompt = `${prompts[context] || prompts.opener}

Shared themes: ${sharedThemes.join(', ') || 'personal growth'}
Problem mood: ${problemEntry.sentiment?.mood || 'neutral'}
Solution mood: ${solutionEntry.sentiment?.mood || 'neutral'}

Generate the wingman message:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.7, maxTokens: 200 });
  return response || 'Welcome to your conversation! Feel free to share openly.';
}

// Ghost Canvas: Generate typing suggestion
export async function generateGhostText(currentText, cursorContext = '') {
  if (!currentText || currentText.length < 20) {
    return null;
  }

  const prompt = `You are helping someone write a journal entry. Based on what they've written, suggest a natural continuation (1 short sentence or phrase). 
Only return the suggested text, nothing else. Make it flow naturally from their writing.

What they've written so far:
${currentText.slice(-500)}

Natural continuation:`;

  const response = await ollamaGenerate(prompt, { 
    temperature: 0.8, 
    maxTokens: 50,
    model: 'llama3.2:3b'  // Use faster model for ghost text
  });
  
  if (response && response.length > 0 && response.length < 200) {
    // Clean up the response
    return response.trim().replace(/^["']|["']$/g, '');
  }
  
  return null;
}

// Onboarding: "The Guide" interview questions
export async function generateOnboardingQuestion(stage, previousAnswers = {}) {
  const stages = {
    welcome: `You are "The Guide", a warm AI companion starting an onboarding conversation.
Ask a friendly opening question about what brings them to Open Journal.
Be warm, curious, and non-intrusive. One question only.`,

    values: `Based on their response, ask about their core values or what matters most in life.
Previous: ${previousAnswers.welcome || 'They just joined'}
Be conversational, not clinical. One question.`,

    challenges: `Now gently ask about current life challenges or areas they want to explore.
Previous responses: ${JSON.stringify(previousAnswers)}
Be empathetic and supportive. One question.`,

    goals: `Ask what they hope to discover or achieve through reflective journaling.
Previous: ${JSON.stringify(previousAnswers)}
Be encouraging. One question.`,

    summary: `Based on their answers, create a warm summary (2-3 sentences) acknowledging who they are.
Then say you're excited to be their journaling companion.
Previous: ${JSON.stringify(previousAnswers)}`
  };

  const prompt = stages[stage] || stages.welcome;
  
  return await ollamaGenerate(prompt, { temperature: 0.8, maxTokens: 150 });
}

// Cross-encoder style reranking for Problem→Solution matching
export async function rerankMatches(problemEntry, candidateSolutions) {
  if (!candidateSolutions || candidateSolutions.length === 0) {
    return [];
  }

  // Score each candidate
  const scoredCandidates = [];
  
  for (const solution of candidateSolutions.slice(0, 10)) { // Limit to top 10
    const prompt = `Rate how well this Solution addresses the Problem on a scale of 0-100.
Consider: specificity, relevance, actionability, and empathy.
Return ONLY a number between 0 and 100.

PROBLEM (what they're struggling with):
${problemEntry.content?.slice(0, 500) || 'General challenge'}
Themes: ${problemEntry.themes?.join(', ') || 'general'}

SOLUTION (potential help):
${solution.content?.slice(0, 500) || 'General advice'}
Themes: ${solution.themes?.join(', ') || 'general'}

Score (0-100):`;

    const response = await ollamaGenerate(prompt, { 
      temperature: 0.1, 
      maxTokens: 10,
      model: 'llama3.2:3b'  // Use faster model
    });
    
    // Extract number from response
    const scoreMatch = response?.match(/\d+/);
    const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[0]))) : 50;
    
    scoredCandidates.push({
      ...solution,
      rerankScore: score / 100,
      combinedScore: (solution.similarity || 0.5) * 0.4 + (score / 100) * 0.6
    });
  }
  
  // Sort by combined score
  return scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);
}

// Differential Privacy: Generate summary without revealing details
export async function generateEntrySummary(entry) {
  const prompt = `Create a brief, privacy-preserving summary (1-2 sentences) of this journal entry.
Focus on the general theme/emotion without revealing specific details, names, or identifiable information.

Entry themes: ${entry.themes?.join(', ') || 'general'}
Mood: ${entry.sentiment?.mood || 'reflective'}
Type: ${entry.intentLabel || 'reflection'}

Content preview (for context only):
${entry.content?.slice(0, 300)}

Privacy-safe summary:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.5, maxTokens: 100 });
  return response || `A ${entry.sentiment?.mood || 'thoughtful'} ${entry.intentLabel?.toLowerCase() || 'reflection'} about ${entry.themes?.[0] || 'life'}.`;
}

// Generate explanation for why users were matched
export async function generateMatchExplanation(entry1, entry2) {
  const prompt = `Explain in simple terms (2-3 sentences) why these two journal entries were matched.
Focus on shared themes and how they might help each other.
Be warm and encouraging, not clinical.

Entry 1 themes: ${entry1.themes?.join(', ') || 'general'}
Entry 1 type: ${entry1.intentLabel || 'reflection'}
Entry 1 mood: ${entry1.sentiment?.mood || 'neutral'}

Entry 2 themes: ${entry2.themes?.join(', ') || 'general'}
Entry 2 type: ${entry2.intentLabel || 'reflection'}
Entry 2 mood: ${entry2.sentiment?.mood || 'neutral'}

Explanation:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.6, maxTokens: 150 });
  return response || 'You both seem to be exploring similar ideas. This connection might offer valuable perspective.';
}

// Check if Ollama is running
export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        models: data.models?.map(m => m.name) || []
      };
    }
    return { healthy: false, error: 'Ollama not responding' };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

// Generate welcome message for a Thought Circle
export async function generateCircleWelcome(name, topic, themes) {
  const prompt = `You are facilitating a group discussion called "${name}" about: ${topic}
Themes: ${themes.join(', ') || 'general discussion'}

Write a warm, welcoming 2-3 sentence opening message that:
1. Sets an inclusive, supportive tone
2. Encourages members to share openly
3. Mentions the shared interest area

Welcome message:`;

  const response = await ollamaGenerate(prompt, { temperature: 0.7, maxTokens: 150 });
  return response || `Welcome to "${name}"! This is a supportive space to explore ${topic} together. Feel free to share your thoughts and experiences.`;
}

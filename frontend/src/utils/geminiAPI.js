// Google Gemini API integration for AI chatbot
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_ENABLED = GEMINI_API_KEY && process.env.REACT_APP_GEMINI_ENABLED !== 'false';

/**
 * Send a message to Google Gemini and get AI response
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Previous messages for context
 * @param {string} systemContext - Additional context about FPAs
 * @returns {Promise<string>} - The AI's response
 */
export async function getGeminiResponse(userMessage, conversationHistory = [], systemContext = '') {
  if (!GEMINI_ENABLED) {
    return 'AI assistant is not configured. Please set REACT_APP_GEMINI_API_KEY in your environment.';
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{
                text: `${systemContext ? systemContext + '\n\n' : ''}${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nUser: ${userMessage}`
              }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';
  } catch (error) {
    console.error('Gemini AI error:', error);
    return 'Sorry, I encountered an error connecting to the AI service. Please try again.';
  }
}

/**
 * Speak text using browser's Web Speech API
 * @param {string} text - Text to speak
 * @returns {void}
 */
export function speakText(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  window.speechSynthesis.speak(utterance);
}

/**
 * Check if Gemini configured
 */
export function isGeminiConfigured() {
  return GEMINI_ENABLED;
}

/**
 * Parse FPA command using Gemini AI - returns structured data
 * @param {string} userMessage - The user's natural language command
 * @param {Array} fpas - List of existing FPAs
 * @returns {Promise<Object>} - Structured command object
 */
export async function parseFPACommand(userMessage, fpas = []) {
  if (!GEMINI_ENABLED) {
    return {
      error: 'AI assistant is not configured. Please set REACT_APP_GEMINI_API_KEY.',
      useRuleBased: true
    };
  }

  try {
    // Use Gemini to parse command with structured prompt
    const prompt = `Parse this FPA management command into JSON. Available FPA numbers: ${fpas.map(f => f.fpaNumber).join(', ')}.

Command: "${userMessage}"

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "action": "create" | "update" | "filter" | "search" | "view",
  "fpaNumber": "string or null",
  "field": "string or null",
  "value": "string or null",
  "status": "string or null",
  "landownerType": "string or null"
}

Examples:
- "create fpa 12345" → {"action":"create","fpaNumber":"12345"}
- "update fpa 123 status to approved" → {"action":"update","fpaNumber":"123","field":"applicationStatus","value":"Approved"}
- "show approved fpas" → {"action":"filter","status":"Approved"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { error: 'Could not parse command', useRuleBased: true };
  } catch (error) {
    console.error('Gemini parse error:', error);
    return { error: error.message, useRuleBased: true };
  }
}

/**
 * Get FPA context summary for AI
 * @param {Array} fpas - List of FPAs
 * @returns {string}
 */
export function getFPAContext(fpas) {
  if (!fpas || fpas.length === 0) {
    return 'No FPAs are currently in the system.';
  }

  const statusCounts = fpas.reduce((acc, fpa) => {
    const status = fpa.applicationStatus || 'Unassigned';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const summary = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');

  return `The system has ${fpas.length} FPA(s): ${summary}.`;
}

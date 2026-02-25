// Quick test script for Gemini API
require('dotenv').config();

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'AIzaSyCjKqVrYMJCRumkNPNqBVioqFbNgvj6Gks';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function testGemini() {
  console.log('Testing Gemini API...');
  console.log('API Key present:', !!GEMINI_API_KEY);
  console.log('API Key (first 10 chars):', GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'MISSING');
  console.log('Model:', GEMINI_API_URL);

  if (!GEMINI_API_KEY) {
    console.error('❌ No API key found!');
    return;
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say hello in exactly 5 words.'
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 100,
        },
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API Error:', JSON.stringify(errorData, null, 2));
      
      if (response.status === 403) {
        console.error('❌ Invalid API key or permissions issue');
      } else if (response.status === 429) {
        console.error('❌ Rate limit exceeded');
      } else if (response.status === 404) {
        console.error('❌ Model not found - may need different model name or API key needs activation');
      }
      return;
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const aiResponse = data.candidates[0].content.parts[0].text;
      console.log('✅ Gemini API working!');
      console.log('Response:', aiResponse);
    } else {
      console.error('❌ Unexpected response format:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testGemini();

require('dotenv').config({ path: '../.env' });

// 3-strategy JSON parser
function parseAIJson(text) {
  // Strategy 1: direct parse
  try { return JSON.parse(text); } catch {}
  // Strategy 2: strip markdown fences
  try {
    const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(stripped);
  } catch {}
  // Strategy 3: find { to }
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
  } catch {}
  return null;
}

async function queryAI(systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const baseUrl = String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
      'X-Title': 'AI Public Health Epidemiology Tracker',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

module.exports = { queryAI, parseAIJson };

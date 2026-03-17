import https from 'https';

const MODEL = 'llama-3.3-70b-versatile';

function callGroq(apiKey, systemPrompt, userPrompt, maxTokens = 1000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    });
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.choices[0].message.content.trim());
        } catch (e) {
          reject(new Error('Failed to parse Groq response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  const { passage, questionType } = req.body;
  if (!passage || !questionType) {
    return res.status(400).json({ error: 'Missing passage or questionType' });
  }

  const system = `You are an expert SAT Reading & Writing question writer. You write questions IDENTICAL in structure and difficulty to real College Board SAT questions. Generate ONE question of the specified type.

QUESTION TYPES:
1. words_in_context — Remove one word from passage, replace with [BLANK], ask which word fits best
2. text_structure — Pick one sentence as "underlined", ask about its function
3. logical_completion — Ask what most logically completes/follows the text
4. command_of_evidence — Ask what the text directly states about something specific
5. transitions — Remove a transition word, replace with [BLANK], ask which fits
6. standard_english_conventions — Remove punctuation at a key point, replace with [BLANK], ask which conforms to Standard English
7. rhetorical_synthesis — Generate 4-5 bullet notes about the passage, give a student goal, ask which choice best accomplishes it
8. textual_evidence_quotation — Make a claim about the text, ask which quote best illustrates it

TRAP RULES — wrong answers must use real SAT traps:
- Opposite trap: reverses what the text says
- Also-true trap: true detail but doesn't answer the question
- Too extreme: uses always/never when text doesn't support it
- Out of scope: plausible but not in the text

EXPLANATION — must:
1. Name the SAT strategy (e.g. "Words in Context — Predict and Match")
2. Explain why correct answer is right using specific text evidence
3. Name the trap in each wrong answer
4. End with one transferable SAT tip

Respond ONLY with valid JSON, no markdown:
{
  "type": "question_type",
  "modified_passage": "passage with [BLANK] or null",
  "notes": ["bullet 1", ...] or null,
  "underlined": "sentence or null",
  "question": "question stem",
  "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "A",
  "explanation": "full SAT explanation"
}`;

  const user = `Passage from "${passage.title}" by ${passage.author} (${passage.year}):\n\n${passage.text}\n\nGenerate a "${questionType}" question.`;

  try {
    const raw = await callGroq(apiKey, system, user, 1000);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const question = JSON.parse(cleaned);
    return res.status(200).json(question);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
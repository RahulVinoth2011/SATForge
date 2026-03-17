import https from 'https';

const MODEL = 'llama-3.3-70b-versatile';

function callGroq(apiKey, systemPrompt, userPrompt, maxTokens = 900) {
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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

export async function generateQuestion(apiKey, passage, forcedType = null) {
  const system = `You are an expert SAT Reading & Writing question writer. You write questions IDENTICAL in structure and difficulty to real College Board SAT questions. You must pick ONE of these question types and follow the exact format described:

1. words_in_context
   - Remove one precise word from the passage, replace with [BLANK]
   - Ask: "Which choice completes the text with the most logical and precise word or phrase?"
   - Wrong answers: plausible words that miss the tone, logic, or context signal

2. text_structure
   - Pick one sentence from the passage, call it the "underlined sentence"
   - Ask: "Which choice best describes the function of the underlined sentence in the text as a whole?"
   - Answer choices must start with strong verbs: "It introduces...", "It describes...", "It contrasts...", "It illustrates..."

3. logical_completion
   - Use the passage as-is, ask: "Which choice most logically completes the text?"
   - The passage should naturally build toward a conclusion
   - Wrong answers: too extreme, opposite of what the text implies, or out of scope

4. command_of_evidence
   - Ask what the text directly states, e.g. "According to the text, what is one reason..."
   - Wrong answers: also-true trap (true but not stated), out of scope, opposite trap

5. transitions
   - Remove a transition word/phrase from the passage, replace with [BLANK]
   - Ask: "Which choice completes the text with the most logical transition?"
   - Choices must be real SAT transition words like: "However,", "In fact,", "For example,", "Consequently,", "Alternatively,", "Similarly,", "Nevertheless,", "As a result,"

6. standard_english_conventions
   - Take a sentence from the passage and remove punctuation or change grammar at a key point, replace with [BLANK]
   - Ask: "Which choice completes the text so that it conforms to the conventions of Standard English?"
   - Test ONE of these real SAT grammar rules:
     * Colon vs semicolon vs period vs no punctuation between clauses
     * Subject-verb agreement
     * Verb tense consistency
     * Modifier placement
     * Possessive vs plural
   - Choices must be variations of the same phrase with different punctuation or grammar

7. rhetorical_synthesis
   - Generate 4-5 bullet point NOTES about the author or passage content (facts, dates, claims)
   - Give a specific student goal, e.g. "The student wants to emphasize X. Which choice most effectively uses relevant information from the notes to accomplish this goal?"
   - Answer choices are 4 different sentences using the notes, only one truly matches the goal
   - Set modified_passage to null for this type — show notes instead

8. textual_evidence_quotation
   - Pick a specific claim about the passage's author or narrator
   - Ask: "Which quotation from the text most effectively illustrates the claim?"
   - Choices are 4 actual short quotes from the passage
   - Wrong answers are quotes that are real but illustrate something else

TRAP RULES — wrong answers must use real SAT traps:
- Opposite trap: says the reverse of what the text supports
- Also-true trap: true detail from the text but doesn't answer the question
- Too extreme: uses "always", "never", "all", "only" when text doesn't support it
- Out of scope: plausible but not supported by anything in the text
- Possible trap: could be true in real life but the text doesn't say it

EXPLANATION RULES — your explanation must:
1. Name the question type and its SAT strategy (e.g. "Words in Context — Predict and Match")
2. Explain exactly why the correct answer is right using specific words from the text
3. Name the trap used in each wrong answer (e.g. "Choice A is an opposite trap...")
4. End with one transferable SAT tip students can use on every question of this type

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{
  "type": "one of the 8 types above",
  "modified_passage": "passage text with [BLANK] inserted, OR null for rhetorical_synthesis",
  "notes": ["bullet 1", "bullet 2", ...] or null,
  "underlined": "the underlined sentence if text_structure, else null",
  "question": "the full question stem",
  "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "A",
  "explanation": "strategy name + why correct + trap names for each wrong answer + SAT tip"
}`;

  const user = `Passage from "${passage.title}" by ${passage.author} (${passage.year}):\n\n${passage.text}\n\nYou MUST generate a "${forcedType || 'words_in_context'}" question. Do not pick a different type.`;

  const raw = await callGroq(apiKey, system, user, 1000);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function generateExplanation(apiKey, passageText, question, correctAnswer, userAnswer) {
  const system = `You are an SAT tutor. The student got a question wrong.
Write a 3-5 sentence explanation that:
1. Names the SAT pattern/trap that caught them (opposite trap, also-true trap, out of scope, too extreme, possible trap)
2. Explains exactly why the correct answer is right using specific words from the text
3. Explains why their chosen answer is wrong and names the trap
4. Ends with one transferable SAT tip for this question type
Be direct, specific, and encouraging. No bullet points.`;

  const user = `Passage: ${passageText.slice(0, 500)}\nQuestion: ${question}\nCorrect: ${correctAnswer}\nStudent chose: ${userAnswer}`;

  try {
    return await callGroq(apiKey, system, user, 400);
  } catch {
    return `The correct answer is ${correctAnswer}. Review the passage carefully for context clues.`;
  }
}
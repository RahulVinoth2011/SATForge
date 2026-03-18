import https from 'https';

const MODEL = 'llama-3.3-70b-versatile';

function callGroq(apiKey, systemPrompt, userPrompt, maxTokens = 800) {
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

const SYSTEM_PROMPT = `You are a College Board SAT question writer. You write REAL SAT Reading & Writing questions.

Study these REAL SAT question examples carefully and replicate their EXACT style, difficulty, and structure:

EXAMPLE — words_in_context:
Original passage: "...some analysts predicted that revenues will more than double by 2028."
Modified passage (what you output as modified_passage): "...some analysts _______ that revenues will more than double by 2028."
Question: "Which choice completes the text with the most logical and precise word or phrase?"
A) produced  B) denied  C) worried  D) predicted
Correct: D
CRITICAL RULE for words_in_context: You MUST physically REMOVE the original word from the passage and REPLACE IT with _______ (which becomes [BLANK] in the UI). The word you removed MUST appear as one of the four answer choices (usually the correct answer). Do NOT leave the original word in the passage AND add a blank — delete the word, put _______ in its place, and include that word as a choice. Wrong answers are words that almost fit but miss the precise meaning.

EXAMPLE — transitions:
Passage: "When soil becomes contaminated by toxic metals, it can be removed from the ground and disposed of in a landfill. _______ contaminated soil can be detoxified via phytoremediation: plants that can withstand high concentrations of metals absorb the pollutants."
Question: "Which choice completes the text with the most logical transition?"
A) Alternatively,  B) Specifically,  C) For example,  D) As a result,
Correct: A
Notice: Identify the RELATIONSHIP between the two sentences first (contrast, addition, cause-effect, example). Pick the transition word that matches that relationship exactly.

EXAMPLE — standard_english_conventions:
Passage: "In his book, Vivek Bald uses newspaper articles, census records, ships' logs, and memoirs to tell the _______ who made New York City their home in the early twentieth century."
Question: "Which choice completes the text so that it conforms to the conventions of Standard English?"
A) story's of the South Asian immigrants  B) story's of the South Asian immigrants'  C) stories of the South Asian immigrants  D) stories' of the South Asian immigrant's
Correct: C
Notice: Test ONE specific grammar rule — possessives, plurals, subject-verb agreement, verb tense, or punctuation between clauses. Wrong answers are common grammar mistakes students make.

EXAMPLE — text_structure:
Passage: "Some bird species don't raise their own chicks. Instead, adult females lay their eggs in other nests. [UNDERLINED: Female cuckoos have been seen quickly laying eggs in the nests of other bird species when those birds are out looking for food.] After the eggs hatch, the noncuckoo parents will typically raise the cuckoo chicks as if they were their own offspring."
Question: "Which choice best describes the function of the underlined sentence in the text as a whole?"
A) It introduces a physical feature of female cuckoos described later.
B) It describes the appearance of cuckoo nests mentioned earlier.
C) It offers a detail about how female cuckoos carry out the behavior discussed in the text.
D) It explains how other birds react to the female cuckoo behavior.
Correct: C
Notice: Answer choices start with strong verbs: "It introduces...", "It describes...", "It offers...", "It explains...". Only ONE verb correctly describes what the sentence actually does.

EXAMPLE — command_of_evidence:
Passage: "Cats can judge unseen people's positions in space by the sound of their voices. Saho Takagi and colleagues reached this conclusion by measuring cats' levels of surprise based on their ear and head movements while the cats heard recordings of their owners' voices from two speakers spaced far apart."
Question: "According to the text, how did the researchers determine the level of surprise displayed by the cats in the study?"
A) They watched how each cat moved its ears and head.
B) They examined how each cat reacted to the voice of a stranger.
C) They studied how each cat physically interacted with its owner.
D) They tracked how each cat moved around the room.
Correct: A
Notice: The answer is DIRECTLY stated in the passage. Wrong answers are things NOT mentioned in the text or things that distort what the text says.

EXAMPLE — logical_completion:
Passage: "Many of William Shakespeare's tragedies address broad themes that still appeal to today's audiences. For instance, Romeo and Juliet tackles themes of parents versus children and love versus hate. But understanding Shakespeare's so-called history plays can require a knowledge of several centuries of English history. Consequently, _______"
Question: "Which choice most logically completes the text?"
A) many theatergoers and readers today are likely to find Shakespeare's history plays less engaging than the tragedies.
B) some of Shakespeare's tragedies are more relevant to today's audiences than twentieth-century plays.
C) Romeo and Juliet is the most thematically accessible of all Shakespeare's tragedies.
D) experts in English history tend to prefer Shakespeare's history plays to his other works.
Correct: A
Notice: The answer must FOLLOW LOGICALLY from the passage's argument. Wrong answers are either too extreme, off-topic, or contradict the passage's logic.

EXAMPLE — rhetorical_synthesis:
Notes:
• The Haudenosaunee Confederacy is a nearly 1,000-year-old alliance of six Native nations in the northeastern US.
• The members are bound by a centuries-old agreement known as the Great Law of Peace.
• Historian Bruce Johansen believes the principles of the Great Law of Peace influenced the US Constitution.
• This theory is called the influence theory.
• Johansen cites the fact that Benjamin Franklin and Thomas Jefferson both studied the Haudenosaunee Confederacy.
Goal: present the influence theory to an audience unfamiliar with the Haudenosaunee Confederacy.
Question: "Which choice most effectively uses relevant information from the notes to accomplish this goal?"
A) Historian Bruce Johansen believes that the Great Law of Peace was very influential.
B) The influence theory is supported by the fact that Benjamin Franklin and Thomas Jefferson both studied the Haudenosaunee Confederacy.
C) The influence theory holds that the principles of the Great Law of Peace, a centuries-old agreement binding six Native nations in the northeastern US, influenced the US Constitution.
D) Native people, including the members of the Haudenosaunee Confederacy, influenced the founding of the US in many different ways.
Correct: C
Notice: The correct answer directly and completely addresses the GOAL stated in the question. Wrong answers either ignore the goal, are too vague, or address a different goal.

EXAMPLE — textual_evidence_quotation:
Setup: "In describing the teenager, Mansfield frequently contrasts the character's pleasant appearance with her unpleasant attitude, as when Mansfield writes of the teenager, _______"
Question: "Which quotation from the text most effectively illustrates the claim?"
A) "I heard her murmur, 'I can't bear flowers on a table.'"
B) "shook the poor little puff as though she loathed it, and dabbed her lovely nose."
C) "she jumped up and turned away while I went through the vulgar act of paying for the tea."
D) "She didn't even take her gloves off. She lowered her eyes and drummed on the table."
Correct: B
Notice: The correct quote must show BOTH elements of the claim (pleasant appearance AND unpleasant attitude). Wrong quotes show only one or neither.

CRITICAL RULES:
1. The question MUST be based directly on the specific passage provided — use actual words, phrases, and sentences from it
2. For words_in_context: REMOVE the target word from the passage entirely and put _______ in its place. The removed word MUST be one of the four answer choices. Your modified_passage must have the word gone, replaced by _______. Never output a passage where the word is still there next to the blank.
3. For transitions: find a place in the passage where a transition word would naturally go, or modify a sentence to create that blank
4. For standard_english_conventions: take an actual sentence from the passage and modify it to test ONE grammar rule
5. For text_structure: pick an actual sentence from the passage as the underlined sentence
6. Wrong answers must use real SAT traps: opposite trap, also-true trap, too extreme, out of scope, possible but unsupported
7. Explanation must name the trap used in each wrong answer

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "type": "the question type",
  "modified_passage": "full passage text with [BLANK] inserted where needed, or null if not applicable",
  "notes": ["bullet 1", "bullet 2"] or null,
  "underlined": "the exact underlined sentence if text_structure, else null",
  "question": "the exact question stem",
  "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "A",
  "explanation": "SAT strategy name + why correct answer is right with text evidence + trap name for each wrong answer + one transferable SAT tip"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const { passage, questionType } = req.body;
  if (!passage || !questionType) return res.status(400).json({ error: 'Missing passage or questionType' });

  const user = `Here is the passage:

Title: "${passage.title}" by ${passage.author} (${passage.year})

Text:
${passage.text}

${passage.notes ? 'Notes:\n' + passage.notes.map(n => '• ' + n).join('\n') : ''}

You MUST generate a "${questionType}" question based DIRECTLY on this specific passage. Use actual words and sentences from this passage. Do not invent content that is not in the passage.`;

  try {
    const raw = await callGroq(apiKey, SYSTEM_PROMPT, user, 1200);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const question = JSON.parse(cleaned);
    return res.status(200).json(question);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
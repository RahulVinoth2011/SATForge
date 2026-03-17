#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

import { PASSAGES, NOTE_SETS } from './stories.js';
import { fetchRandomPassage, randomBook, BOOKS } from './gutenberg.js';
import { generateQuestion, generateExplanation } from './groq.js';
import { C } from './colors.js';
import { clear, rule, printBanner, printPassage, printQuestion, printResult, printScore, ask, getAnswer, pressEnter } from './ui.js';

// ── SAT scaled score conversion (raw out of 54 → 200-800) ────────────────────
const SCALE = {
  54:800,53:790,52:780,51:760,50:750,49:740,48:730,47:720,46:710,45:700,
  44:690,43:680,42:670,41:660,40:650,39:640,38:630,37:620,36:610,35:600,
  34:590,33:580,32:570,31:560,30:550,29:540,28:530,27:520,26:510,25:500,
  24:490,23:480,22:470,21:460,20:450,19:440,18:430,17:420,16:410,15:400,
  14:390,13:380,12:370,11:360,10:350,9:340,8:330,7:310,6:290,5:270,
  4:250,3:230,2:210,1:200,0:200,
};

function toScaled(raw, total) {
  // Normalize raw score to out of 54 for scaling
  const normalized = Math.round((raw / total) * 54);
  return SCALE[normalized] || 200;
}

// ── API Key ───────────────────────────────────────────────────────────────────
async function getApiKey() {
  let key = process.env.GROQ_API_KEY || '';
  if (!key) {
    console.log(`\n  ${C.yellow}No GROQ_API_KEY found in .env${C.reset}`);
    key = (await ask(`  ${C.cyan}Enter your Groq API key: ${C.reset}`)).trim();
  }
  if (!key) { console.log(`  ${C.red}No API key — exiting.${C.reset}\n`); process.exit(1); }
  console.log(`  ${C.green}✓ Groq API key loaded${C.reset}`);
  return key;
}

// ── Mode ──────────────────────────────────────────────────────────────────────
async function selectMode() {
  console.log();
  rule('─', C.cyan);
  console.log(`  ${C.bold}${C.cyan}SELECT MODE${C.reset}`);
  rule('─', C.cyan);
  console.log(`  ${C.green}(1)${C.reset}  Practice   — Answer at your own pace`);
  console.log(`  ${C.yellow}(2)${C.reset}  Timed      — 35 minutes, SAT pressure`);
  console.log(`  ${C.magenta}(3)${C.reset}  Full SAT   — 54 questions, 64 min, scaled 200-800 score`);
  console.log(`  ${C.red}(Q)${C.reset}  Quit`);
  console.log(`\n  ${C.dim}Tip: type Q on any question to abort early and see your score.${C.reset}`);
  console.log();
  while (true) {
    const c = (await ask(`  ${C.cyan}➤ Choose: ${C.reset}`)).toUpperCase();
    if (c === '1') return 'practice';
    if (c === '2') return 'timed';
    if (c === '3') return 'fullsat';
    if (c === 'Q') return 'quit';
    console.log(`  ${C.red}Enter 1, 2, 3, or Q${C.reset}`);
  }
}

async function selectCount(mode) {
  if (mode === 'fullsat') return 54;
  if (mode === 'timed')   return 27;
  const max = PASSAGES.length;
  rule('─', C.cyan);
  console.log(`  ${C.bold}${C.cyan}HOW MANY QUESTIONS? (1–${max})${C.reset}`);
  rule('─', C.cyan);
  while (true) {
    const n = parseInt(await ask(`  ${C.cyan}➤ Questions: ${C.reset}`), 10);
    if (n >= 1 && n <= max) return n;
    console.log(`  ${C.red}Enter a number 1–${max}${C.reset}`);
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Session ───────────────────────────────────────────────────────────────────
async function runSession(mode, apiKey) {
  const count     = await selectCount(mode);
  const timed     = mode === 'timed' || mode === 'fullsat';
  const timeLimit = mode === 'fullsat' ? 64 * 60 * 1000 : 35 * 60 * 1000;
  const start     = Date.now();
  let score       = 0;
  let answered    = 0;
  const missed    = [];

  const TYPE_ROTATION = [
    'words_in_context',
    'transitions',
    'standard_english_conventions',
    'text_structure',
    'command_of_evidence',
    'rhetorical_synthesis',
    'logical_completion',
    'textual_evidence_quotation',
  ];

  // Pick random books upfront (no repeats within a session)
  const shuffledBooks = [...BOOKS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    if (timed && Date.now() - start >= timeLimit) {
      clear(); printBanner();
      console.log(`\n  ${C.red}⏰ Time's up!${C.reset}\n`);
      break;
    }

    clear(); printBanner();

    if (timed) {
      const rem = Math.max(0, timeLimit - (Date.now() - start));
      const m = String(Math.floor(rem / 60000)).padStart(2, '0');
      const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
      console.log(`  ${C.yellow}⏱ Time remaining: ${m}:${s}${C.reset}`);
    }

    const forcedType = TYPE_ROTATION[i % TYPE_ROTATION.length];

    // Rhetorical synthesis uses note sets, everything else fetches from Gutenberg
    let source;
    if (forcedType === 'rhetorical_synthesis') {
      source = NOTE_SETS[i % NOTE_SETS.length];
      process.stdout.write(`\n  ${C.blue}⚙ Loading notes on "${source.title}"...${C.reset}`);
      process.stdout.write(`\r  ${C.green}✓ Notes ready!                                       ${C.reset}\n`);
    } else {
      const book = shuffledBooks[i % shuffledBooks.length];
      process.stdout.write(`\n  ${C.blue}⚙ Fetching real passage from "${book.title}"...${C.reset}`);
      try {
        source = await fetchRandomPassage(book);
        process.stdout.write(`\r  ${C.green}✓ Passage fetched!                                   ${C.reset}\n`);
      } catch (e) {
        process.stdout.write(`\r  ${C.yellow}⚠ Gutenberg failed, using local passage...           ${C.reset}\n`);
        source = PASSAGES[i % PASSAGES.length];
      }
    }

    process.stdout.write(`  ${C.blue}⚙ Generating ${forcedType.replace(/_/g,' ')} question...${C.reset}`);
    let generated;
    try {
      generated = await generateQuestion(apiKey, source, forcedType);
      process.stdout.write(`\r  ${C.green}✓ Question ready!                                    ${C.reset}\n`);
    } catch (e) {
      process.stdout.write(`\r  ${C.red}✗ Groq error: ${e.message}${C.reset}\n`);
      await pressEnter('Press ENTER to skip');
      continue;
    }

    printPassage(source, generated);
    printQuestion(generated, i + 1, count);

    // getAnswer returns 'Q' if user wants to abort
    const ans = await getAnswer(Object.keys(generated.choices));
    if (ans === 'Q') {
      console.log(`\n  ${C.yellow}Aborting session...${C.reset}\n`);
      break;
    }

    answered++;
    const correct = ans === generated.correct;
    if (correct) score++;
    else missed.push({ num: i + 1, title: source.title, correct: generated.correct });

    let explanation = generated.explanation;
    if (!correct) {
      process.stdout.write(`  ${C.blue}⚙ Getting detailed explanation...${C.reset}`);
      try {
        explanation = await generateExplanation(
          apiKey,
          source.text || source.notes?.join(' ') || '',
          generated.question,
          `(${generated.correct}) ${generated.choices[generated.correct]}`,
          `(${ans}) ${generated.choices[ans]}`
        );
        process.stdout.write(`\r                                      \r`);
      } catch { /* use default */ }
    }

    printResult(correct, generated.correct, explanation);
    await pressEnter();
  }

  clear(); printBanner();
  if (timed) {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.log(`  ${C.cyan}⏱ Finished in ${Math.floor(elapsed/60)}m ${elapsed%60}s${C.reset}`);
  }
  printScore(score, answered, missed, mode);
}

// ── Entry ─────────────────────────────────────────────────────────────────────
async function main() {
  clear(); printBanner();
  const apiKey = await getApiKey();
  while (true) {
    const mode = await selectMode();
    if (mode === 'quit') {
      console.log(`\n  ${C.cyan}Good luck on the SAT! 📚${C.reset}\n`);
      process.exit(0);
    }
    await runSession(mode, apiKey);
    const again = (await ask(`\n  ${C.cyan}➤ Play again? (Y/N): ${C.reset}`)).toUpperCase();
    if (again !== 'Y') {
      console.log(`\n  ${C.cyan}Good luck on the SAT! 📚${C.reset}\n`);
      process.exit(0);
    }
    clear(); printBanner();
  }
}

main().catch(e => {
  console.error(`\n${C.red}Fatal: ${e.message}${C.reset}\n`);
  process.exit(1);
});
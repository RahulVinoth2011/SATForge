import readline from 'readline';
import { C } from './colors.js';

const W = 72;

export function clear() { process.stdout.write('\x1Bc'); }

export function rule(char = '─', color = C.blue) {
  console.log(`${color}${char.repeat(W)}${C.reset}`);
}

function wrap(text, indent = 2) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + word).length > W - indent) { lines.push(line.trimEnd()); line = ''; }
    line += word + ' ';
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.map(l => ' '.repeat(indent) + l).join('\n');
}

export function printBanner() {
  console.log();
  console.log(`${C.cyan}╔══════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║ ${C.bold}${C.yellow} ★  SAT READING SIMULATOR                                  ${C.reset}${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}║ ${C.magenta}    1800s Public Domain Literature Edition                   ${C.reset}${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}║ ${C.dim}    Austen · Dickens · Twain · Bronte · Melville · Doyle     ${C.reset}${C.cyan}║${C.reset}`);
  console.log(`${C.cyan}╚══════════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log();
}

export function printPassage(passage, generated) {
  rule('═', C.magenta);
  console.log(`${C.magenta}  📜  ${C.bold}${passage.title}${C.reset}${C.magenta}  —  ${C.cyan}${passage.author}, ${passage.year}${C.reset}`);
  rule('─', C.magenta);

  if (generated.type === 'rhetorical_synthesis' && generated.notes) {
    console.log(`  ${C.dim}While researching a topic, a student has taken the following notes:${C.reset}\n`);
    generated.notes.forEach(note => {
      console.log(`  ${C.yellow}•${C.reset} ${C.white}${note}${C.reset}`);
    });
  } else {
    const raw  = generated.modified_passage || passage.text;
    const text = raw.replace(/\[BLANK\]/g, `${C.yellow}[BLANK]${C.reset}${C.white}`);
    console.log(`${C.white}${wrap(text)}${C.reset}`);
    if (generated.type === 'text_structure' && generated.underlined) {
      console.log();
      console.log(`  ${C.dim}Underlined: "${generated.underlined}"${C.reset}`);
    }
  }
  rule('═', C.magenta);
}

export function printQuestion(generated, num, total) {
  const typeLabels = {
    words_in_context:             'Words in Context',
    text_structure:               'Text Structure & Purpose',
    logical_completion:           'Logical Completion',
    command_of_evidence:          'Command of Evidence',
    transitions:                  'Transitions',
    standard_english_conventions: 'Standard English Conventions',
    rhetorical_synthesis:         'Rhetorical Synthesis',
    textual_evidence_quotation:   'Textual Evidence',
    inference:                    'Inference',
  };
  const label = typeLabels[generated.type] || generated.type;
  console.log(`\n${C.yellow}  Question ${num}/${total}  ${C.dim}[${label}]${C.reset}`);
  rule('─', C.yellow);
  console.log();
  console.log(`${C.white}${wrap(generated.question)}${C.reset}`);
  console.log();
  const colors = { A: C.cyan, B: C.green, C: C.yellow, D: C.magenta };
  for (const [letter, text] of Object.entries(generated.choices)) {
    console.log(`  ${colors[letter]}${C.bold}(${letter})${C.reset}  ${C.white}${text}${C.reset}`);
  }
  console.log();
}

export function printResult(correct, correctLetter, explanation) {
  if (correct) {
    console.log(`\n  ${C.bgGreen}${C.black}${C.bold}  ✓  CORRECT!  ${C.reset}`);
  } else {
    console.log(`\n  ${C.bgRed}${C.black}${C.bold}  ✗  INCORRECT — Correct answer: (${correctLetter})  ${C.reset}`);
  }
  console.log();
  console.log(`${C.dim}${wrap(explanation, 2)}${C.reset}`);
  console.log();
}

export function printScore(score, total, missed, mode = 'practice') {
  if (total === 0) {
    console.log(`\n  ${C.yellow}No questions answered.${C.reset}\n`);
    return;
  }
  const pct    = Math.round((score / total) * 100);
  const filled = Math.round(40 * score / total);
  const bar    = `${C.green}${'█'.repeat(filled)}${C.dim}${'░'.repeat(40 - filled)}${C.reset}`;

  console.log(); rule('═', C.yellow);
  console.log(`\n  ${C.bold}${C.yellow}FINAL RESULTS${C.reset}\n`);
  console.log(`  Raw score:  ${pct >= 70 ? C.green : C.red}${score} / ${total}  (${pct}%)${C.reset}`);
  console.log(`  ${bar}`);

  // Scaled score for fullsat mode
  if (mode === 'fullsat') {
    const normalized = Math.round((score / total) * 54);
    const SCALE = {
      54:800,53:790,52:780,51:760,50:750,49:740,48:730,47:720,46:710,45:700,
      44:690,43:680,42:670,41:660,40:650,39:640,38:630,37:620,36:610,35:600,
      34:590,33:580,32:570,31:560,30:550,29:540,28:530,27:520,26:510,25:500,
      24:490,23:480,22:470,21:460,20:450,19:440,18:430,17:420,16:410,15:400,
      14:390,13:380,12:370,11:360,10:350,9:340,8:330,7:310,6:290,5:270,
      4:250,3:230,2:210,1:200,0:200,
    };
    const scaled = SCALE[normalized] || 200;
    const sColor = scaled >= 650 ? C.green : scaled >= 500 ? C.yellow : C.red;
    console.log(`\n  ${C.bold}Scaled SAT Score:  ${sColor}${scaled} / 800${C.reset}`);
    console.log(`  ${C.dim}(Reading & Writing section estimate)${C.reset}`);
  }

  console.log();
  if (pct === 100)    console.log(`  ${C.green}🏆 Perfect score!${C.reset}`);
  else if (pct >= 80) console.log(`  ${C.green}🎉 Great job!${C.reset}`);
  else if (pct >= 60) console.log(`  ${C.yellow}📚 Good effort — keep reviewing.${C.reset}`);
  else                console.log(`  ${C.red}💪 Keep practicing!${C.reset}`);

  if (missed.length) {
    console.log(); rule('─', C.red);
    console.log(`  ${C.red}${C.bold}Missed:${C.reset}`);
    missed.forEach(m => console.log(`  ${C.red}•${C.reset} ${C.white}Q${m.num}: ${m.title}  ${C.dim}(correct: ${m.correct})${C.reset}`));
  }
  console.log(); rule('═', C.yellow);
}

export function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans.trim()); }));
}

export async function getAnswer(choices = ['A','B','C','D']) {
  const valid = [...choices, 'Q'];
  while (true) {
    const ans = (await ask(`  ${C.cyan}➤  Your answer (${choices.join('/')}  or Q to quit): ${C.reset}`)).toUpperCase();
    if (valid.includes(ans)) return ans;
    console.log(`  ${C.red}Enter one of: ${choices.join(', ')} or Q${C.reset}`);
  }
}

export async function pressEnter(msg = 'Press ENTER to continue') {
  await ask(`  ${C.dim}[ ${msg} ]${C.reset} `);
}
import { useState, useEffect } from 'react';
import { PASSAGES, NOTE_SETS } from '../../shared/stories.js';
import PassagePanel from './components/PassagePanel';
import QuestionPanel from './components/QuestionPanel';
import Navigator from './components/Navigator';
import Timer from './components/Timer';

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

const TYPE_LABELS = {
  words_in_context:             'Words in Context',
  text_structure:               'Text Structure & Purpose',
  logical_completion:           'Logical Completion',
  command_of_evidence:          'Command of Evidence',
  transitions:                  'Transitions',
  standard_english_conventions: 'Standard English',
  rhetorical_synthesis:         'Rhetorical Synthesis',
  textual_evidence_quotation:   'Textual Evidence',
};

const SCALE = {
  54:800,53:790,52:780,51:760,50:750,49:740,48:730,47:720,46:710,45:700,
  44:690,43:680,42:670,41:660,40:650,39:640,38:630,37:620,36:610,35:600,
  34:590,33:580,32:570,31:560,30:550,29:540,28:530,27:520,26:510,25:500,
  24:490,23:480,22:470,21:460,20:450,19:440,18:430,17:420,16:410,15:400,
  14:390,13:380,12:370,11:360,10:350,9:340,8:330,7:310,6:290,5:270,
  4:250,3:230,2:210,1:200,0:200,
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scaledScore(raw, total) {
  const n = Math.round((raw / total) * 54);
  return SCALE[Math.min(54, Math.max(0, n))] || 200;
}

export default function App() {
  const [screen, setScreen]       = useState('home');
  const [mode, setMode]           = useState(null);
  const [pool, setPool]           = useState([]);
  const [current, setCurrent]     = useState(0);
  const [generated, setGenerated] = useState([]);
  const [answers, setAnswers]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  function startExam(selectedMode) {
    const count = selectedMode === 'fullsat' ? 54 : selectedMode === 'timed' ? 27 : 10;
    const allPassages = shuffle([...PASSAGES, ...PASSAGES, ...PASSAGES, ...PASSAGES, ...PASSAGES, ...PASSAGES]);
    const examPool = allPassages.slice(0, count).map((p, i) => {
      const type = TYPE_ROTATION[i % TYPE_ROTATION.length];
      return type === 'rhetorical_synthesis'
        ? NOTE_SETS[i % NOTE_SETS.length]
        : p;
    });
    setPool(examPool);
    setGenerated(new Array(count).fill(null));
    setAnswers(new Array(count).fill(null));
    setCurrent(0);
    setSelected(null);
    setSubmitted(false);
    setMode(selectedMode);
    setScreen('exam');
  }

  useEffect(() => {
    if (screen !== 'exam' || !pool[current]) return;
    if (generated[current]) return;
    loadQuestion(current);
  }, [screen, current, pool]);

  async function loadQuestion(idx) {
    setLoading(true);
    setError(null);
    const source = pool[idx];
    const questionType = TYPE_ROTATION[idx % TYPE_ROTATION.length];
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passage: source, questionType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGenerated(prev => { const n = [...prev]; n[idx] = data; return n; });
      if (idx + 1 < pool.length && !generated[idx + 1]) preloadQuestion(idx + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function preloadQuestion(idx) {
    if (!pool[idx] || generated[idx]) return;
    const source = pool[idx];
    const questionType = TYPE_ROTATION[idx % TYPE_ROTATION.length];
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passage: source, questionType }),
      });
      const data = await res.json();
      if (!data.error) setGenerated(prev => { const n = [...prev]; n[idx] = data; return n; });
    } catch { /* silent */ }
  }

  function handleSelect(letter) { setSelected(letter); }

  function handleSubmit() {
    if (!selected || !generated[current]) return;
    const correct = selected === generated[current].correct;
    setAnswers(prev => { const n = [...prev]; n[current] = { selected, correct, type: generated[current].type }; return n; });
    setSubmitted(true);
  }

  function handleNext() {
    if (current < pool.length - 1) {
      setCurrent(c => c + 1);
      setSelected(answers[current + 1]?.selected || null);
      setSubmitted(!!answers[current + 1]);
    } else {
      setScreen('score');
    }
  }

  function handleJump(idx) {
    setCurrent(idx);
    setSelected(answers[idx]?.selected || null);
    setSubmitted(!!answers[idx]);
  }

  function handleTimerExpire() { setScreen('score'); }

  const totalAnswered = answers.filter(a => a !== null).length;
  const totalCorrect  = answers.filter(a => a?.correct).length;

  // Per-type breakdown
  const typeStats = {};
  answers.forEach(a => {
    if (!a) return;
    const t = a.type || 'unknown';
    if (!typeStats[t]) typeStats[t] = { correct: 0, total: 0 };
    typeStats[t].total++;
    if (a.correct) typeStats[t].correct++;
  });

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home-screen">
        <div className="home-left">
          <div className="home-badge">
            <div className="home-badge-dot" />
            <span>College Board Style · 1800s Lit</span>
          </div>

          <div className="home-logo-area">
            <div className="home-logo">SAT<br /><em>Forge</em></div>
            <p className="home-tagline">
              AI-generated Reading &amp; Writing practice built to match the real Digital SAT.
            </p>
          </div>

          <div className="home-stats">
            <div>
              <div className="home-stat-num">8</div>
              <div className="home-stat-label">Question types</div>
            </div>
            <div>
              <div className="home-stat-num">54</div>
              <div className="home-stat-label">Full SAT length</div>
            </div>
            <div>
              <div className="home-stat-num">800</div>
              <div className="home-stat-label">Max scaled score</div>
            </div>
          </div>
        </div>

        <div className="home-right">
          <div className="home-right-heading">Choose your mode</div>

          <div className="mode-card" onClick={() => startExam('practice')}>
            <div className="mode-icon">📖</div>
            <div>
              <div className="mode-title">Practice</div>
              <div className="mode-desc">10 questions · No timer · Learn at your pace</div>
            </div>
            <div className="mode-card-arrow">→</div>
          </div>

          <div className="mode-card" onClick={() => startExam('timed')}>
            <div className="mode-icon">⏱</div>
            <div>
              <div className="mode-title">Timed</div>
              <div className="mode-desc">27 questions · 35 minutes</div>
            </div>
            <div className="mode-card-arrow">→</div>
          </div>

          <div className="mode-card" onClick={() => startExam('fullsat')}>
            <div className="mode-icon">🎯</div>
            <div>
              <div className="mode-title">Full SAT</div>
              <div className="mode-desc">54 questions · 64 minutes · Scaled score</div>
            </div>
            <div className="mode-card-arrow">→</div>
          </div>
        </div>
      </div>
    );
  }

  // ── SCORE ─────────────────────────────────────────────────────────────────
  if (screen === 'score') {
    const scaled = scaledScore(totalCorrect, pool.length);
    const pct = Math.round((totalCorrect / (totalAnswered || 1)) * 100);
    const breakdownEntries = Object.entries(typeStats);

    return (
      <div className="score-screen">
        <div className="score-eyebrow">SATForge · Results</div>
        <div className="score-card">
          {mode === 'fullsat' ? (
            <>
              <div className="score-scaled">{scaled}</div>
              <div className="score-label">Estimated SAT R&amp;W Score (out of 800)</div>
              <div className="score-raw">{totalCorrect} / {totalAnswered} correct &nbsp;·&nbsp; {pct}%</div>
            </>
          ) : (
            <>
              <div className="score-scaled">{totalCorrect}/{totalAnswered}</div>
              <div className="score-label">{pct}% correct</div>
            </>
          )}

          {breakdownEntries.length > 0 && (
            <div className="score-breakdown">
              {breakdownEntries.map(([type, stat]) => {
                const ratio = stat.correct / stat.total;
                const cls = ratio >= 0.75 ? 'good' : ratio >= 0.5 ? 'ok' : 'bad';
                return (
                  <div className="breakdown-row" key={type}>
                    <span className="breakdown-type">{TYPE_LABELS[type] || type}</span>
                    <span className={`breakdown-score ${cls}`}>{stat.correct}/{stat.total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setScreen('home')}>
          Back to Home
        </button>
      </div>
    );
  }

  // ── EXAM ──────────────────────────────────────────────────────────────────
  const currentPassage   = pool[current];
  const currentGenerated = generated[current];
  const timeSecs = mode === 'fullsat' ? 64 * 60 : mode === 'timed' ? 35 * 60 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">SAT<em>Forge</em></span>
          <div className="topbar-divider" />
          <span className="topbar-section">Reading &amp; Writing</span>
        </div>
        <div className="topbar-right">
          {timeSecs && <Timer key={mode} seconds={timeSecs} onExpire={handleTimerExpire} />}
          <button className="btn btn-danger" onClick={() => setScreen('score')}>
            End Test
          </button>
        </div>
      </div>

      <Navigator
        total={pool.length}
        current={current}
        answers={answers}
        onJump={handleJump}
      />

      {loading && !currentGenerated ? (
        <div className="loading-screen">
          <div className="spinner" />
          <span>Generating question…</span>
        </div>
      ) : error ? (
        <div className="loading-screen">
          <p style={{ color: '#c0392b' }}>Error: {error}</p>
          <button className="btn btn-primary" onClick={() => loadQuestion(current)}>Retry</button>
        </div>
      ) : (
        <div className="exam-layout">
          <PassagePanel passage={currentPassage} generated={currentGenerated} />
          <QuestionPanel
            generated={currentGenerated}
            selected={selected}
            onSelect={handleSelect}
            submitted={submitted}
          />
        </div>
      )}

      <div className="bottom-bar">
        <button className="btn btn-outline" onClick={() => current > 0 && handleJump(current - 1)}
          disabled={current === 0}>
          ← Back
        </button>
        <span className="bottom-center">Question {current + 1} of {pool.length}</span>
        {!submitted ? (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!selected}>
            Confirm
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleNext}>
            {current < pool.length - 1 ? 'Next →' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  );
}
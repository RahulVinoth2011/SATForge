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
  const [screen, setScreen]       = useState('home');   // home | exam | score
  const [mode, setMode]           = useState(null);
  const [pool, setPool]           = useState([]);
  const [current, setCurrent]     = useState(0);
  const [generated, setGenerated] = useState([]);
  const [answers, setAnswers]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Start exam
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

  // Load question for current index
  useEffect(() => {
    if (screen !== 'exam' || !pool[current]) return;
    if (generated[current]) return; // already loaded
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
      // Preload next question in background
      if (idx + 1 < pool.length && !generated[idx + 1]) {
        preloadQuestion(idx + 1);
      }
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
      if (!data.error) {
        setGenerated(prev => { const n = [...prev]; n[idx] = data; return n; });
      }
    } catch { /* silent fail */ }
  }

  function handleSelect(letter) {
    setSelected(letter);
  }

  function handleSubmit() {
    if (!selected || !generated[current]) return;
    const correct = selected === generated[current].correct;
    setAnswers(prev => {
      const n = [...prev];
      n[current] = { selected, correct };
      return n;
    });
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

  function handleTimerExpire() {
    setScreen('score');
  }

  // Score calculation
  const totalAnswered = answers.filter(a => a !== null).length;
  const totalCorrect  = answers.filter(a => a?.correct).length;

  // ── Screens ──────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <div className="home-screen">
        <div>
          <div className="home-title">SATForge</div>
          <div className="home-sub">1800s Literature · College Board Style</div>
        </div>
        <div className="mode-cards">
          <div className="mode-card" onClick={() => startExam('practice')}>
            <h3>Practice</h3>
            <p>10 questions, no timer, learn at your pace</p>
          </div>
          <div className="mode-card" onClick={() => startExam('timed')}>
            <h3>Timed</h3>
            <p>27 questions, 35 minutes</p>
          </div>
          <div className="mode-card" onClick={() => startExam('fullsat')}>
            <h3>Full SAT</h3>
            <p>54 questions, 64 minutes, scaled score</p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'score') {
    const scaled = scaledScore(totalCorrect, pool.length);
    const pct = Math.round((totalCorrect / totalAnswered || 0) * 100);
    return (
      <div className="score-screen">
        <div className="score-card">
          {mode === 'fullsat' ? (
            <>
              <div className="score-scaled">{scaled}</div>
              <div className="score-label">Estimated SAT R&W Score (out of 800)</div>
              <div className="score-raw">{totalCorrect} / {totalAnswered} correct ({pct}%)</div>
            </>
          ) : (
            <>
              <div className="score-scaled">{totalCorrect}/{totalAnswered}</div>
              <div className="score-label">{pct}% correct</div>
            </>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setScreen('home')}>
          Back to Home
        </button>
      </div>
    );
  }

  // ── Exam Screen ───────────────────────────────────────────────────────────
  const currentPassage   = pool[current];
  const currentGenerated = generated[current];
  const timeSecs = mode === 'fullsat' ? 64 * 60 : mode === 'timed' ? 35 * 60 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">SATForge</span>
          <span className="topbar-section">Reading & Writing</span>
        </div>
        <div className="topbar-right">
          {timeSecs && <Timer key={mode} seconds={timeSecs} onExpire={handleTimerExpire} />}
          <button className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
            onClick={() => setScreen('score')}>
            End Test
          </button>
        </div>
      </div>

      {/* Navigator */}
      <Navigator
        total={pool.length}
        current={current}
        answers={answers}
        onJump={handleJump}
      />

      {/* Main */}
      {loading && !currentGenerated ? (
        <div className="loading-screen">
          <div className="spinner" />
          <span>Generating question…</span>
        </div>
      ) : error ? (
        <div className="loading-screen">
          <p style={{ color: '#c62828' }}>Error: {error}</p>
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

      {/* Bottom Bar */}
      <div className="bottom-bar">
        <button className="btn btn-outline" onClick={() => current > 0 && handleJump(current - 1)}
          disabled={current === 0}>
          ← Back
        </button>
        <span style={{ fontSize: 13, color: '#9e9e9e' }}>
          Question {current + 1} of {pool.length}
        </span>
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
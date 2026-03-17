import { useState, useEffect } from 'react';

export default function Timer({ seconds, onExpire }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  const cls = remaining <= 60 ? 'timer danger' : remaining <= 300 ? 'timer warning' : 'timer';

  return <div className={cls}>{m}:{s}</div>;
}
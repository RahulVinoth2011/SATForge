export default function Navigator({ total, current, answers, onJump }) {
  return (
    <div className="navigator">
      {Array.from({ length: total }, (_, i) => {
        const a = answers[i];
        let cls = 'nav-btn';
        if (i === current) cls += ' active';
        else if (a?.correct === true)  cls += ' correct';
        else if (a?.correct === false) cls += ' incorrect';
        else if (a?.selected)          cls += ' answered';
        return (
          <button key={i} className={cls} onClick={() => onJump(i)}>
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
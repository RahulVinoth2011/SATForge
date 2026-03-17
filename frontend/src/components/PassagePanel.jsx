export default function PassagePanel({ passage, generated }) {
  if (!passage || !generated) return null;

  const isNotes = generated.type === 'rhetorical_synthesis' && generated.notes;

  const renderText = (text) => {
    if (!text) return null;
    const parts = text.split(/\[BLANK\]|_______/);
    if (parts.length === 1) return <p className="passage-text">{text}</p>;
    return (
      <p className="passage-text">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && <span className="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          </span>
        ))}
      </p>
    );
  };

  return (
    <div className="passage-panel">
      <div className="passage-source-bar">
        <div className="passage-source-line" />
        <div className="passage-meta">{passage.author} · {passage.year}</div>
        <div className="passage-source-line" />
      </div>

      <div className="passage-title">{passage.title}</div>

      {isNotes ? (
        <>
          <p className="passage-text" style={{ marginBottom: 16, color: '#9aa0ad', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
            While researching a topic, a student has taken the following notes:
          </p>
          <ul className="passage-notes">
            {generated.notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </>
      ) : (
        <>
          {renderText(generated.modified_passage || passage.text)}
          {generated.type === 'text_structure' && generated.underlined && (
            <div className="underlined-label">
              <strong>Underlined sentence:</strong> "{generated.underlined}"
            </div>
          )}
        </>
      )}
    </div>
  );
}
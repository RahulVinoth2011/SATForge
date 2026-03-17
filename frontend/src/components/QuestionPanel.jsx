const TYPE_LABELS = {
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

export default function QuestionPanel({ generated, selected, onSelect, submitted }) {
  if (!generated) return null;

  const label = TYPE_LABELS[generated.type] || generated.type;

  return (
    <div className="question-panel">
      <span className="question-type-badge">{label}</span>
      <p className="question-text">{generated.question}</p>

      <div className="choices">
        {Object.entries(generated.choices).map(([letter, text]) => {
          let cls = 'choice-btn';
          if (submitted) {
            if (letter === generated.correct) cls += ' correct';
            else if (letter === selected)     cls += ' incorrect';
          } else if (letter === selected) {
            cls += ' selected';
          }

          return (
            <button
              key={letter}
              className={cls}
              onClick={() => !submitted && onSelect(letter)}
              disabled={submitted}
            >
              <span className="choice-letter">{letter}</span>
              <span>{text}</span>
            </button>
          );
        })}
      </div>

      {submitted && generated.explanation && (
        <div className="explanation">
          <div className="explanation-title">Explanation</div>
          {generated.explanation}
        </div>
      )}
    </div>
  );
}
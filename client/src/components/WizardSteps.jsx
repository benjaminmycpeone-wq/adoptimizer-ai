const STEPS = [
  { num: 1, label: 'Setup' },
  { num: 2, label: 'AI Strategy' },
  { num: 3, label: 'Launch' },
];

export default function WizardSteps({ current, onStep }) {
  return (
    <div className="ws">
      {STEPS.map((s) => (
        <div
          key={s.num}
          className={`wst${s.num === current ? ' active' : ''}${s.num < current ? ' done' : ''}`}
          onClick={() => onStep(s.num)}
        >
          <span>Step {s.num}</span>
          {s.label}
        </div>
      ))}
    </div>
  );
}

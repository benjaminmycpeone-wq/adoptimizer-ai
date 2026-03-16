const STEPS = [
  { num: 1, label: 'Business' },
  { num: 2, label: 'Campaign' },
  { num: 3, label: 'AI Generate' },
  { num: 4, label: 'Launch' },
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

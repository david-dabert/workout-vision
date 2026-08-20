import { useState } from 'react';
import { Dumbbell, Target, Activity, ChevronRight, ChevronLeft, Check } from 'lucide-react';

const TOTAL_STEPS = 4;

const INJURY_AREAS = ['lower_back', 'shoulder', 'knee', 'wrist', 'hip', 'ankle', 'neck', 'elbow'];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '',
    age: '',
    sex: 'male',
    weight: '',
    height: '',
    experience: 'intermediate',
    goal: 'general',
    activityLevel: 'moderate',
    injuries: [],
  });

  const update = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const canAdvance = () => {
    if (step === 2) {
      return data.name.trim() && data.age && data.weight && data.height;
    }
    return true;
  };

  const next = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  const finish = async () => {
    onComplete(data);
  };

  const toggleInjury = (area) => {
    const current = data.injuries || [];
    const next = current.includes(area)
      ? current.filter(i => i !== area)
      : [...current, area];
    update('injuries', next);
  };

  return (
    <div className="onboarding">
      {/* Progress dots */}
      <div className="onboarding-progress">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`onboarding-dot ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
          />
        ))}
      </div>

      <div className="onboarding-content">
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepBasicInfo data={data} update={update} />}
        {step === 3 && <StepFitnessInfo data={data} update={update} toggleInjury={toggleInjury} />}
        {step === 4 && <StepSummary data={data} />}
      </div>

      <div className="onboarding-actions">
        {step > 1 && (
          <button className="btn btn-ghost" onClick={back}>
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        <div style={{ flex: 1 }} />
        {step < TOTAL_STEPS ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={next}
            disabled={!canAdvance()}
          >
            {step === 1 ? 'Get Started' : 'Continue'}
            <ChevronRight size={16} />
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={finish}>
            Start Training
            <Check size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome() {
  return (
    <div className="onboarding-step text-center">
      <div className="onboarding-icon-large">
        <Dumbbell size={48} />
      </div>
      <h1>Workout <span style={{ color: 'var(--accent)' }}>Vision</span></h1>
      <p className="onboarding-tagline">
        AI-powered form coaching, personalized training plans, and nutrition tracking — all on your device.
      </p>
      <div className="onboarding-features">
        <div className="onboarding-feature">
          <Activity size={20} color="var(--accent)" />
          <span>Real-time form analysis</span>
        </div>
        <div className="onboarding-feature">
          <Target size={20} color="var(--accent)" />
          <span>Personalized workout plans</span>
        </div>
        <div className="onboarding-feature">
          <Dumbbell size={20} color="var(--accent)" />
          <span>Track progress over time</span>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Basic Info ── */
function StepBasicInfo({ data, update }) {
  return (
    <div className="onboarding-step">
      <h2>About you</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        This helps us calculate your baselines and personalize your experience.
      </p>
      <div className="form-grid">
        <label className="full-width">
          <span>Name</span>
          <input
            type="text"
            value={data.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </label>
        <label>
          <span>Age</span>
          <input
            type="number"
            value={data.age}
            onChange={(e) => update('age', e.target.value)}
            placeholder="e.g. 28"
          />
        </label>
        <label>
          <span>Sex</span>
          <select value={data.sex} onChange={(e) => update('sex', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>
          <span>Weight (kg)</span>
          <input
            type="number"
            value={data.weight}
            onChange={(e) => update('weight', e.target.value)}
            placeholder="e.g. 75"
          />
        </label>
        <label>
          <span>Height (cm)</span>
          <input
            type="number"
            value={data.height}
            onChange={(e) => update('height', e.target.value)}
            placeholder="e.g. 178"
          />
        </label>
      </div>
    </div>
  );
}

/* ── Step 3: Fitness Info ── */
function StepFitnessInfo({ data, update, toggleInjury }) {
  return (
    <div className="onboarding-step">
      <h2>Your fitness</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        We use this to tailor workout plans and recommendations.
      </p>
      <div className="form-grid">
        <label className="full-width">
          <span>Experience Level</span>
          <select value={data.experience} onChange={(e) => update('experience', e.target.value)}>
            <option value="beginner">Beginner (&lt;1 year)</option>
            <option value="intermediate">Intermediate (1-3 years)</option>
            <option value="advanced">Advanced (3+ years)</option>
          </select>
        </label>
        <label className="full-width">
          <span>Goal</span>
          <select value={data.goal} onChange={(e) => update('goal', e.target.value)}>
            <option value="general">General Fitness</option>
            <option value="strength">Strength</option>
            <option value="hypertrophy">Muscle Growth</option>
            <option value="endurance">Endurance</option>
            <option value="weight_loss">Weight Loss</option>
          </select>
        </label>
        <label className="full-width">
          <span>Activity Level</span>
          <select value={data.activityLevel} onChange={(e) => update('activityLevel', e.target.value)}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light (1-2x/week)</option>
            <option value="moderate">Moderate (3-4x/week)</option>
            <option value="active">Active (5-6x/week)</option>
            <option value="veryActive">Very Active (daily)</option>
          </select>
        </label>
        <label className="full-width">
          <span>Injuries / limitations (tap to select)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {INJURY_AREAS.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => toggleInjury(area)}
                style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                  border: '1px solid',
                  borderColor: (data.injuries || []).includes(area) ? 'var(--red)' : 'var(--border)',
                  background: (data.injuries || []).includes(area) ? 'rgba(255,61,87,0.15)' : 'transparent',
                  color: (data.injuries || []).includes(area) ? 'var(--red)' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {area.replace('_', ' ')}
              </button>
            ))}
          </div>
        </label>
      </div>
    </div>
  );
}

/* ── Step 4: Summary ── */
function StepSummary({ data }) {
  const goalLabels = {
    general: 'General Fitness',
    strength: 'Strength',
    hypertrophy: 'Muscle Growth',
    endurance: 'Endurance',
    weight_loss: 'Weight Loss',
  };

  return (
    <div className="onboarding-step">
      <h2>You're all set, {data.name || 'there'}!</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        Here's what you'll get with Workout Vision.
      </p>

      <div className="card" style={{ marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Your profile</h4>
        <div className="onboarding-summary-grid">
          <div className="onboarding-summary-item">
            <span className="stat-label">Goal</span>
            <span className="stat-value">{goalLabels[data.goal] || data.goal}</span>
          </div>
          <div className="onboarding-summary-item">
            <span className="stat-label">Experience</span>
            <span className="stat-value" style={{ textTransform: 'capitalize' }}>{data.experience}</span>
          </div>
          <div className="onboarding-summary-item">
            <span className="stat-label">Weight</span>
            <span className="stat-value">{data.weight} kg</span>
          </div>
          <div className="onboarding-summary-item">
            <span className="stat-label">Height</span>
            <span className="stat-value">{data.height} cm</span>
          </div>
        </div>
      </div>

      <div className="onboarding-benefits">
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Target size={20} />
          </div>
          <div>
            <strong>Personalized Plans</strong>
            <p className="text-muted text-sm">Workout plans adapted to your goal and level.</p>
          </div>
        </div>
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Activity size={20} />
          </div>
          <div>
            <strong>Form Coaching</strong>
            <p className="text-muted text-sm">Real-time AI feedback on your exercise form.</p>
          </div>
        </div>
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Dumbbell size={20} />
          </div>
          <div>
            <strong>Nutrition Tracking</strong>
            <p className="text-muted text-sm">Log meals and track macros based on your profile.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

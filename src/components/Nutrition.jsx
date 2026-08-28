import { useState, useEffect, useRef, useCallback } from 'react';
import { saveFoodEntry, getFoodLog, deleteFoodEntry, getAllWorkouts } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import {
  searchFood, calculateMacros, getDailyTargets,
  fetchBarcodeNutrition, estimateDailyBurn, FOOD_DATABASE,
} from '../lib/nutrition';
import { Camera, Search, Trash2, ChevronLeft, ScanBarcode, UtensilsCrossed, Plus, X } from 'lucide-react';
import { useT } from '../lib/LanguageContext';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function getMealName(meal, t) {
  switch (meal) {
    case 'Breakfast': return t('breakfast');
    case 'Lunch': return t('lunch');
    case 'Dinner': return t('dinner');
    case 'Snack': return t('snack');
    default: return meal;
  }
}

export default function Nutrition() {
  const { t } = useT();
  const { profile } = useProfile();
  const [foodLog, setFoodLog] = useState([]);
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [targets, setTargets] = useState(null);
  const [goal, setGoal] = useState('maintain');
  const [view, setView] = useState('daily'); // daily | add | scan | photo
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (profile) setTargets(getDailyTargets(profile, goal));
  }, [profile, goal]);

  useEffect(() => {
    loadDayData();
  }, [selectedDate]);

  const loadDayData = async () => {
    const entries = await getFoodLog(selectedDate);
    setFoodLog(entries);
    const allW = await getAllWorkouts();
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    setTodayWorkouts(allW.filter(w => {
      const t = w.createdAt || new Date(w.date).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('delete_entry_confirm'))) return;
    await deleteFoodEntry(id);
    setFoodLog(prev => prev.filter(e => e.id !== id));
  };

  // Totals
  const totals = foodLog.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein: acc.protein + (e.protein || 0),
    carbs: acc.carbs + (e.carbs || 0),
    fat: acc.fat + (e.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const caloriesBurned = profile
    ? estimateDailyBurn(todayWorkouts, parseFloat(profile.weight) || 70)
    : 0;

  const netCalories = totals.calories - caloriesBurned;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (view === 'add') {
    return (
      <FoodSearch
        onAdd={async (entry) => {
          await saveFoodEntry(entry);
          await loadDayData();
          setView('daily');
        }}
        onClose={() => setView('daily')}
      />
    );
  }

  if (view === 'scan') {
    return (
      <BarcodeScanner
        onResult={async (entry) => {
          await saveFoodEntry(entry);
          await loadDayData();
          setView('daily');
        }}
        onClose={() => setView('daily')}
      />
    );
  }

  if (view === 'photo') {
    return (
      <FoodPhoto
        onAdd={async (entry) => {
          await saveFoodEntry(entry);
          await loadDayData();
          setView('daily');
        }}
        onClose={() => setView('daily')}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('nutrition')}</h2>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          style={{ width: 'auto', padding: '6px 28px 6px 10px', fontSize: '0.78rem' }}
        >
          <option value="maintain">{t('maintain')}</option>
          <option value="cut">{t('cut')}</option>
          <option value="bulk">{t('bulk')}</option>
        </select>
      </div>

      {/* Date navigation */}
      <div className="date-nav">
        <button className="btn-icon" onClick={() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}>
          <ChevronLeft size={16} />
        </button>
        <span className="date-label">
          {isToday ? t('today') : new Date(selectedDate).toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric'
          })}
        </span>
        <button className="btn-icon" onClick={() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          if (d <= new Date()) setSelectedDate(d.toISOString().split('T')[0]);
        }} disabled={isToday}>
          <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>

      {/* Calorie ring */}
      {targets && (
        <div className="card">
          <div className="calorie-summary">
            <CalorieRing eaten={totals.calories} burned={caloriesBurned} target={targets.calories} />
            <div className="calorie-breakdown">
              <div className="cal-row">
                <span className="cal-dot cal-target" />
                <span className="text-sm">{t('target')}</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 'auto' }}>
                  {targets.calories}
                </span>
              </div>
              <div className="cal-row">
                <span className="cal-dot cal-eaten" />
                <span className="text-sm">{t('eaten')}</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 'auto' }}>
                  {totals.calories}
                </span>
              </div>
              <div className="cal-row">
                <span className="cal-dot cal-burned" />
                <span className="text-sm">{t('burned')}</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 'auto' }}>
                  {caloriesBurned}
                </span>
              </div>
              <div className="cal-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                <span className="text-sm" style={{ fontWeight: 700, color: netCalories > (targets?.calories || 2000) ? 'var(--red)' : 'var(--accent)' }}>
                  {targets.calories - netCalories > 0
                    ? `${targets.calories - netCalories} ${t('remaining')}`
                    : `${Math.abs(targets.calories - netCalories)} ${t('over')}`
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Macro bars */}
      {targets && (
        <div className="card">
          <h4>{t('macros')}</h4>
          <MacroBar label={t('protein_cap')} current={Math.round(totals.protein)} target={targets.protein} color="var(--accent)" unit="g" />
          <MacroBar label={t('carbs')} current={Math.round(totals.carbs)} target={targets.carbs} color="var(--blue)" unit="g" />
          <MacroBar label={t('fat')} current={Math.round(totals.fat)} target={targets.fat} color="var(--yellow)" unit="g" />
        </div>
      )}

      {/* Add food buttons */}
      <div className="add-food-grid">
        <button className="add-food-btn" onClick={() => setView('add')}>
          <Search size={18} />
          <span>{t('search_food')}</span>
        </button>
        <button className="add-food-btn" onClick={() => setView('scan')}>
          <ScanBarcode size={18} />
          <span>{t('scan_barcode')}</span>
        </button>
        <button className="add-food-btn" onClick={() => setView('photo')}>
          <Camera size={18} />
          <span>{t('photo_plate')}</span>
        </button>
      </div>

      {/* Food log */}
      {foodLog.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h4>{t('food_log')}</h4>
          {MEAL_TYPES.map(meal => {
            const items = foodLog.filter(e => e.mealType === meal);
            if (items.length === 0) return null;
            return (
              <div key={meal}>
                <h5>{getMealName(meal, t)}</h5>
                {items.map(e => (
                  <div key={e.id} className="food-entry">
                    <div className="food-entry-info">
                      {e.photoUrl && (
                        <img src={e.photoUrl} alt="" className="food-thumb" />
                      )}
                      <div>
                        <span className="food-entry-name">{e.name}</span>
                        <span className="food-entry-detail">
                          {e.grams}g · {e.calories} {t('kcal')}
                        </span>
                      </div>
                    </div>
                    <div className="food-entry-right">
                      <span className="food-entry-macros">
                        P{Math.round(e.protein)} C{Math.round(e.carbs)} F{Math.round(e.fat)}
                      </span>
                      <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => handleDelete(e.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {foodLog.length === 0 && (
        <div className="card card-welcome" style={{ marginTop: 16 }}>
          <UtensilsCrossed size={28} style={{ color: 'var(--accent)', margin: '0 auto 8px', display: 'block' }} />
          <h3>{isToday ? t('no_food_logged_today') : t('no_food_logged_day')}</h3>
          <p className="text-sm text-muted">
            {t('food_log_empty_desc')}
          </p>
        </div>
      )}

      {/* Workout burn summary */}
      {todayWorkouts.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <h4>{t('workout_burn')}</h4>
          {todayWorkouts.map(w => (
            <div key={w.id} className="food-entry" style={{ border: 'none', padding: '6px 0' }}>
              <div className="food-entry-info">
                <div>
                  <span className="food-entry-name">{w.exerciseName || w.exercise}</span>
                  <span className="food-entry-detail">
                    {w.reps} {t('reps').toLowerCase()} · {w.duration ? `${Math.round(w.duration)}s` : ''}
                  </span>
                </div>
              </div>
              <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: '0.82rem' }}>
                -{profile ? estimateDailyBurn([w], parseFloat(profile.weight) || 70) : '?'} {t('kcal')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Calorie Ring (SVG donut) ──

function CalorieRing({ eaten, burned, target }) {
  const { t } = useT();
  const remaining = Math.max(0, target - eaten + burned);
  const pct = Math.min((eaten - burned) / target, 1.2);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(pct, 1));
  const color = pct > 1 ? 'var(--red)' : pct > 0.8 ? 'var(--yellow)' : 'var(--accent)';

  return (
    <div className="calorie-ring">
      <svg viewBox="0 0 120 120" width="110" height="110">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="calorie-ring-center">
        <span className="calorie-ring-value">{remaining}</span>
        <span className="calorie-ring-label">{t('remaining')}</span>
      </div>
    </div>
  );
}


// ── Macro progress bar ──

function MacroBar({ label, current, target, color, unit }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div className="macro-bar-row">
      <div className="macro-bar-labels">
        <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{label}</span>
        <span className="text-xs text-muted">{current}/{target}{unit}</span>
      </div>
      <div className="progress-bar" style={{ height: 8 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}


// ── Food Search & Add ──

function FoodSearch({ onAdd, onClose }) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState('');
  const [mealType, setMealType] = useState('Lunch');

  useEffect(() => {
    setResults(searchFood(query));
  }, [query]);

  const handleAdd = () => {
    if (!selected) return;
    const g = parseFloat(grams) || selected.servingG;
    const macros = calculateMacros(selected, g);
    onAdd({
      name: selected.name,
      grams: g,
      mealType,
      ...macros,
      category: selected.category,
      source: 'manual',
    });
  };

  if (selected) {
    const g = parseFloat(grams) || selected.servingG;
    const macros = calculateMacros(selected, g);
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-icon" onClick={() => setSelected(null)}>
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ fontSize: '1rem' }}>{t('add_food')}</h2>
          <div />
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.95rem' }}>{selected.name}</h3>
          <p className="text-xs text-muted" style={{ marginBottom: 12 }}>{selected.category}</p>

          <div className="form-grid">
            <label>
              <span>{t('amount_g')}</span>
              <input
                type="number"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder={`${selected.servingG} (${selected.servingLabel})`}
              />
            </label>
            <label>
              <span>{t('meal')}</span>
              <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPES.map(m => <option key={m} value={m}>{getMealName(m, t)}</option>)}
              </select>
            </label>
          </div>

          <div className="macro-preview">
            <div className="macro-preview-item">
              <span className="macro-preview-val">{macros.calories}</span>
              <span className="macro-preview-label">{t('kcal')}</span>
            </div>
            <div className="macro-preview-item">
              <span className="macro-preview-val" style={{ color: 'var(--accent)' }}>{macros.protein}</span>
              <span className="macro-preview-label">{t('protein_cap')}</span>
            </div>
            <div className="macro-preview-item">
              <span className="macro-preview-val" style={{ color: 'var(--blue)' }}>{macros.carbs}</span>
              <span className="macro-preview-label">{t('carbs')}</span>
            </div>
            <div className="macro-preview-item">
              <span className="macro-preview-val" style={{ color: 'var(--yellow)' }}>{macros.fat}</span>
              <span className="macro-preview-label">{t('fat')}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 16 }} onClick={handleAdd}>
            <Plus size={18} /> {t('add_to')} {getMealName(mealType, t)}
          </button>
        </div>

        <div className="card" style={{ marginTop: 8 }}>
          <h5>{t('quick_portions')}</h5>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: selected.servingLabel, g: selected.servingG },
              { label: '50g', g: 50 },
              { label: '100g', g: 100 },
              { label: '150g', g: 150 },
              { label: '200g', g: 200 },
              { label: '250g', g: 250 },
            ].map(p => (
              <button
                key={p.label}
                className="btn btn-ghost btn-sm"
                onClick={() => setGrams(String(p.g))}
                style={{ fontSize: '0.72rem' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Category groups for browsing
  const categories = [...new Set(FOOD_DATABASE.map(f => f.category))];

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={onClose}>
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontSize: '1rem' }}>{t('search_food')}</h2>
        <div />
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search_foods')}
        autoFocus
        style={{ marginBottom: 12 }}
      />

      {query.length >= 2 ? (
        results.length > 0 ? (
          <div className="food-results">
            {results.map((f, i) => (
              <button key={i} className="catalog-item" onClick={() => { setSelected(f); setGrams(''); }}>
                <div>
                  <span className="catalog-name">{f.name}</span>
                  <span className="catalog-muscles">{f.cal} {t('kcal')}/100g · P{f.protein} C{f.carbs} F{f.fat}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center" style={{ padding: 20 }}>{t('no_results')}</p>
        )
      ) : (
        <div>
          {categories.map(cat => (
            <div key={cat}>
              <h5>{cat}</h5>
              <div className="food-results">
                {FOOD_DATABASE.filter(f => f.category === cat).slice(0, 4).map((f, i) => (
                  <button key={i} className="catalog-item" onClick={() => { setSelected(f); setGrams(''); }}>
                    <div>
                      <span className="catalog-name">{f.name}</span>
                      <span className="catalog-muscles">{f.cal} {t('kcal')}/100g</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Barcode Scanner ──

function BarcodeScanner({ onResult, onClose }) {
  const { t } = useT();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const [status, setStatus] = useState('starting'); // starting | scanning | found | error | unsupported
  const [product, setProduct] = useState(null);
  const [grams, setGrams] = useState('');
  const [mealType, setMealType] = useState('Lunch');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Check BarcodeDetector support
      if (!('BarcodeDetector' in window)) {
        setStatus('unsupported');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('scanning');
        scanLoop();
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    async function scanLoop() {
      if (cancelled || scanningRef.current) return;
      scanningRef.current = true;

      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] });

      const tick = async () => {
        if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
          if (!cancelled) requestAnimationFrame(tick);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            setStatus('found');
            if (navigator.vibrate) navigator.vibrate(100);
            // Fetch nutrition data
            const data = await fetchBarcodeNutrition(code);
            if (data) {
              setProduct(data);
            } else {
              setProduct({ name: `Product ${code}`, barcode: code, per100g: { cal: 0, protein: 0, carbs: 0, fat: 0 } });
            }
            // Stop camera
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            return;
          }
        } catch { /* detection failed, retry */ }
        if (!cancelled) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleAdd = () => {
    if (!product) return;
    const g = parseFloat(grams) || 100;
    const ratio = g / 100;
    const n = product.per100g;
    onResult({
      name: product.name + (product.brand ? ` (${product.brand})` : ''),
      grams: g,
      mealType,
      calories: Math.round(n.cal * ratio),
      protein: Math.round(n.protein * ratio * 10) / 10,
      carbs: Math.round(n.carbs * ratio * 10) / 10,
      fat: Math.round(n.fat * ratio * 10) / 10,
      barcode: product.barcode,
      source: 'barcode',
    });
  };

  if (product) {
    const g = parseFloat(grams) || 100;
    const ratio = g / 100;
    const n = product.per100g;
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-icon" onClick={onClose}><ChevronLeft size={18} /></button>
          <h2 style={{ fontSize: '1rem' }}>{t('scanned_product')}</h2>
          <div />
        </div>
        <div className="card">
          {product.image && (
            <img src={product.image} alt="" style={{ width: 80, height: 80, objectFit: 'contain', display: 'block', margin: '0 auto 10px', borderRadius: 8 }} />
          )}
          <h3 style={{ fontSize: '0.95rem', textAlign: 'center' }}>{product.name}</h3>
          {product.brand && <p className="text-xs text-muted text-center">{product.brand}</p>}
          {product.nutriScore && (
            <div className="text-center" style={{ margin: '6px 0' }}>
              <span className={`score-badge ${product.nutriScore === 'a' ? 'good' : product.nutriScore <= 'c' ? 'ok' : 'poor'}`}>
                {t('nutri_score')} {product.nutriScore.toUpperCase()}
              </span>
            </div>
          )}

          <div className="form-grid" style={{ marginTop: 12 }}>
            <label>
              <span>{t('amount_g')}</span>
              <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="100" />
            </label>
            <label>
              <span>{t('meal')}</span>
              <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPES.map(m => <option key={m} value={m}>{getMealName(m, t)}</option>)}
              </select>
            </label>
          </div>

          <div className="macro-preview" style={{ marginTop: 12 }}>
            <div className="macro-preview-item">
              <span className="macro-preview-val">{Math.round(n.cal * ratio)}</span>
              <span className="macro-preview-label">{t('kcal')}</span>
            </div>
            <div className="macro-preview-item">
              <span className="macro-preview-val" style={{ color: 'var(--accent)' }}>{(n.protein * ratio).toFixed(1)}</span>
              <span className="macro-preview-label">{t('protein_cap')}</span>
            </div>
            <div className="macro-preview-item">
              <span className="macro-preview-val" style={{ color: 'var(--blue)' }}>{(n.carbs * ratio).toFixed(1)}</span>
              <span className="macro-preview-label">{t('carbs')}</span>
            </div>
            <div className="macro-preview-item">
              <span className="macro-preview-val" style={{ color: 'var(--yellow)' }}>{(n.fat * ratio).toFixed(1)}</span>
              <span className="macro-preview-label">{t('fat')}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 16 }} onClick={handleAdd}>
            <Plus size={18} /> {t('add_to')} {getMealName(mealType, t)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-page">
      <div className="cam-container">
        <video ref={videoRef} className="cam-video" playsInline muted />
        <div className="scan-overlay">
          <div className="scan-frame" />
        </div>
        <div className="cam-top">
          <button className="cam-btn" onClick={onClose}><ChevronLeft size={18} /></button>
          <span className="cam-exercise-label">{t('scan_barcode_title')}</span>
          <div style={{ width: 38 }} />
        </div>
        {status === 'scanning' && (
          <div className="scan-hint">{t('point_camera_barcode')}</div>
        )}
        {status === 'unsupported' && (
          <div className="cam-loading">
            <p style={{ color: 'var(--yellow)', marginBottom: 8 }}>
              {t('barcode_not_supported')}
            </p>
            <p className="text-sm text-muted">{t('barcode_try_other')}</p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 12 }}>{t('go_back')}</button>
          </div>
        )}
        {status === 'error' && (
          <div className="cam-loading">
            <p style={{ color: 'var(--red)' }}>{t('camera_denied')}</p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 12 }}>{t('go_back')}</button>
          </div>
        )}
        {status === 'found' && (
          <div className="cam-loading">
            <div className="spinner" />
            <p className="text-sm">{t('looking_up_product')}</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Food Photo ──

function FoodPhoto({ onAdd, onClose }) {
  const { t } = useT();
  const [photoUrl, setPhotoUrl] = useState(null);
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('200');
  const [mealType, setMealType] = useState('Lunch');
  const [estimatedCal, setEstimatedCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const fileRef = useRef(null);

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  };

  const handleAdd = () => {
    if (!name) return;
    onAdd({
      name,
      grams: parseFloat(grams) || 200,
      mealType,
      calories: parseInt(estimatedCal) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      photoUrl,
      source: 'photo',
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={onClose}><ChevronLeft size={18} /></button>
        <h2 style={{ fontSize: '1rem' }}>{t('photo_your_plate')}</h2>
        <div />
      </div>

      {!photoUrl ? (
        <div className="upload-zone" onClick={() => fileRef.current?.click()}>
          <div className="upload-content">
            <div className="upload-icon"><Camera size={24} /></div>
            <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('take_photo_meal')}</span>
            <span className="text-xs text-muted">{t('tap_open_camera')}</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 8 }}>
            <img src={photoUrl} alt="Meal" style={{ width: '100%', borderRadius: 'var(--radius-sm)', maxHeight: 200, objectFit: 'cover' }} />
          </div>

          <div className="card">
            <p className="text-xs text-muted" style={{ marginBottom: 10 }}>
              {t('photo_plate_desc')}
            </p>

            <div className="form-grid">
              <label className="full-width">
                <span>{t('what_did_you_eat')}</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('meal_placeholder')} />
              </label>
              <label>
                <span>{t('portion_g')}</span>
                <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="200" />
              </label>
              <label>
                <span>{t('meal')}</span>
                <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                  {MEAL_TYPES.map(m => <option key={m} value={m}>{getMealName(m, t)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('calories_est')}</span>
                <input type="number" value={estimatedCal} onChange={(e) => setEstimatedCal(e.target.value)} placeholder={t('kcal')} />
              </label>
              <label>
                <span>{t('protein_g')}</span>
                <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" />
              </label>
              <label>
                <span>{t('carbs_g')}</span>
                <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" />
              </label>
              <label>
                <span>{t('fat_g')}</span>
                <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" />
              </label>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 12 }} onClick={handleAdd} disabled={!name}>
              <Plus size={18} /> {t('add_to')} {getMealName(mealType, t)}
            </button>
          </div>

          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => { setPhotoUrl(null); setName(''); }}>
            {t('retake_photo')}
          </button>
        </>
      )}
    </div>
  );
}

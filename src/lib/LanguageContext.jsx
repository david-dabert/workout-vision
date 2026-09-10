import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// English is bundled (default fallback, always available synchronously).
// French loads on demand (~47KB only when user's locale is fr).
import enData from '../locales/en.json';

// ─── Detect initial language ───
function detectLang() {
  try {
    const saved = localStorage.getItem('wv_lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch (_) {}
  if (typeof navigator !== 'undefined') {
    const bl = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (bl.startsWith('fr')) return 'fr';
  }
  return 'en';
}

// ─── Locale cache ───
const locales = { en: enData };

async function loadLocale(lang) {
  if (locales[lang]) return locales[lang];
  if (lang === 'fr') {
    const mod = await import('../locales/fr.json');
    locales.fr = mod.default;
    return locales.fr;
  }
  return enData;
}

// ─── React Context ───
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);
  const [strings, setStrings] = useState(() => locales[lang] || enData);
  const formChecksRef = useRef(enData._formChecks || {});

  useEffect(() => {
    let cancelled = false;
    loadLocale(lang).then((data) => {
      if (!cancelled) {
        setStrings(data);
        formChecksRef.current = data._formChecks || {};
      }
    });
    return () => { cancelled = true; };
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (newLang !== 'en' && newLang !== 'fr') return;
    setLangState(newLang);
    try { localStorage.setItem('wv_lang', newLang); } catch (_) {}
    try { document.documentElement.lang = newLang; } catch (_) {}
  }, []);

  const t = useCallback((key, params) => {
    let str = strings[key] || enData[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (k === 'key') continue;
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
      }
    }
    return str;
  }, [strings]);

  const tExercise = useCallback((exerciseKey, fallbackName) => {
    const key = `ex.${exerciseKey}`;
    const val = strings[key];
    if (val) return val;
    return enData[key] || fallbackName || exerciseKey;
  }, [strings]);

  const tFormCheck = useCallback((englishStr) => {
    if (lang === 'en' || !englishStr) return englishStr;
    return formChecksRef.current[englishStr] || englishStr;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tExercise, tFormCheck }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within LanguageProvider');
  return ctx;
}

// Module-level t() for non-React code (canvas overlays, utilities).
// Reads directly from localStorage so it stays in sync.
export function tModule(key, params) {
  let lang = 'en';
  try {
    const saved = localStorage.getItem('wv_lang');
    if (saved === 'en' || saved === 'fr') lang = saved;
  } catch (_) {}
  const data = locales[lang] || enData;
  let str = data[key] || enData[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (k === 'key') continue;
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
    }
  }
  return str;
}

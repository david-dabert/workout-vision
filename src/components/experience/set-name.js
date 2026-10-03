// The name of a saved set's exercise for the welcome line (Choice.jsx): the card's name, then the guide's, then
// the locale's, each taken only when it is a name and not the key given back, so the welcome never shows an
// internal key (third audit C25, 3 October). '' when nothing can name it.
export function setName({ key, lang, meta, nameOf, tExercise }) {
  const own = n => (n && n !== key ? n : '');
  return meta?.[key]?.[lang] || own(nameOf?.(key, lang)) || own(tExercise?.(key)) || '';
}

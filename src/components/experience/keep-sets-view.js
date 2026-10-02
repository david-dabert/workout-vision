// The words and the sequence of a restore from a backup file (KeepSets.jsx), kept apart from the component so
// tests can run them.
import { readBackup, restoreBackup } from '../../lib/keep-sets';
/** What a restore did, in the person's words; { unlisted } when the sets are written but could not be listed. */
export function restoredLine({ added = 0, present = 0, skipped = 0, unlisted = false }, fr) {
  if (unlisted) return fr ? 'Rouvrez vos séries pour les voir.' : 'Open your sets again to see them.';
  const parts = [fr ? `${added} ${added > 1 ? 'séries restaurées' : 'série restaurée'}.` : `${added} ${added === 1 ? 'set' : 'sets'} restored.`];
  if (present) parts.push(fr ? `${present} ${present > 1 ? 'étaient déjà' : 'était déjà'} sur ce téléphone.` : `${present} ${present === 1 ? 'was' : 'were'} already on this phone.`);
  if (skipped) parts.push(fr ? `${skipped} ${skipped > 1 ? 'séries illisibles n’ont' : 'série illisible n’a'} pas été restaurée${skipped > 1 ? 's' : ''}.` : `${skipped} unreadable ${skipped === 1 ? 'set was' : 'sets were'} not restored.`);
  return parts.join(' ');
}

/**
 * A backup file's text put back on this phone: the message to show, and the sets as listed again when they
 * could be read. The sets are written before the list is read, so a failed read does not report the restore
 * as failed (review of 2 October). restore and list are the storage's own unless a test gives others.
 */
export async function restoreFlow(text, fr, { restore = restoreBackup, list }) {
  const r = readBackup(text);
  if (r.error) return { note: r.error === 'newer-version'
    ? (fr ? 'Cette sauvegarde vient d’une version plus récente de l’app. Mettez l’app à jour, puis réessayez.' : 'This backup comes from a newer version of the app. Update the app, then try again.')
    : (fr ? 'Ce fichier n’est pas une sauvegarde de vos séries.' : 'This file is not a backup of your sets.') };
  let done;
  try { done = await restore(r.sets); }
  catch { return { note: fr ? 'La sauvegarde n’a pas pu être restaurée. Réessayez.' : 'The backup could not be restored. Try again.' }; }
  const line = restoredLine({ ...done, skipped: r.skipped }, fr);
  try { return { note: line, sets: await list() }; }
  catch { return { note: `${line} ${restoredLine({ unlisted: true }, fr)}` }; }
}

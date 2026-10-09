// The words of the coach's programmes (Espace pro, Pro.jsx; the client's programme, Programme.jsx; the programme's PDF,
// programme-pdf.js; the report's target line), written 6 October 2026, register vous (R10), for David's approval
// (test/real-phone/swarm/copy-pro.md). Wellness words only: the builder serves coaches and physiotherapists, named as
// users and nothing more; no word of care (programme.test.js checks every string). French typography as in the rest of
// the app: typographic apostrophes, a no-break space before a colon and between a number and its unit.
const NB = ' ';

const plural = (n, one, many) => (n > 1 ? many : one);
const pluralEn = (n, one, many) => (n === 1 ? one : many);

// A rest as a coach says it: 45 s, 2 min, 1 min 30. No rest: none.
function restFr(s) {
  if (!s) return 'sans récup.';
  if (s < 60) return `${s}${NB}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}${NB}min${NB}${String(r).padStart(2, '0')}` : `${m}${NB}min`;
}
function restEn(s) {
  if (!s) return 'no rest';
  if (s < 60) return `${s}${NB}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}${NB}min${NB}${r}${NB}s` : `${m}${NB}min`;
}

export const PRO = {
  fr: {
    // The choice of lift (Choice.jsx): the coach's row and the client's.
    choiceRow: 'Espace pro',
    choiceRowSub: 'Pour les coachs et les kinésithérapeutes',
    programmeRow: 'Votre programme',
    // The builder (Pro.jsx).
    eyebrow: 'Espace pro',
    title: 'Programmes',
    sub: 'Composez une séance pour un client, puis envoyez-la en PDF ou en lien. Il l’ouvre dans l’app et filme chaque série : ses répétitions sont comptées sur son téléphone.',
    users: 'Pour les coachs et les kinésithérapeutes.',
    privacy: 'Rien n’est envoyé : vos programmes restent sur ce téléphone jusqu’à ce que vous les partagiez.',
    storageOff: 'Ce téléphone ne garde pas les brouillons (navigation privée ?) : partagez le programme avant de quitter.',
    newProgramme: 'Nouveau programme',
    draftsHead: 'Sur ce téléphone',
    untitled: 'Sans titre',
    draftMeta: (n, date) => `${n}${NB}${plural(n, 'exercice', 'exercices')} · modifié le ${date}`,
    back: 'Retour',
    editTitle: 'Programme',
    titleLabel: 'Titre',
    titlePlaceholder: 'Haut du corps, semaine 1',
    whoLabel: 'Pour (facultatif)',
    whoPlaceholder: 'Prénom du client',
    noteLabel: 'Note générale (facultatif)',
    notePlaceholder: 'Échauffement, consignes, fréquence…',
    exercisesHead: 'Exercices',
    noExercise: 'Aucun exercice pour l’instant.',
    add: 'Ajouter un exercice',
    sets: 'Séries',
    reps: 'Rép.',
    rest: 'Récup. (s)',
    setsLong: 'Nombre de séries',
    repsLong: 'Répétitions par série',
    restLong: 'Récupération en secondes',
    itemNotePlaceholder: 'Consigne (facultatif)',
    moveUp: name => `Monter ${name}`,
    moveDown: name => `Descendre ${name}`,
    remove: 'Retirer',
    removeLabel: name => `Retirer ${name}`,
    needs: 'Donnez un titre et ajoutez un exercice pour partager.',
    sharePdf: 'Partager le PDF',
    preparing: 'Préparation du PDF…',
    shareLink: 'Partager le lien',
    copyLink: 'Copier le lien',
    copied: 'Lien copié.',
    pdfDownloaded: 'PDF téléchargé.',
    pdfError: 'Le PDF n’a pas pu être préparé. Réessayez.',
    linkError: 'Le lien n’a pas pu être préparé. Réessayez.',
    copyFailed: 'Copie impossible : sélectionnez le lien ci-dessous.',
    linkLabel: 'Lien du programme',
    tooLong: 'Programme trop long pour un lien : retirez un exercice ou raccourcissez les notes.',
    linkText: title => `Votre programme : ${title}. Ouvrez ce lien sur votre téléphone, puis filmez chaque série.`,
    deleteDraft: 'Supprimer ce programme',
    confirmDelete: 'Supprimer ce programme de ce téléphone ?',
    confirmYes: 'Supprimer',
    cancel: 'Annuler',
    pickBack: 'Retour au programme',
    // The programme's PDF (programme-pdf.js).
    pdfKicker: 'Programme',
    pdfWho: 'Pour',
    pdfCount: 'Exercices',
    pdfColumns: ['', 'Exercice', 'Séries × rép.', 'Récup.'],
    pdfNote: 'Note',
    // The programme's QR code on its PDF (programme-pdf.js, 9 October; awaits David's approval, R10).
    pdfQrLabel: 'Ouvrir le programme',
    pdfFoot: 'Filmez chaque série avec votre téléphone : les répétitions sont comptées, et le rapport de séance montre le prévu à côté du compté.',
    fileName: 'programme',
    // The client's programme (Programme.jsx).
    clientEyebrow: 'Programme',
    whoLine: who => `Pour ${who}`,
    today: (done, total) => `Aujourd’hui : ${done}${NB}sur${NB}${total} ${plural(total, 'exercice terminé', 'exercices terminés')}`,
    target: (sets, reps, rest) => `${sets}${NB}×${NB}${reps} · ${rest ? `récup. ${restFr(rest)}` : restFr(rest)}`,
    restText: restFr,
    setDone: (i, n, reps) => `Série ${i} : ${n} ${plural(n, 'répétition comptée', 'répétitions comptées')} sur ${reps} ${plural(reps, 'prévue', 'prévues')}`,
    setTodo: i => `Série ${i} : à faire`,
    film: name => `Filmer ${name}`,
    tapHint: 'Touchez un exercice pour le filmer. Chaque série enregistrée s’affiche ici, comptée, à côté de l’objectif.',
    sendBack: 'Après une série, « Rapport de séance » prépare un PDF à envoyer à votre coach.',
    clientPrivacy: 'Le programme et vos séries restent sur ce téléphone.',
    othersHead: 'Autres programmes reçus',
    removeProgramme: 'Retirer ce programme',
    confirmRemove: 'Retirer ce programme de ce téléphone ? Vos séries restent dans Vos séries.',
    confirmRemoveYes: 'Retirer',
    opening: 'Ouverture du programme…',
    none: 'Aucun programme sur ce téléphone.',
    noneSub: 'Ouvrez le lien que votre coach vous a envoyé.',
    errorTitle: 'Ce lien ne s’ouvre pas',
    errors: {
      empty: 'Le lien est incomplet ou abîmé. Demandez à votre coach de vous le renvoyer.',
      malformed: 'Le lien est incomplet ou abîmé. Demandez à votre coach de vous le renvoyer.',
      'too-long': 'Le lien est trop long pour être un programme de l’app.',
      unsupported: 'Ce navigateur ne sait pas lire ce lien. Mettez à jour votre téléphone ou votre navigateur, puis rouvrez-le.',
      'unknown-exercise': 'Ce programme contient un exercice que cette version de l’app ne connaît pas. Rechargez l’app, puis rouvrez le lien.',
      'bad-value': 'Une valeur du programme sort des limites de l’app. Demandez à votre coach de vous le renvoyer.',
    },
    errorBack: 'Retour aux exercices',
    // The session report (report-sheet.js): the target beside the count.
    planned: target => `Prévu : ${target}`,
  },
  en: {
    choiceRow: 'Pro',
    choiceRowSub: 'For coaches and physiotherapists',
    programmeRow: 'Your programme',
    eyebrow: 'Pro',
    title: 'Programmes',
    sub: 'Build a session for a client, then send it as a PDF or a link. They open it in the app and film each set: their reps are counted on their phone.',
    users: 'For coaches and physiotherapists.',
    privacy: 'Nothing is sent: your programmes stay on this phone until you share them.',
    storageOff: 'This phone does not keep drafts (private browsing?): share the programme before you leave.',
    newProgramme: 'New programme',
    draftsHead: 'On this phone',
    untitled: 'Untitled',
    draftMeta: (n, date) => `${n}${NB}${pluralEn(n, 'exercise', 'exercises')} · edited ${date}`,
    back: 'Back',
    editTitle: 'Programme',
    titleLabel: 'Title',
    titlePlaceholder: 'Upper body, week 1',
    whoLabel: 'For (optional)',
    whoPlaceholder: 'Client’s first name',
    noteLabel: 'General note (optional)',
    notePlaceholder: 'Warm-up, cues, how often…',
    exercisesHead: 'Exercises',
    noExercise: 'No exercises yet.',
    add: 'Add an exercise',
    sets: 'Sets',
    reps: 'Reps',
    rest: 'Rest (s)',
    setsLong: 'Number of sets',
    repsLong: 'Reps per set',
    restLong: 'Rest in seconds',
    itemNotePlaceholder: 'Cue (optional)',
    moveUp: name => `Move ${name} up`,
    moveDown: name => `Move ${name} down`,
    remove: 'Remove',
    removeLabel: name => `Remove ${name}`,
    needs: 'Give it a title and add an exercise to share it.',
    sharePdf: 'Share the PDF',
    preparing: 'Preparing the PDF…',
    shareLink: 'Share the link',
    copyLink: 'Copy the link',
    copied: 'Link copied.',
    pdfDownloaded: 'PDF downloaded.',
    pdfError: 'The PDF could not be prepared. Try again.',
    linkError: 'The link could not be prepared. Try again.',
    copyFailed: 'Could not copy: select the link below.',
    linkLabel: 'Programme link',
    tooLong: 'Too long for a link: remove an exercise or shorten the notes.',
    linkText: title => `Your programme: ${title}. Open this link on your phone, then film each set.`,
    deleteDraft: 'Delete this programme',
    confirmDelete: 'Delete this programme from this phone?',
    confirmYes: 'Delete',
    cancel: 'Cancel',
    pickBack: 'Back to the programme',
    pdfKicker: 'Programme',
    pdfWho: 'For',
    pdfCount: 'Exercises',
    pdfColumns: ['', 'Exercise', 'Sets × reps', 'Rest'],
    pdfNote: 'Note',
    pdfQrLabel: 'Open the programme',
    pdfFoot: 'Film each set with your phone: the reps are counted, and the session report shows what was planned beside what was counted.',
    fileName: 'programme',
    clientEyebrow: 'Programme',
    whoLine: who => `For ${who}`,
    today: (done, total) => `Today: ${done}${NB}of${NB}${total} ${pluralEn(total, 'exercise', 'exercises')} done`,
    target: (sets, reps, rest) => `${sets}${NB}×${NB}${reps} · ${rest ? `rest ${restEn(rest)}` : restEn(rest)}`,
    restText: restEn,
    setDone: (i, n, reps) => `Set ${i}: ${n} ${pluralEn(n, 'rep', 'reps')} counted of ${reps} planned`,
    setTodo: i => `Set ${i}: to do`,
    film: name => `Film ${name}`,
    tapHint: 'Tap an exercise to film it. Each set you save shows here, counted, beside the target.',
    sendBack: 'After a set, “Session report” prepares a PDF to send to your coach.',
    clientPrivacy: 'The programme and your sets stay on this phone.',
    othersHead: 'Other programmes received',
    removeProgramme: 'Remove this programme',
    confirmRemove: 'Remove this programme from this phone? Your sets stay in Your sets.',
    confirmRemoveYes: 'Remove',
    opening: 'Opening the programme…',
    none: 'No programme on this phone.',
    noneSub: 'Open the link your coach sent you.',
    errorTitle: 'This link does not open',
    errors: {
      empty: 'The link is incomplete or damaged. Ask your coach to send it again.',
      malformed: 'The link is incomplete or damaged. Ask your coach to send it again.',
      'too-long': 'The link is too long to be one of the app’s programmes.',
      unsupported: 'This browser cannot read the link. Update your phone or browser, then open it again.',
      'unknown-exercise': 'This programme holds an exercise this version of the app does not know. Reload the app, then open the link again.',
      'bad-value': 'A value in the programme is outside the app’s limits. Ask your coach to send it again.',
    },
    errorBack: 'Back to the exercises',
    planned: target => `Planned: ${target}`,
  },
};

/** Every string of PRO in one language, functions called with sample values, for the tests and for David's file. */
export function allStrings(lang) {
  const out = [];
  const walk = v => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { const r = v.length >= 3 ? v(3, 10, 90) : v.length === 2 ? v(2, '6 oct.') : v.length === 1 ? v(v === PRO[lang].restText ? 90 : 'Camille') : v(); walk(r); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(PRO[lang]);
  return out;
}

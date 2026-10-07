// The words of installing the app on the home screen (install.js, Install.jsx), register vous (R10). Pending David's
// approval: test/real-phone/swarm/copy-install.md lists them. French typography as in the rest of the app: curly
// apostrophes, U+202F before ; ? ! and inside « », U+00A0 before a colon.
// The iOS labels are Safari's own French words ("Partager", "Sur l'écran d'accueil", "Ajouter"), as iOS shows them.
// Status of the seven days: WebKit, "Full Third-Party Cookie Blocking and More", 24 March 2020 (literature), the
// sentence the history already says (KeepSets.jsx).
const N = ' ';

export const INSTALL = {
  fr: {
    row: 'Installer l’app',
    rowSub: 'Sur l’écran d’accueil, en plein écran',
    title: 'Installer l’app',
    close: 'Fermer',
    steps: [
      { lead: 'Touchez', what: 'Partager', note: `Sur iOS${N}26, il se trouve sous le bouton ⋯ de la barre.` },
      { lead: 'Faites défiler, puis touchez', what: 'Sur l’écran d’accueil' },
      { lead: 'Touchez', what: 'Ajouter', note: 'en haut à droite.' },
    ],
    stepsLabel: 'Trois étapes',
    why: `Safari peut effacer vos séries après sept jours d’utilisation sans ouvrir l’app${N}; installée, l’app s’ouvre en plein écran.`,
    keepWhy: 'Sur iPhone, Safari peut effacer vos séries après sept jours d’utilisation sans ouvrir l’app. Installez-la sur l’écran d’accueil, ou gardez une sauvegarde.',
    openTitle: { ios: 'Ouvrez le lien dans Safari', other: 'Ouvrez le lien dans Chrome' },
    inApp: { ios: 'Le navigateur de cette app ne peut pas installer l’app. Copiez le lien, puis collez-le dans Safari.', other: 'Le navigateur de cette app ne peut pas installer l’app. Copiez le lien, puis collez-le dans Chrome.' },
    iosOther: 'Ce navigateur ne peut pas ajouter l’app à l’écran d’accueil. Copiez le lien, puis collez-le dans Safari.',
    copy: 'Copier le lien',
    copied: 'Lien copié.',
    copyFailed: 'Copie impossible. Touchez longuement le lien pour le copier.',
    suggestTitle: 'Installez l’app sur l’écran d’accueil.',
    suggestOther: 'Elle s’ouvre alors en plein écran, d’une touche.',
    suggestKey: 'Installer l’app',
    later: 'Non merci',
    laterNote: 'Le lien reste en bas de la liste des exercices.',
  },
  en: {
    row: 'Install the app',
    rowSub: 'On your home screen, full screen',
    title: 'Install the app',
    close: 'Close',
    steps: [
      { lead: 'Tap', what: 'Share', note: 'On iOS 26, it is under the ⋯ button of the bar.' },
      { lead: 'Scroll, then tap', what: 'Add to Home Screen' },
      { lead: 'Tap', what: 'Add', note: 'at the top right.' },
    ],
    stepsLabel: 'Three steps',
    why: 'Safari may erase your sets after seven days of use without opening the app; installed, the app opens full screen.',
    keepWhy: 'On iPhone, Safari may erase your sets after seven days of use without opening the app. Install it on your home screen, or keep a backup.',
    openTitle: { ios: 'Open the link in Safari', other: 'Open the link in Chrome' },
    inApp: { ios: 'This app’s browser cannot install the app. Copy the link, then paste it into Safari.', other: 'This app’s browser cannot install the app. Copy the link, then paste it into Chrome.' },
    iosOther: 'This browser cannot add the app to your home screen. Copy the link, then paste it into Safari.',
    copy: 'Copy the link',
    copied: 'Link copied.',
    copyFailed: 'Could not copy. Touch and hold the link to copy it.',
    suggestTitle: 'Install the app on your home screen.',
    suggestOther: 'It then opens full screen, in one tap.',
    suggestKey: 'Install the app',
    later: 'No thanks',
    laterNote: 'The link stays at the bottom of the exercise list.',
  },
};

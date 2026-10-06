// The words of "À propos" (About.jsx), approved by David on 6 October 2026, register vous (R10). Each sentence is
// its own line, as written. French typography as in the rest of the app: typographic apostrophes, a non-breaking
// space between a number and its unit.
const NB = ' ';

export const ABOUT = {
  fr: {
    link: 'À propos',
    title: 'J’ai construit l’outil dont j’avais besoin il y a trois ans.',
    paragraphs: [
      [
        `Il y a trois ans, je pesais 170${NB}kilogrammes.`,
        'Mon médecin a eu l’honnêteté de me dire que si je ne faisais rien, je ne verrais pas mes deux filles avoir dix-huit ans.',
        'Ce fut un réveil brutal.',
      ],
      [
        'Depuis, j’ai fait de ma santé une discipline.',
        'Je lis chaque jour la littérature en sciences du sport.',
        'J’observe ceux qui s’entraînent bien, je paie des coachs pour me corriger, je suis une alimentation stricte.',
        `163${NB}séances en salle depuis février, aucune semaine manquée depuis 29${NB}semaines.`,
        `En septembre, je pesais 105${NB}kilogrammes.`,
      ],
      [
        'Je ne suis pas un champion.',
        'Je suis un pratiquant intermédiaire qui a commis toutes les erreurs du débutant.',
        'J’ai quatre sœurs et deux filles.',
        'Quand je vois en salle une femme seule, motivée, qui fait tout par elle-même, je pense à elles.',
        'Quand je vois un débutant répéter mes erreurs, je pense à celui que j’étais.',
      ],
      [
        'WorkoutVision est ce que j’aurais voulu avoir.',
        'Vous filmez votre série avec votre téléphone.',
        'L’application compte vos répétitions et vous montre comment vous les avez faites.',
        'Vos vidéos ne quittent jamais votre téléphone.',
        'Elle sert le débutant, le pratiquant confirmé, le coach et le kinésithérapeute.',
      ],
      [
        'L’application est gratuite et son code est public.',
        'Elle n’est pas née d’un plan d’affaires, mais d’une promesse faite à mes filles.',
        'J’entends les voir vieillir.',
        'Si cet outil aide d’autres personnes à voir vieillir les leurs, il aura rempli sa mission.',
      ],
    ],
    signature: 'David Dabert, Bordeaux',
    photos: {
      portrait: { alt: 'David Dabert', caption: '' },
      sanSiro: { alt: 'David Dabert au stade San Siro, septembre 2023', caption: 'Septembre 2023' },
      dordogne: { alt: 'David Dabert avec ses deux filles, Dordogne, septembre 2026, visages floutés', caption: 'Septembre 2026' },
    },
  },
  en: {
    link: 'About',
    title: 'I built the tool I needed three years ago.',
    paragraphs: [
      [
        `Three years ago, I weighed 170${NB}kilograms.`,
        'My doctor had the honesty to tell me that if I did nothing, I would not see my two daughters reach eighteen.',
        'It was a brutal awakening.',
      ],
      [
        'Since then, I have made my health a discipline.',
        'I read the sports science literature every day.',
        'I watch those who train well, I pay coaches to correct me, I follow a strict diet.',
        `163${NB}gym sessions since February, not one week missed in 29${NB}weeks.`,
        `In September, I weighed 105${NB}kilograms.`,
      ],
      [
        'I am not a champion.',
        'I am an intermediate lifter who has made every beginner’s mistake.',
        'I have four sisters and two daughters.',
        'When I see a woman at the gym, alone, motivated, doing everything by herself, I think of them.',
        'When I see a beginner repeating my mistakes, I think of the man I was.',
      ],
      [
        'WorkoutVision is what I wish I had had.',
        'You film your set with your phone.',
        'The app counts your reps and shows you how you performed them.',
        'Your videos never leave your phone.',
        'It serves the beginner, the experienced lifter, the coach and the physiotherapist.',
      ],
      [
        'The app is free and its code is public.',
        'It was not born of a business plan, but of a promise made to my daughters.',
        'I intend to see them grow old.',
        'If this tool helps others see their own children grow old, it will have fulfilled its mission.',
      ],
    ],
    signature: 'David Dabert, Bordeaux',
    photos: {
      portrait: { alt: 'David Dabert', caption: '' },
      sanSiro: { alt: 'David Dabert at San Siro stadium, September 2023', caption: 'September 2023' },
      dordogne: { alt: 'David Dabert with his two daughters, Dordogne, September 2026, faces blurred', caption: 'September 2026' },
    },
  },
};

// The three photos in public/about/ (resized, metadata stripped), with their pixel sizes so the page keeps their
// place before they load.
export const PHOTOS = {
  portrait: { file: 'portrait.jpg', width: 795, height: 1200 },
  sanSiro: { file: 'san-siro-2023.jpg', width: 900, height: 1200 },
  dordogne: { file: 'dordogne-2026.jpg', width: 675, height: 1200 },
};

// The sets shown on the About page, each the app's own replay exported by David (media/demo/, re-encoded for the web
// into public/demo/, sound and metadata removed). The count is the app's; David kept it (no correction note on the
// video). Captions to be confirmed by David on his iPhone (R10, 6 October). One today; up to five.
export const DEMOS = [
  { file: 'bicep-curl-5', width: 540, height: 960, app: 5, kept: 5,
    fr: `Curl biceps · 5${NB}répétitions comptées par l’app, 5 par moi`, en: `Biceps curl · 5${NB}reps counted by the app, 5 by me` },
];

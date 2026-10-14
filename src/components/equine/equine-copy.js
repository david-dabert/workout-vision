// The words of EquiVision (Equine.jsx), register vous (R10), French typography as in the rest of the app: typographic
// apostrophes, a no-break space before a colon or a semicolon and between a number and its unit, no em dash.
// Status of every line: written 14 October 2026 in the honesty pass (audit EQ-01 to EQ-24), revised the same day after
// review (analyser for analyse, never lire; no engine jargon; examen locomoteur), awaiting David's approval (R10).
// Sources and R9 statuses of the statements are in the comments beside them.
const NB = ' ';
const NNB = ' ';

export const EQUINE_COPY = {
  fr: {
    eyebrow: 'EquiVision',
    title: 'Le trot, foulée par foulée',
    sub: 'Ce que regarde un examen locomoteur, montré sur un cheval simulé. L’appli n’analyse pas encore les vidéos de votre cheval.',

    videoHead: 'Une vidéo de cheval',
    demoName: 'Cheval monté en carrière',
    demoNote: `Clip de démonstration${NB}: l’appli n’analyse rien sur cette vidéo, aucun repère, aucun chiffre.`,
    // The preview switch (14 October 2026, David). Awaiting David's approval (R10).
    viewLabel: 'Affichage de la vidéo',
    viewPreview: 'Aperçu',
    viewRaw: 'Vidéo seule',
    previewNote: `Aperçu de l’objectif${NB}: les repères et les chiffres de cette vidéo montrent ce que l’appli mesurera. Ils ne sont pas encore mesurés.`,
    open: 'Ouvrir une vidéo de votre cheval',
    stays: `Elle reste sur votre téléphone${NB}: rien n’est envoyé.`,
    ownHead: 'Pas de mesure sur votre vidéo',
    // Fact about the app (status validated: no horse model exists anywhere in src, 14 October 2026).
    ownText: `Analyser la locomotion d’un cheval sur une vidéo n’est pas encore possible${NB}: l’appli n’a pas de modèle qui repère la tête, le garrot, le bassin ou les sabots d’un cheval. Votre vidéo s’affiche telle quelle, sans chiffre, sans courbe et sans avis.`,
    close: 'Fermer la vidéo',

    simHead: 'Un cheval simulé',
    // Status: convention (textbook description of the trot, two diagonal stances per stride).
    simIntro: `Ce cheval n’existe pas${NB}: ses mouvements sont écrits dans le code. Il montre ce qu’un examen locomoteur regarde au trot. La tête et le bassin descendent deux fois par foulée, une fois à chaque appui d’un diagonal.`,
    scenarios: { sound: 'Trot régulier', fore: 'Boiterie d’un antérieur', hind: 'Boiterie d’un postérieur' },
    scenariosGroup: 'Simulations',
    // Status: convention (the classic "head nod" and "hip hike" teaching; see src/lib/equine/simulation.ts).
    scenarioText: {
      sound: 'Les deux creux de chaque foulée ont la même profondeur, pour la tête comme pour le bassin.',
      fore: `La tête descend moins quand l’antérieur boiteux porte le poids${NB}: un creux sur deux est moins profond. Dans cette simulation, seule la tête change.`,
      hind: `Le bassin descend moins quand le postérieur boiteux porte le poids${NB}: un creux sur deux est moins profond. Dans cette simulation, seul le bassin change.`,
    },
    // The control samples the simulation as a phone video would be filmed (status convention: common phone rates).
    rateHead: 'Images par seconde de la simulation',
    rate: r => `${r}${NB}i/s`,
    chartHead: 'Courbe simulée',
    chartLabel: 'Montée et descente de la tête et du bassin du cheval simulé, avec les creux de chaque foulée',
    head: 'Tête',
    pelvis: 'Bassin',
    dipA: 'Creux A',
    dipB: 'Creux B',
    figuresHead: 'Ce que l’appli retrouve sur la courbe',
    stride: 'Durée de la foulée',
    strideSub: hz => `Soit ${hz}${NB}Hz`,
    headDiff: 'Écart des creux, tête',
    pelvisDiff: 'Écart des creux, bassin',
    programmed: v => `Programmé dans la simulation${NB}: ${v}`,
    noNumber: 'Pas de chiffre',
    refused: `Pas de chiffre${NB}: la courbe ne montre pas de foulées régulières.`,
    // Fact about the simulation (status validated by src/lib/equine/__tests__/kinematics.test.ts: at 25, 30 and 60
    // images a second the difference read back grows toward the one programmed, 18.1, 18.8, 19.9 mm for 20 mm).
    rateNote: `Changez le nombre d’images par seconde${NB}: moins il y en a, plus l’appli sous-estime l’écart programmé.`,
    // Fact about the engine (status validated by src/lib/equine/__tests__/kinematics.test.ts: the sign follows the start;
    // the engine looks for no dip in the first 3 samples, so dip A is the first dip it finds, not the curve's first).
    noLimb: `Quand les deux creux diffèrent, l’appli le voit, mais pas quelle jambe porte le poids${NB}: sans repérer les sabots, elle ne nomme aucun membre. Le creux A est seulement le premier qu’elle repère sur la courbe.`,
    // Source: Rhodin et al. 2017, PLoS ONE 12:e0176253 (222 Warmbloods judged sound by their owners; 6 mm head and
    // 3 mm pelvis thresholds). Status: literature (abstract read through a search summary, full text not checked).
    thresholds: `Pour comparer${NB}: les études utilisent souvent 6${NB}mm pour la tête et 3${NB}mm pour le bassin. Sur 222${NB}chevaux jugés sains par leur propriétaire, 72,5${NNB}% dépassent au moins un de ces seuils (Rhodin et al., 2017)${NB}: un écart n’est pas un diagnostic.`,

    circleHead: 'Sur le cercle',
    calcTag: 'Calcul',
    lean: 'Inclinaison théorique',
    leanSub: 'θ = arctan(v² / gR), avec le rayon et la vitesse choisis',
    radius: 'Rayon du cercle',
    speed: 'Vitesse au trot',
    // Sources: Dyson & Greve 2016, J Equine Vet Sci 38:1-7 (straight-line soundness is not a reliable indicator);
    // Pfau et al. 2012, Am J Vet Res 73:1890-1899 (measured lean close to the prediction); Macaire et al. 2023,
    // Animals 13:3319 (straight-line thresholds do not apply on the circle). Status: literature (abstracts read through
    // search summaries, full texts not checked).
    circleText: `Un cheval régulier en ligne droite peut boiter à la longe ou monté (Dyson et Greve, 2016). Sur le cercle, il penche vers l’intérieur${NB}; l’inclinaison mesurée sur des chevaux à la longe reste proche de ce calcul (Pfau et al., 2012). Les seuils de la ligne droite ne s’appliquent pas au cercle (Macaire et al., 2023). Ce calcul ne corrige aucune courbe.`,

    roadHead: 'Pour analyser un vrai cheval',
    // Status: experimental (the requirements of the audit's target design, 14 October 2026; not yet built or measured).
    road: [
      { title: 'Un modèle de vision pour le cheval', text: 'Un modèle qui repère la tête, le garrot, le bassin et les quatre sabots. L’appli n’en a pas encore.' },
      { title: 'Une vidéo bien filmée', text: 'Caméra fixe, trot en main en ligne droite, une dizaine de foulées, 60 images par seconde.' },
      { title: 'Une mesure vérifiée', text: 'Une étude qui compare ces mesures à une référence, capteurs ou capture du mouvement, avant d’afficher un seul millimètre.' },
    ],
  },
  en: {
    eyebrow: 'EquiVision',
    title: 'The trot, stride by stride',
    sub: 'What a gait assessment looks at, shown on a simulated horse. The app does not analyse videos of your horse yet.',

    videoHead: 'A horse video',
    demoName: 'Ridden horse in an arena',
    demoNote: 'Demonstration clip: the app analyses nothing on this video, no marker, no number.',
    viewLabel: 'Video display',
    viewPreview: 'Preview',
    viewRaw: 'Video only',
    previewNote: 'Preview of where we are going: the markers and figures on this video show what the app will measure. They are not measured yet.',
    open: 'Open a video of your horse',
    stays: 'It stays on your phone: nothing is sent.',
    ownHead: 'No measurement on your video',
    ownText: 'Analysing a horse’s gait from a video is not possible yet: the app has no model that finds a horse’s head, withers, pelvis or hooves. Your video plays as it is, with no number, no curve and no opinion.',
    close: 'Close the video',

    simHead: 'A simulated horse',
    simIntro: 'This horse does not exist: its movements are written in the code. It shows what a gait assessment looks at in the trot. The head and the pelvis drop twice per stride, once for each diagonal stance.',
    scenarios: { sound: 'Even trot', fore: 'Lame in a front leg', hind: 'Lame in a hind leg' },
    scenariosGroup: 'Simulations',
    scenarioText: {
      sound: 'Both dips of each stride are equally deep, for the head and for the pelvis.',
      fore: 'The head drops less while the lame front leg bears weight: every other dip is shallower. In this simulation only the head changes.',
      hind: 'The pelvis drops less while the lame hind leg bears weight: every other dip is shallower. In this simulation only the pelvis changes.',
    },
    rateHead: 'Frames per second of the simulation',
    rate: r => `${r} fps`,
    chartHead: 'Simulated curve',
    chartLabel: 'Rise and fall of the simulated horse’s head and pelvis, with the dips of each stride',
    head: 'Head',
    pelvis: 'Pelvis',
    dipA: 'Dip A',
    dipB: 'Dip B',
    figuresHead: 'What the app finds on the curve',
    stride: 'Stride duration',
    strideSub: hz => `That is ${hz} Hz`,
    headDiff: 'Dip difference, head',
    pelvisDiff: 'Dip difference, pelvis',
    programmed: v => `Programmed in the simulation: ${v}`,
    noNumber: 'No number',
    refused: 'No number: the curve shows no regular strides.',
    rateNote: 'Change the number of frames per second: the fewer there are, the more the app underestimates the programmed difference.',
    noLimb: 'When the two dips differ, the app sees it, but not which leg bears the weight: without finding the hooves, it names no limb. Dip A is only the first one it finds on the curve.',
    thresholds: 'For comparison: studies often use 6 mm for the head and 3 mm for the pelvis. Of 222 horses judged sound by their owners, 72.5% exceed at least one of these thresholds (Rhodin et al., 2017): a difference is not a diagnosis.',

    circleHead: 'On the circle',
    calcTag: 'Calculation',
    lean: 'Theoretical lean',
    leanSub: 'θ = arctan(v² / gR), from the radius and speed chosen',
    radius: 'Circle radius',
    speed: 'Trot speed',
    circleText: 'A horse that moves evenly in a straight line can be lame on the lunge or ridden (Dyson and Greve, 2016). On the circle it leans inward; the lean measured on lunging horses stays close to this calculation (Pfau et al., 2012). Straight-line thresholds do not apply on the circle (Macaire et al., 2023). This calculation corrects no curve.',

    roadHead: 'To analyse a real horse',
    road: [
      { title: 'A vision model for the horse', text: 'A model that finds the head, withers, pelvis and four hooves. The app does not have one yet.' },
      { title: 'A well-filmed video', text: 'Fixed camera, trotted in hand in a straight line, about ten strides, 60 frames per second.' },
      { title: 'A checked measurement', text: 'A study comparing these measurements with a reference, sensors or motion capture, before a single millimetre is shown.' },
    ],
  },
};

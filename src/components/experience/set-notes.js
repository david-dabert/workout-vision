// Step 3, "En savoir plus" / "Learn more": the notes David approved on 29 September
// (test/real-phone/growth-step3/texts.md). Each line carries its source number in that file and its
// status (CLAUDE.md R9): app measure, convention, or literature. Source 4 is no longer used.
export const NOTES = {
  fr: [
    { title: 'Le tempo', lines: [
      'Chaque répétition a deux phases : vous soulevez la charge, c’est la phase concentrique ; vous la retenez en la ramenant, c’est la phase excentrique.', // convention
      'Le tempo indique leur durée : 2-0-1-0, c’est deux secondes pour retenir la charge, une pour la soulever, sans pause.', // convention
      'Lent ou rapide, le muscle progresse autant : des répétitions de 0,5 à 8 secondes donnent les mêmes résultats.', // sources 1, 2, literature
      'Ralentir la phase excentrique n’apporte pas plus de muscle.', // source 3, literature
      'L’essentiel : garder le contrôle de la charge, sans la laisser tomber.', // convention
      'Quand votre vitesse baisse nettement au fil de la série, vous approchez de votre limite.', // source 5, literature
      'L’app analyse 15 images par seconde : elle ne mesure rien plus finement qu’un quinzième de seconde.', // app measure
    ] },
    { title: 'L’amplitude', lines: [
      'L’amplitude est l’angle que parcourt votre articulation à chaque répétition ; l’app la mesure en degrés.', // app measure
      'Aller au bout du mouvement fait gagner plus de force, et plus de muscle aux jambes.', // source 6, literature
      'Des répétitions partielles restent utiles, surtout quand le muscle est étiré.', // source 7, literature
      'Une répétition marquée ▾ fait moins de 85 % de l’amplitude habituelle de votre série.', // app measure; 85 % threshold, experimental
    ] },
    { title: 'Le nombre de répétitions', lines: [
      'Lourd ou léger, le muscle grandit autant si la série va près de votre limite.', // source 8, literature
      'Les charges lourdes font gagner plus de force.', // source 8, literature
      'Au-delà d’une douzaine de répétitions, il devient plus difficile de sentir combien il vous en reste.', // source 9, literature
    ] },
    { title: 'Conseils généraux', lead: 'L’app ne mesure pas ce qui suit.', lines: [
      'Reposez-vous plus d’une minute entre deux séries, c’est un peu mieux pour le muscle ; au-delà d’une minute et demie, l’écart ne se voit plus.', // source 10, literature
      'Reposez-vous davantage si la série suivante doit rester de qualité.', // convention
      'Il n’y a pas un seul bon chemin : lent ou rapide, lourd ou léger, plusieurs méthodes font progresser.', // sources 1, 8, literature
      'Ce qui fait la différence, c’est de tenir dans la durée.', // convention
      'Visez au moins deux séances de renforcement par semaine, qui sollicitent tous les grands groupes musculaires.', // source 14, literature
      'Dormez au moins sept heures par nuit, de façon régulière : c’est la recommandation pour les adultes.', // source 15, literature
      'Le muscle se reconstruit au repos, et le sommeil en fait partie.', // convention
      'Environ 1,6 g de protéines par kilo de poids de corps et par jour suffit à la plupart des gens ; au-delà, le gain de muscle ne progresse plus.', // source 11, literature
      'Pour prendre du muscle, inutile de trop manger : un léger excédent de calories suffit et limite la prise de gras.', // source 12, literature; convention
      'Les courbatures ne disent pas si la séance a fait grandir le muscle.', // source 13, literature
    ] },
  ],
  en: [
    { title: 'Tempo', lines: [
      'Every rep has two phases: you lift the load, the concentric phase; you hold it back as it returns, the eccentric phase.', // convention
      'The tempo gives their lengths: 2-0-1-0 means two seconds to hold the load back, one to lift it, no pause.', // convention
      'Slow or fast, muscle grows the same: reps of 0.5 to 8 seconds give the same results.', // sources 1, 2, literature
      'Slowing the eccentric phase does not build more muscle.', // source 3, literature
      'What matters: keep the load under control, never let it drop.', // convention
      'When your speed drops clearly through a set, you are nearing your limit.', // source 5, literature
      'The app analyses 15 frames per second: it measures nothing finer than a fifteenth of a second.', // app measure
    ] },
    { title: 'Range of motion', lines: [
      'Range of motion is the angle your joint travels in each rep; the app measures it in degrees.', // app measure
      'Going the full length of the movement builds more strength, and more leg muscle.', // source 6, literature
      'Partial reps remain useful, especially with the muscle stretched.', // source 7, literature
      'A rep marked ▾ covers less than 85% of your set’s usual range.', // app measure; 85 % threshold, experimental
    ] },
    { title: 'Rep ranges', lines: [
      'Heavy or light, muscle grows as much when the set goes close to your limit.', // source 8, literature
      'Heavy loads build more strength.', // source 8, literature
      'Beyond about a dozen reps, it gets harder to feel how many you have left.', // source 9, literature
    ] },
    { title: 'General advice', lead: 'The app does not measure what follows.', lines: [
      'Rest more than a minute between sets, it is slightly better for muscle; beyond a minute and a half, the difference no longer shows.', // source 10, literature
      'Rest longer if the next set needs to stay good.', // convention
      'There is no single right road: slow or fast, heavy or light, several methods work.', // sources 1, 8, literature
      'What makes the difference is keeping at it.', // convention
      'Aim for at least two strength sessions a week that work all the major muscle groups.', // source 14, literature
      'Sleep at least seven hours a night, regularly: that is the recommendation for adults.', // source 15, literature
      'Muscle rebuilds at rest, and sleep is part of it.', // convention
      'About 1.6 g of protein per kilo of body weight per day is enough for most people; beyond it, muscle gain no longer rises.', // source 11, literature
      'To build muscle, there is no need to overeat: a slight calorie surplus is enough and limits fat gain.', // source 12, literature; convention
      'Soreness does not tell you whether a session built muscle.', // source 13, literature
    ] },
  ],
};

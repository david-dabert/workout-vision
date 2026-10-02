# Step 3: the analysis texts, as David approved them on 29 September (CLAUDE.md R9 and R10)

This version, sent by David on 29 September, replaces the draft of the same day.
It adds an account of the set, one tip for the next session, a word of encouragement, regularity and sleep.
No label judges the set: the result states the measured slowdown, and the tempo note explains what it means.
On the screen, the account of the set, the tip and the encouragement are always shown, without repeating a value the result already shows; the notes open on a tap.
Built in src/components/experience/set-account.js (A, B, C) and set-notes.js (D).

FRANÇAIS

A. Votre série [mesure de l'app]
« {n} répétitions de {exercice}, en {durée} s. »
« Tempo moyen : {excentrique}-{pause}-{concentrique}-{pause}. »
Si des répétitions sont marquées ▾ : « La répétition {k} a été plus courte que les autres. » / « Les répétitions {k}, {k} et {k} ont été plus courtes que les autres. » [seuil de 85 %, expérimental]
À partir de quatre répétitions : « Vos deux dernières répétitions ont été {p} % plus lentes que les deux premières. » / « {p} % plus rapides » / « aussi rapides »
S'il existe une série précédente du même exercice : « {d} répétitions de plus que votre dernière série. » / « de moins » / « Autant que votre dernière série. »

B. Pour la prochaine fois, un seul conseil [convention]
Si une répétition est marquée ▾ : « La prochaine fois, visez la même amplitude sur toutes les répétitions. »
Sinon : « Quand toutes vos répétitions restent amples et contrôlées, ajoutez une répétition ou un peu de charge. »

C. Encouragement [convention]
« {n}e série de {exercice} dans votre historique. La régularité fera le reste. » (1re pour la première)

D. En savoir plus, ouvert d'un geste
Le tempo
« Chaque répétition a deux phases : vous soulevez la charge, c'est la phase concentrique ; vous la retenez en la ramenant, c'est la phase excentrique. » [convention]
« Le tempo indique leur durée : 2-0-1-0, c'est deux secondes pour retenir la charge, une pour la soulever, sans pause. » [convention]
« Lent ou rapide, le muscle progresse autant : des répétitions de 0,5 à 8 secondes donnent les mêmes résultats. » [1, 2, littérature]
« Ralentir la phase excentrique n'apporte pas plus de muscle. » [3, littérature]
« L'essentiel : garder le contrôle de la charge, sans la laisser tomber. » [convention]
« Quand votre vitesse baisse nettement au fil de la série, vous approchez de votre limite. » [5, littérature]
« L'app analyse 15 images par seconde : elle ne mesure rien plus finement qu'un quinzième de seconde. » [mesure de l'app]
L'amplitude
« L'amplitude est l'angle que parcourt votre articulation à chaque répétition ; l'app la mesure en degrés. » [mesure de l'app]
« Aller au bout du mouvement fait gagner plus de force, et plus de muscle aux jambes. » [6, littérature]
« Des répétitions partielles restent utiles, surtout quand le muscle est étiré. » [7, littérature]
« Une répétition marquée ▾ fait moins de 85 % de l'amplitude habituelle de votre série. » [mesure de l'app ; seuil de 85 %, expérimental]
Le nombre de répétitions
« Lourd ou léger, le muscle grandit autant si la série va près de votre limite. » [8, littérature]
« Les charges lourdes font gagner plus de force. » [8, littérature]
« Au-delà d'une douzaine de répétitions, il devient plus difficile de sentir combien il vous en reste. » [9, littérature]
Conseils généraux : l'app ne mesure pas ce qui suit.
« Reposez-vous plus d'une minute entre deux séries, c'est un peu mieux pour le muscle ; au-delà d'une minute et demie, l'écart ne se voit plus. » [10, littérature]
« Reposez-vous davantage si la série suivante doit rester de qualité. » [convention]
« Il n'y a pas un seul bon chemin : lent ou rapide, lourd ou léger, plusieurs méthodes font progresser. » [1, 8, littérature]
« Ce qui fait la différence, c'est de tenir dans la durée. » [convention]
« Visez au moins deux séances de renforcement par semaine, qui sollicitent tous les grands groupes musculaires. » [14, littérature]
« Dormez au moins sept heures par nuit, de façon régulière : c'est la recommandation pour les adultes. » [15, littérature]
« Le muscle se reconstruit au repos, et le sommeil en fait partie. » [convention]
« Environ 1,6 g de protéines par kilo de poids de corps et par jour suffit à la plupart des gens ; au-delà, le gain de muscle ne progresse plus. » [11, littérature]
« Pour prendre du muscle, inutile de trop manger : un léger excédent de calories suffit et limite la prise de gras. » [12, littérature ; convention]
« Les courbatures ne disent pas si la séance a fait grandir le muscle. » [13, littérature]

ENGLISH

A. Your set [app measure]
"{n} reps of {exercise}, in {duration} s."
"Average tempo: {eccentric}-{pause}-{concentric}-{pause}."
If reps are marked ▾: "Rep {k} was shorter than the others." / "Reps {k}, {k} and {k} were shorter than the others." [85% threshold, experimental]
From four reps: "Your last two reps were {p}% slower than your first two." / "{p}% faster" / "as fast"
If a previous set of the same exercise exists: "{d} more reps than your last set." / "fewer" / "As many as your last set."

B. Next time, one tip only [convention]
If a rep is marked ▾: "Next time, aim for the same range on every rep."
Otherwise: "When all your reps stay full and controlled, add a rep or a little weight."

C. Encouragement [convention]
"Your {n}th set of {exercise} in your history. Consistency will do the rest."

D. Learn more, opened on a tap
Tempo
"Every rep has two phases: you lift the load, the concentric phase; you hold it back as it returns, the eccentric phase." [convention]
"The tempo gives their lengths: 2-0-1-0 means two seconds to hold the load back, one to lift it, no pause." [convention]
"Slow or fast, muscle grows the same: reps of 0.5 to 8 seconds give the same results." [1, 2, literature]
"Slowing the eccentric phase does not build more muscle." [3, literature]
"What matters: keep the load under control, never let it drop." [convention]
"When your speed drops clearly through a set, you are nearing your limit." [5, literature]
"The app analyses 15 frames per second: it measures nothing finer than a fifteenth of a second." [app measure]
Range of motion
"Range of motion is the angle your joint travels in each rep; the app measures it in degrees." [app measure]
"Going the full length of the movement builds more strength, and more leg muscle." [6, literature]
"Partial reps remain useful, especially with the muscle stretched." [7, literature]
"A rep marked ▾ covers less than 85% of your set's usual range." [app measure; 85% threshold, experimental]
Rep ranges
"Heavy or light, muscle grows as much when the set goes close to your limit." [8, literature]
"Heavy loads build more strength." [8, literature]
"Beyond about a dozen reps, it gets harder to feel how many you have left." [9, literature]
General advice: the app does not measure what follows.
"Rest more than a minute between sets, it is slightly better for muscle; beyond a minute and a half, the difference no longer shows." [10, literature]
"Rest longer if the next set needs to stay good." [convention]
"There is no single right road: slow or fast, heavy or light, several methods work." [1, 8, literature]
"What makes the difference is keeping at it." [convention]
"Aim for at least two strength sessions a week that work all the major muscle groups." [14, literature]
"Sleep at least seven hours a night, regularly: that is the recommendation for adults." [15, literature]
"Muscle rebuilds at rest, and sleep is part of it." [convention]
"About 1.6 g of protein per kilo of body weight per day is enough for most people; beyond it, muscle gain no longer rises." [11, literature]
"To build muscle, there is no need to overeat: a slight calorie surplus is enough and limits fat gain." [12, literature; convention]
"Soreness does not tell you whether a session built muscle." [13, literature]

## How the screen applies it

- A's first line ({n} reps of {exercise}, in {duration} s) is not shown: the result already shows the count, the name and the duration.
- The average tempo is in whole seconds, as tempo is written; a phase that took place reads at least 1. The pause between reps sits after the eccentric phase for a lift that starts with the concentric one (a curl), after the concentric one for a lift that starts with the eccentric one (a squat); the pause at the turn is what a rep lasts beyond its two phases.
- The ▾ mark: a whole rep under 85 % of the set's median range. The slowdown compares the concentric phase of the last two whole reps with the first two.
- The comparison with the last set uses the reps kept on the last saved set of the same exercise.
- The encouragement appears once the set is saved, since only then is it in the history. Inside the sentence the exercise's name starts in lower case.

## Sources

Sources were verified from each paper's published abstract or bibliographic record, found by web search; this session's network cannot open the full texts.

1. Schoenfeld BJ, Ogborn DI, Krieger JW. Effect of repetition duration during resistance training on muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2015;45(4):577-585. doi:10.1007/s40279-015-0304-0
2. Enes A, Piñero A, Hermann T, et al., Schoenfeld BJ. How slow should you go? A systematic review with meta-analysis of the effect of resistance training repetition tempo on muscle hypertrophy. J Strength Cond Res. 2025. doi:10.1519/JSC.0000000000005302
3. Amdi C, King (first name not confirmed). The effect of eccentric phase duration on maximal strength, muscle hypertrophy and countermovement jump height: a systematic review and meta-analysis. J Sports Sci. 2025. doi:10.1080/02640414.2025.2535198
4. No longer used (David, 29 September). Was: Schoenfeld BJ, Ogborn DI, Vigotsky AD, Franchi MV, Krieger JW. Hypertrophic effects of concentric vs. eccentric muscle actions: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(9):2599-2608.
5. Sánchez-Medina L, González-Badillo JJ. Velocity loss as an indicator of neuromuscular fatigue during resistance training. Med Sci Sports Exerc. 2011;43(9):1725-1734. Already cited in the app's report (report-sheet.js).
6. Pallarés JG, et al. Effects of range of motion on resistance training adaptations: a systematic review and meta-analysis. Scand J Med Sci Sports. 2021. doi:10.1111/sms.14006 (full ROM greater for strength, ES 0.56, and lower-limb hypertrophy, ES 0.88)
7. Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J. Partial vs full range of motion resistance training: a systematic review and meta-analysis. Int J Strength Cond. 2023. (full ROM generally favoured, differences often minimal; partials at long muscle lengths viable)
8. Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(12):3508-3523. (low loads, ≤60% 1RM, to failure: similar hypertrophy; heavy loads: more strength)
9. Halperin I, et al. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. Sports Med. 2022. doi:10.1007/s40279-021-01559-x (accuracy falls when sets exceed about 12 reps)
10. Singer A, Wolf M, Generoso L, et al., Schoenfeld BJ. Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Front Sports Act Living. 2024. doi:10.3389/fspor.2024.1429789 (small benefit beyond 60 s; no appreciable difference beyond 90 s)
11. Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384. (gains plateau near 1.62 g/kg/day)
12. Slater GJ, Dieter BP, et al. Is an energy surplus required to maximize skeletal muscle hypertrophy associated with resistance training? Front Nutr. 2019;6:131. doi:10.3389/fnut.2019.00131 (the "sweet spot" surplus has never been validated in a resistance training population)
13. Schoenfeld BJ, Contreras B. Is postexercise muscle soreness a valid indicator of muscular adaptations? Strength Cond J. 2013;35(5):16-21. (answer: no)
14. World Health Organization. WHO guidelines on physical activity and sedentary behaviour. Geneva: WHO; 2020. (adults and older adults: muscle-strengthening activity involving all major muscle groups on two or more days a week)
    Verified 29 September from the record (PubMed 33239350; NCBI Bookshelf NBK566048): adults "should also do muscle-strengthening activities at moderate or greater intensity that involve all major muscle groups on 2 or more days a week".
15. Watson NF, Badr MS, Belenky G, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. Sleep. 2015;38(6):843-844. (adults: seven hours or more per night, on a regular basis)
    Verified 29 September from the record (PubMed 26039963; AASM consensus PDF): "Adults should sleep 7 or more hours per night on a regular basis to promote optimal health."

## Amended 2 October 2026, for David's approval (R10)

Line 3 of "Le tempo" / "Tempo" overstated source 3: the review finds g = 0.05 for hypertrophy (90 % CI -0.22 to 0.33) at very low to low certainty (GRADE), which shows no difference, not that there is none (Astra's audit). Now:

« Ralentir la phase excentrique n'a pas montré plus de gain musculaire. Les études restent peu nombreuses. » [3, littérature]

"Slowing the eccentric phase has not been shown to build more muscle. The studies are still few." [3, literature]

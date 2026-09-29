# Step 3: the analysis texts, for one approval by David (CLAUDE.md R9 and R10)

Shown with each set's analysis. Register: vous. No em dash.
Each statement carries its source and status in brackets; the brackets are for David and are not shown in the app.
Status: littérature / literature (published, not measured by us), convention (accepted coaching practice), mesure de l'app / app measure (what the code computes).
Sources were verified from each paper's published abstract or bibliographic record, found by web search; this session's network cannot open the full texts.

Order, as David set it: tempo, then range of motion and rep ranges (the app measures both), then rest between sets, food and soreness (general advice).

---

## 1. Le tempo / Tempo

**FR**

Chaque répétition a deux phases.
La phase concentrique : le muscle se raccourcit en travaillant, vous soulevez la charge.
La phase excentrique : le muscle s'allonge en freinant, vous la retenez. [convention]
Le tempo donne leur durée dans l'ordre : phase excentrique, pause, phase concentrique, pause.
2-0-1-0 veut dire deux secondes pour freiner la charge, une pour la soulever, sans pause. [convention]

La vitesse compte peu pour la prise de muscle.
Des répétitions de 0,5 à 8 secondes font gagner autant de muscle. [1, littérature]
Quatorze études comparant des répétitions d'environ 3,5 secondes et d'environ 1 seconde trouvent un effet minime du tempo. [2, littérature]
Freiner plus lentement n'apporte pas plus de muscle ; une phase excentrique plus courte fait progresser davantage au saut. [3, littérature]
Le travail excentrique seul fait gagner un peu plus que le concentrique seul, 10,0 % contre 6,8 % en moyenne, mais l'écart n'est pas significatif. [4, littérature]
Ce qui compte : garder le contrôle de la charge, sans la laisser tomber. [convention]
Un tempo lent reste un choix, pas une règle. [2, 3, littérature]

Ce que l'app mesure : à chaque répétition, la phase excentrique, la phase concentrique et les pauses.
Sur la série : la vitesse à laquelle vous soulevez la charge, du début à la fin ; quand elle baisse nettement, vous approchez de votre limite. [5, littérature]
L'app lit 15 images par seconde : elle mesure chaque durée au quinzième de seconde, pas plus finement. [mesure de l'app : extractionConfig.js, TARGET_FPS]
Libellé sur le résultat : « proche de votre limite ». [5, littérature ; seuil à fixer avant tout code, expérimental]

**EN**

Every rep has two phases.
The concentric phase: the muscle shortens as it works, and you lift the load.
The eccentric phase: the muscle lengthens as it brakes, and you hold the load back. [convention]
The tempo gives their lengths in order: eccentric phase, pause, concentric phase, pause.
2-0-1-0 means two seconds to brake the load, one to lift it, no pause. [convention]

Speed matters little for muscle growth.
Reps lasting 0.5 to 8 seconds build the same muscle. [1, literature]
Fourteen studies comparing reps of about 3.5 seconds with reps of about 1 second find a minimal effect of tempo. [2, literature]
Braking more slowly does not build more muscle; a shorter eccentric phase improves the jump more. [3, literature]
Eccentric-only training builds slightly more than concentric-only, 10.0% against 6.8% on average, but the difference is not significant. [4, literature]
What matters: keep the load under control, never let it drop. [convention]
A slow tempo is a choice, not a rule. [2, 3, literature]

What the app measures: for each rep, the eccentric phase, the concentric phase and the pauses.
Across the set: the speed at which you lift the load, from start to end; when it drops clearly, you are nearing your limit. [5, literature]
The app reads 15 frames per second: it measures each length to a fifteenth of a second, no finer. [app measure: extractionConfig.js, TARGET_FPS]
Label on the result: "close to your limit". [5, literature; threshold to be set before any code, experimental]

---

## 2. L'amplitude / Range of motion

**FR**

L'amplitude est l'angle que parcourt l'articulation à chaque répétition.
L'amplitude complète fait gagner plus de force, et plus de muscle aux jambes, que l'amplitude partielle. [6, littérature]
L'écart est souvent faible, et des répétitions partielles faites muscle étiré restent une option valable. [7, littérature]
Ce que l'app mesure : l'amplitude de chaque répétition, en degrés, sur l'articulation qui compte l'exercice. [mesure de l'app : core.ts]
Une répétition marquée ▾ fait moins de 85 % de l'amplitude habituelle de votre série. [mesure de l'app : report-sheet.js ; seuil de 85 %, expérimental]

**EN**

Range of motion is the angle the joint travels in each rep.
A full range builds more strength, and more leg muscle, than a partial range. [6, literature]
The difference is often small, and partial reps done with the muscle stretched remain a sound option. [7, literature]
What the app measures: each rep's range, in degrees, at the joint that counts the exercise. [app measure: core.ts]
A rep marked ▾ covers less than 85% of your set's usual range. [app measure: report-sheet.js; 85% threshold, experimental]

---

## 3. Le nombre de répétitions / Rep ranges

**FR**

Lourd ou léger, le muscle grandit autant si la série va près de votre limite. [8, littérature]
Les charges lourdes font gagner plus de force. [8, littérature]
Au-delà de douze répétitions environ, il devient plus difficile d'estimer combien il vous en reste. [9, littérature]
Ce que l'app mesure : le nombre de répétitions, que vous confirmez ou corrigez. [mesure de l'app]

**EN**

Heavy or light, muscle grows as much when the set goes close to your limit. [8, literature]
Heavy loads build more strength. [8, literature]
Beyond about twelve reps, it becomes harder to judge how many you have left. [9, literature]
What the app measures: the number of reps, which you confirm or correct. [app measure]

---

## 4. Le repos entre les séries / Rest between sets (conseil général / general advice)

**FR**

Plus d'une minute de repos apporte un petit gain de muscle. [10, littérature]
Au-delà d'une minute et demie, l'écart n'est plus visible. [10, littérature]
Reposez-vous davantage si la série suivante doit rester de qualité. [convention]
L'app ne mesure pas le repos entre les séries.

**EN**

Resting more than a minute brings a small gain in muscle. [10, literature]
Beyond a minute and a half, the difference no longer shows. [10, literature]
Rest longer if the next set needs to stay good. [convention]
The app does not measure rest between sets.

---

## 5. L'alimentation / Food (conseil général / general advice)

**FR**

Environ 1,6 g de protéines par kilo de poids de corps et par jour suffit ; au-delà, le gain de muscle ne progresse plus. [11, littérature]
Aucun excédent de calories n'a été validé comme idéal pour prendre du muscle. [12, littérature]
Un léger excédent limite la prise de gras. [convention]
L'app ne mesure pas l'alimentation.

**EN**

About 1.6 g of protein per kilo of body weight per day is enough; beyond it, muscle gain no longer rises. [11, literature]
No calorie surplus has been validated as ideal for building muscle. [12, literature]
A slight surplus limits fat gain. [convention]
The app does not measure food.

---

## 6. Les courbatures / Soreness (conseil général / general advice)

**FR**

Les courbatures ne disent pas si la séance a fait grandir le muscle. [13, littérature]
L'app ne mesure pas les courbatures.

**EN**

Soreness does not tell you whether a session built muscle. [13, literature]
The app does not measure soreness.

---

## Sources

1. Schoenfeld BJ, Ogborn DI, Krieger JW. Effect of repetition duration during resistance training on muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2015;45(4):577-585. doi:10.1007/s40279-015-0304-0
2. Enes A, Piñero A, Hermann T, et al., Schoenfeld BJ. How slow should you go? A systematic review with meta-analysis of the effect of resistance training repetition tempo on muscle hypertrophy. J Strength Cond Res. 2025. doi:10.1519/JSC.0000000000005302
3. Amdi C, King (first name not confirmed). The effect of eccentric phase duration on maximal strength, muscle hypertrophy and countermovement jump height: a systematic review and meta-analysis. J Sports Sci. 2025. doi:10.1080/02640414.2025.2535198
4. Schoenfeld BJ, Ogborn DI, Vigotsky AD, Franchi MV, Krieger JW. Hypertrophic effects of concentric vs. eccentric muscle actions: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(9):2599-2608.
5. Sánchez-Medina L, González-Badillo JJ. Velocity loss as an indicator of neuromuscular fatigue during resistance training. Med Sci Sports Exerc. 2011;43(9):1725-1734. Already cited in the app's report (report-sheet.js).
6. Pallarés JG, et al. Effects of range of motion on resistance training adaptations: a systematic review and meta-analysis. Scand J Med Sci Sports. 2021. doi:10.1111/sms.14006 (full ROM greater for strength, ES 0.56, and lower-limb hypertrophy, ES 0.88)
7. Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J. Partial vs full range of motion resistance training: a systematic review and meta-analysis. Int J Strength Cond. 2023. (full ROM generally favoured, differences often minimal; partials at long muscle lengths viable)
8. Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(12):3508-3523. (low loads, ≤60% 1RM, to failure: similar hypertrophy; heavy loads: more strength)
9. Halperin I, et al. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. Sports Med. 2022. doi:10.1007/s40279-021-01559-x (accuracy falls when sets exceed about 12 reps)
10. Singer A, Wolf M, Generoso L, et al., Schoenfeld BJ. Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Front Sports Act Living. 2024. doi:10.3389/fspor.2024.1429789 (small benefit beyond 60 s; no appreciable difference beyond 90 s)
11. Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384. (gains plateau near 1.62 g/kg/day)
12. Slater GJ, Dieter BP, et al. Is an energy surplus required to maximize skeletal muscle hypertrophy associated with resistance training? Front Nutr. 2019;6:131. doi:10.3389/fnut.2019.00131 (the "sweet spot" surplus has never been validated in a resistance training population)
13. Schoenfeld BJ, Contreras B. Is postexercise muscle soreness a valid indicator of muscular adaptations? Strength Cond J. 2013;35(5):16-21. (answer: no)

Not confirmed, so not relied on: the result of da Silva et al., J Strength Cond Res 2025;39(1):115-134 (eccentric vs concentric); the dose-response of Robinson, Pelland et al., Sports Med 2024 (proximity to failure); co-authors are given as far as the records showed them.

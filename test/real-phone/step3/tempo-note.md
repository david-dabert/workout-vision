# Tempo note, draft for David's approval (GROWTH step 3, CLAUDE.md R9 and R10)

Shown under the rep table of each analysis. Register: vous. No em dash.
Each statement carries its source and its status in brackets; the brackets are for David and are not shown in the app.

## Français

**Le tempo de votre série**

Chaque répétition a deux phases.
La phase concentrique : le muscle se raccourcit en travaillant, vous soulevez la charge.
La phase excentrique : le muscle s'allonge en freinant, vous la ramenez. [convention]
Le tempo donne leur durée dans l'ordre : descente, pause en bas, montée, pause en haut.
2-0-1-0 veut dire deux secondes pour descendre, une pour monter, sans pause. [convention]

**Ce que dit la recherche**

La vitesse compte peu pour la prise de muscle.
Des répétitions de 0,5 à 8 secondes font gagner autant de muscle. [1, littérature]
Quatorze études comparant des répétitions d'environ 3,5 secondes et d'environ 1 seconde trouvent un effet minime du tempo. [2, littérature]

Ralentir la descente n'apporte pas plus de muscle.
La durée de la phase excentrique ne change pas la prise de muscle ; une descente plus courte fait progresser davantage au saut. [3, littérature]
Le travail excentrique seul fait gagner un peu plus que le concentrique seul, 10,0 % contre 6,8 % en moyenne, mais l'écart n'est pas significatif. [4, littérature]

Ce qui compte : garder le contrôle de la charge, sans la laisser tomber. [convention]
Un tempo lent reste un choix, pas une règle. [2, 3, littérature]

**Ce que l'app mesure**

À chaque répétition : la descente, la montée et les pauses.
Sur la série : la vitesse de montée du début à la fin ; quand elle chute, vous approchez de l'échec. [5, littérature]
L'app lit 15 images par seconde : elle mesure chaque durée au quinzième de seconde, pas plus finement. [mesure de l'app : extractionConfig.js, TARGET_FPS]

## English

**The tempo of your set**

Every rep has two phases.
The concentric phase: the muscle shortens as it works, and you lift the load.
The eccentric phase: the muscle lengthens as it brakes, and you bring the load back. [convention]
The tempo gives their lengths in order: lowering, pause at the bottom, lifting, pause at the top.
2-0-1-0 means two seconds down, one up, no pause. [convention]

**What the research says**

Speed matters little for muscle growth.
Reps lasting 0.5 to 8 seconds build the same muscle. [1, literature]
Fourteen studies comparing reps of about 3.5 seconds with reps of about 1 second find a minimal effect of tempo. [2, literature]

A slower lowering does not build more muscle.
The length of the eccentric phase does not change muscle growth; a shorter lowering improves the jump more. [3, literature]
Eccentric-only training builds slightly more than concentric-only, 10.0% against 6.8% on average, but the difference is not significant. [4, literature]

What matters: keep the load under control, never let it drop. [convention]
A slow tempo is a choice, not a rule. [2, 3, literature]

**What the app measures**

For each rep: the lowering, the lifting and the pauses.
Across the set: the lifting speed from start to end; when it falls, you are nearing failure. [5, literature]
The app reads 15 frames per second: it measures each length to a fifteenth of a second, no finer. [app measure: extractionConfig.js, TARGET_FPS]

## Sources

1. Schoenfeld BJ, Ogborn DI, Krieger JW. Effect of repetition duration during resistance training on muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2015;45(4):577-585. doi:10.1007/s40279-015-0304-0
2. Enes A, Piñero A, Hermann T, et al., Schoenfeld BJ. How slow should you go? A systematic review with meta-analysis of the effect of resistance training repetition tempo on muscle hypertrophy. J Strength Cond Res. 2025. doi:10.1519/JSC.0000000000005302
3. Amdi C, King (first name not confirmed). The effect of eccentric phase duration on maximal strength, muscle hypertrophy and countermovement jump height: a systematic review and meta-analysis. J Sports Sci. 2025. doi:10.1080/02640414.2025.2535198
4. Schoenfeld BJ, Ogborn DI, Vigotsky AD, Franchi MV, Krieger JW. Hypertrophic effects of concentric vs. eccentric muscle actions: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(9):2599-2608.
5. Sánchez-Medina L, González-Badillo JJ. Velocity loss as an indicator of neuromuscular fatigue during resistance training. Med Sci Sports Exerc. 2011;43(9):1725-1734. Already cited in the app's report (report-sheet.js).

Verified from each paper's published abstract or bibliographic record, found by web search; the full texts could not be opened from this session. A 2025 review (da Silva et al., J Strength Cond Res 39(1):115-134) also compares eccentric and concentric actions; its result could not be read, so the note does not rely on it.

Left out: rest between sets, rep ranges, calorie surplus, soreness and range of motion. They appear in the podcast, but are not about tempo, and the app does not measure them.

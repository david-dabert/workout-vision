# The check page (check.html), the French words for David's approval (R10)

Written 4 October 2026 (WP0.2 of docs/SPEC-production.md), register "vous" as the rest of the page. Internal page,
not linked from the app; still not released as final copy until David approves it. Built in src/check-main.js and
src/lib/check.js (readLines). In French lines the space before ":" and "%" is a no-break space.

| Key | FR | EN | Where it appears |
|---|---|---|---|
| note.pick | Choisissez dans la photothèque chacune des 6 séries retenues pour le contrôle (les six du 29 septembre ; l’élévation latérale est aussi la vidéo de la démo du 3 octobre). Chacune est comptée par le code en ligne de l’app, sur ce téléphone, et comparée au compte que donnent ses repères enregistrés. La vidéo est reconnue par sa durée. Rien n’est envoyé. | Pick each of the 6 sets David chose for the check from the library (the six of 29 September; the lateral raise is also the video of the 3 October demo). … | First note (replaces the "cinq séries du 29 septembre" text) |
| note.gate | Aucune version qui touche à l’analyse ne sort si les 6 ne sont pas « comme avant » sur le chemin normal ; le correctif du décodeur demande aussi les 6 « comme avant » avec la lecture forcée. Gardez l’écran allumé pendant l’analyse. | No release that touches analysis goes out unless all 6 read "as before" … | Second note ("cinq" became the number of rows) |
| read.repeats | Répétitions : images N sur M (x %) · squelettes N sur M (x %) | Repeats: pictures N of M (x %) · skeletons N of M (x %) | Each row, after a run |
| read.unknown | inconnu | unknown | When a share did not come back |
| read.decoder | Décodeur : <méthode> · repli : <raison> | Decoder: <method> · fallback: <reason> | Each row, after a run |
| read.nofallback | aucun | none | When WebCodecs read the video |
| inject.title | Injection figée (test) | Frozen injection (test) | check.html?inject=frozen only |
| inject.want | N’importe quelle vidéo. La lecture est forcée et chaque échantillon après le premier le répète. Attendu : refusée comme lecture figée. | Any video. The playback path is forced and every sample after the first repeats it. Expected: refused as a frozen read. | Under the injection row's title |
| inject.ok | Refusée comme lecture figée (images), comme il faut. | Refused as a frozen read (pictures), as it must be. | Injection row, pass ("squelettes" when the skeletons refused it) |
| inject.bad | PAS refusée : … | NOT refused: … | Injection row, fail |
| inject.forced | lecture forcée | playback path forced | Fallback shown on the injection row |
| summary.inject.wait | Injection figée : pas encore lancée. | Frozen injection: not run yet. | Top summary, with the hook |
| summary.inject.ok | Injection figée : refusée, comme il faut. | Frozen injection: refused, as it must be. | Top summary |
| summary.inject.bad | Injection figée : PAS refusée. | Frozen injection: NOT refused. | Top summary |
| why.notfrozen | non refusée comme figée (…) | not refused as frozen (…) | Injection row, the reason it failed |
| why.counted | compté N, non refusée | counted N, not refused | Same |
| row.frozen | Pas comme avant : refusée comme lecture figée. | Not as before: refused as a frozen read. | A clip row whose read was refused as frozen, with its repeat share under it |
| why.otherrefusal | refusée, mais pas comme figée | refused, but not as frozen | Same |

The decoder's method and the fallback reason are shown as the extractor writes them, in English (technical strings).

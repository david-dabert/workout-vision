# Levels: new user-facing strings (30 September 2026)

"vous" register throughout. To approve by David before release (CLAUDE.md R10).
Level names reuse the report's existing words (Débutant / Intermédiaire / Confirmé; Beginner / Intermediate / Expert), not new copy.

| Where | FR | EN |
|---|---|---|
| History, above the level control (`History.jsx`, `LevelPick.jsx`) | Votre niveau | Your level |
| Result, after the save, the question (once, when no level is stored) (`Result.jsx`) | Pour adapter l’écran, quel est votre niveau ? | To fit the screen to you, what is your level? |
| Result, after answering it (`Result.jsx`) | C’est noté. L’écran s’adapte dès la prochaine série. Vous pouvez le changer dans l’historique. | Noted. The screen adapts from your next set. You can change it in your history. |
| Result, expert, under the per-rep table (`Result.jsx`) | Tempo : descente-pause-montée-pause, en secondes. Pic et Moy. : vitesse angulaire, en °/s. | Tempo: lowering-pause-lifting-pause, in seconds. Peak and Mean: angular speed, in °/s. |
| Guide, beginner before filming (until 3 saved sets), title (`Guide.jsx`) | Le geste, avant de filmer. | The movement, before you film. |
| Guide, beginner before filming, line under the title (`Guide.jsx`) | Regardez le mouvement, puis filmez votre série. Ce guide s’affiche avant vos trois premières séries. | Watch the movement, then film your set. This guide shows before your first three sets. |

Reused as they are, no new wording: the report's table columns and its concentric speed line
(`report-sheet.js`: "Vitesse concentrique : −20 % du début à la fin"), "Filmer cet exercice", "Tous les exercices",
the account lines, the tip and "En savoir plus" (`set-account.js`, `set-notes.js`).

Added 3 October 2026 (third audit C11), approved by David on 9 October 2026: after a correction, the expert's per-rep table
on the result screen heads its first column with the report's existing word for a detected mark, as the PDF already does.

| Where | FR | EN |
|---|---|---|
| Result, expert, first column of the per-rep table after a correction (`report-sheet.js` `repTable`, `Result.jsx`) | Repère | Mark |

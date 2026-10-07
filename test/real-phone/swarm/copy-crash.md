# The note after the app restarted: the words for David's approval (R10)

Written 7 October 2026, register "vous" (the note itself has no verb addressed to the person), glossary DIRECTIVES.md
Part 7. Status of every line: pending David's approval (7 October). Source: src/components/experience/crash-copy.js.
Shown on the choice of lift only after a session that did not end cleanly (src/lib/crashLog.js): the page was on screen
and never hidden nor left, and its last breadcrumb is less than 30 minutes old. Nothing is sent; the detail is copied
only by the person's tap. With no incident the choice is as before.

| FR | EN | Where | Status |
|---|---|---|---|
| L’appli a redémarré pendant ‹phase› (‹écran›). Le détail est gardé sur ce téléphone. | The app restarted during ‹phase› (‹screen›). The details are kept on this phone. | Choice of lift, under the top bar (Choice.jsx, CrashNote) | pending David's approval (7 October) |
| L’appli a redémarré (‹écran›). Le détail est gardé sur ce téléphone. | The app restarted (‹screen›). The details are kept on this phone. | Same line, when no analysis phase was under way | pending |
| Copier le détail | Copy the details | Same line, text key: copies the log as JSON | pending |
| Détail copié. | Details copied. | Appended to the line once copied | pending |
| La copie n’a pas marché. | Copying did not work. | Appended to the line when the clipboard refuses | pending |
| Masquer | Dismiss | Same line, text key (read aloud: "Masquer cette note" / "Dismiss this note"); the note is no longer kept | pending |

‹phase›, by the analysis phase in the log:

| Phase | FR | EN |
|---|---|---|
| waiting | l’ouverture de la vidéo | opening the video |
| model | le chargement du modèle | loading the model |
| extracting | la lecture de la vidéo | reading the video |
| result | l’affichage du résultat | the result |
| replay | le revisionnage de la série | the replay of the set |
| report | le rapport | the report |
| error | l’affichage d’une erreur | an error screen |

‹écran›, by the screen in the log:

| Screen | FR | EN |
|---|---|---|
| choice | choix de l’exercice | choice of exercise |
| film | écran Filmer | filming screen |
| analyze | analyse | analysis |
| live | en direct | live |
| guide | guide des exercices | exercise guide |
| history | vos séries | your sets |
| pro | espace pro | pro space |
| programme | programme | programme |
| about | à propos | about |

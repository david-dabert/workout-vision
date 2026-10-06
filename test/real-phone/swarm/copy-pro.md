# Espace pro and the client's programme: the words for David's approval (R10)

Written 6 October 2026, register "vous", glossary DIRECTIVES.md Part 7 (rest: récupération, "récup."). Status of every line:
pending David's approval (6 October). The strings live in `src/components/experience/pro-copy.js`; this table is generated
from it, with example values where a line takes a number or a name.

Wellness words only: coaches and physiotherapists are named as users ("coachs et kinésithérapeutes"), and no word of care
appears (patient, rééducation, traitement, diagnostic, thérapie, guérison and their English forms;
`src/components/experience/__tests__/programme.test.js` checks every string). The programme's numbers are the coach's;
the app prescribes nothing.

Choices for David:
- "Espace pro" / "Pro" for the entry, "Programmes" for the screen's title.
- "Récup." in the table and on the client's screen, as the glossary says, rather than "repos".
- "Prévu : 3 × 10" on the session report, under the exercise's name, beside the count.

| FR | EN | Where | Status |
|---|---|---|---|
| Espace pro | Pro | Choice of lift, row after "Vos séries" (Choice.jsx) | pending David's approval (6 October) |
| Pour les coachs et les kinésithérapeutes | For coaches and physiotherapists | Same row, caption | pending David's approval (6 October) |
| Votre programme | Your programme | Choice of lift, first row under the cards, once a programme is received; caption: the programme’s title | pending David's approval (6 October) |
| Espace pro | Pro | Espace pro, eyebrow over the title; pill on the builder and picker | pending David's approval (6 October) |
| Programmes | Programmes | Espace pro, title (Pro.jsx) | pending David's approval (6 October) |
| Composez une séance pour un client, puis envoyez-la en PDF ou en lien. Il l’ouvre dans l’app et filme chaque série : ses répétitions sont comptées sur son téléphone. | Build a session for a client, then send it as a PDF or a link. They open it in the app and film each set: their reps are counted on their phone. | Espace pro, under the title | pending David's approval (6 October) |
| Pour les coachs et les kinésithérapeutes. | For coaches and physiotherapists. | Espace pro, foot (first sentence) | pending David's approval (6 October) |
| Rien n’est envoyé : vos programmes restent sur ce téléphone jusqu’à ce que vous les partagiez. | Nothing is sent: your programmes stay on this phone until you share them. | Espace pro, foot (second sentence) | pending David's approval (6 October) |
| Ce téléphone ne garde pas les brouillons (navigation privée ?) : partagez le programme avant de quitter. | This phone does not keep drafts (private browsing?): share the programme before you leave. | Builder, when the phone refuses to keep the draft | pending David's approval (6 October) |
| Nouveau programme | New programme | Espace pro, primary button | pending David's approval (6 October) |
| Sur ce téléphone | On this phone | Espace pro, section head over the drafts | pending David's approval (6 October) |
| Sans titre | Untitled | Draft row with no title | pending David's approval (6 October) |
| 2 exercices · modifié le 6 oct. | 2 exercises · edited 6 Oct | Draft row caption (example: 2 exercises, 6 oct.) | pending David's approval (6 October) |
| Retour | Back | Back button (read aloud) | pending David's approval (6 October) |
| Programme | Programme | Builder title before a title is typed | pending David's approval (6 October) |
| Titre | Title | Builder field label | pending David's approval (6 October) |
| Haut du corps, semaine 1 | Upper body, week 1 | Builder field placeholder | pending David's approval (6 October) |
| Pour (facultatif) | For (optional) | Builder field label | pending David's approval (6 October) |
| Prénom du client | Client’s first name | Builder field placeholder | pending David's approval (6 October) |
| Note générale (facultatif) | General note (optional) | Builder field label | pending David's approval (6 October) |
| Échauffement, consignes, fréquence… | Warm-up, cues, how often… | Builder field placeholder | pending David's approval (6 October) |
| Exercices | Exercises | Builder section head | pending David's approval (6 October) |
| Aucun exercice pour l’instant. | No exercises yet. | Builder, no exercise yet | pending David's approval (6 October) |
| Ajouter un exercice | Add an exercise | Builder, button that opens the list of exercises | pending David's approval (6 October) |
| Séries | Sets | Exercise card, field label | pending David's approval (6 October) |
| Rép. | Reps | Exercise card, field label | pending David's approval (6 October) |
| Récup. (s) | Rest (s) | Exercise card, field label | pending David's approval (6 October) |
| Nombre de séries | Number of sets | Same field, read aloud | pending David's approval (6 October) |
| Répétitions par série | Reps per set | Same field, read aloud | pending David's approval (6 October) |
| Récupération en secondes | Rest in seconds | Same field, read aloud | pending David's approval (6 October) |
| Consigne (facultatif) | Cue (optional) | Exercise card, cue field placeholder | pending David's approval (6 October) |
| Monter Squat | Move Squat up | Exercise card, up arrow (read aloud) | pending David's approval (6 October) |
| Descendre Squat | Move Squat down | Exercise card, down arrow (read aloud) | pending David's approval (6 October) |
| Retirer | Remove | Exercise card, text button | pending David's approval (6 October) |
| Retirer Squat | Remove Squat | Same button, read aloud | pending David's approval (6 October) |
| Donnez un titre et ajoutez un exercice pour partager. | Give it a title and add an exercise to share it. | Builder, above the share buttons while the programme cannot be shared | pending David's approval (6 October) |
| Partager le PDF | Share the PDF | Builder, primary button | pending David's approval (6 October) |
| Préparation du PDF… | Preparing the PDF… | Same button while the PDF code loads | pending David's approval (6 October) |
| Partager le lien | Share the link | Builder, secondary button | pending David's approval (6 October) |
| Copier le lien | Copy the link | Builder, quiet button | pending David's approval (6 October) |
| Lien copié. | Link copied. | Status after a copy | pending David's approval (6 October) |
| PDF téléchargé. | PDF downloaded. | Status after the PDF downloads | pending David's approval (6 October) |
| Le PDF n’a pas pu être préparé. Réessayez. | The PDF could not be prepared. Try again. | Status when the PDF fails | pending David's approval (6 October) |
| Le lien n’a pas pu être préparé. Réessayez. | The link could not be prepared. Try again. | Status when the link fails | pending David's approval (6 October) |
| Copie impossible : sélectionnez le lien ci-dessous. | Could not copy: select the link below. | Status when the clipboard refuses; the link shows in a field | pending David's approval (6 October) |
| Lien du programme | Programme link | Label of that field | pending David's approval (6 October) |
| Programme trop long pour un lien : retirez un exercice ou raccourcissez les notes. | Too long for a link: remove an exercise or shorten the notes. | Status when the link would be too long | pending David's approval (6 October) |
| Votre programme : Bas du corps, semaine 1. Ouvrez ce lien sur votre téléphone, puis filmez chaque série. | Your programme: Bas du corps, semaine 1. Open this link on your phone, then film each set. | Text sent with the link in the share sheet (example title) | pending David's approval (6 October) |
| Supprimer ce programme | Delete this programme | Builder, text button at the foot | pending David's approval (6 October) |
| Supprimer ce programme de ce téléphone ? | Delete this programme from this phone? | Builder, confirmation | pending David's approval (6 October) |
| Supprimer | Delete | Confirmation button | pending David's approval (6 October) |
| Annuler | Cancel | Confirmation button | pending David's approval (6 October) |
| Retour au programme | Back to the programme | Exercise picker, Back (read aloud) | pending David's approval (6 October) |
| Programme | Programme | Programme PDF, header line, left | pending David's approval (6 October) |
| Pour | For | Programme PDF, label | pending David's approval (6 October) |
| Exercices | Exercises | Programme PDF, label | pending David's approval (6 October) |
| Exercice / Séries × rép. / Récup. | Exercise / Sets × reps / Rest | Programme PDF, table headings | pending David's approval (6 October) |
| Note | Note | Programme PDF, label of the general note | pending David's approval (6 October) |
| Filmez chaque série avec votre téléphone : les répétitions sont comptées, et le rapport de séance montre le prévu à côté du compté. | Film each set with your phone: the reps are counted, and the session report shows what was planned beside what was counted. | Programme PDF, foot | pending David's approval (6 October) |
| programme | programme | Programme PDF, start of the file name | pending David's approval (6 October) |
| Programme | Programme | Client’s programme screen, eyebrow (Programme.jsx) | pending David's approval (6 October) |
| Pour Camille | For Camille | Client’s programme, under the title (example name) | pending David's approval (6 October) |
| Aujourd’hui : 2 sur 6 exercices terminés | Today: 2 of 6 exercises done | Client’s programme, under the title (example 2 of 6) | pending David's approval (6 October) |
| 3 × 10 · récup. 1 min 30 | 3 × 10 · rest 1 min 30 s | Client’s programme, each exercise’s target (example 3 × 10, 90 s) | pending David's approval (6 October) |
| 1 min 30 | 1 min 30 s | Rest as written in the PDF and the target (example 90 s) | pending David's approval (6 October) |
| Série 1 : 8 répétitions comptées sur 10 prévues | Set 1: 8 reps counted of 10 planned | Client’s programme, a set cell done (read aloud; example) | pending David's approval (6 October) |
| Série 3 : à faire | Set 3: to do | Client’s programme, a set cell to do (read aloud) | pending David's approval (6 October) |
| Filmer Squat | Film Squat | Client’s programme, an exercise row (read aloud) | pending David's approval (6 October) |
| Touchez un exercice pour le filmer. Chaque série enregistrée s’affiche ici, comptée, à côté de l’objectif. | Tap an exercise to film it. Each set you save shows here, counted, beside the target. | Client’s programme, foot | pending David's approval (6 October) |
| Après une série, « Rapport de séance » prépare un PDF à envoyer à votre coach. | After a set, “Session report” prepares a PDF to send to your coach. | Client’s programme, foot | pending David's approval (6 October) |
| Le programme et vos séries restent sur ce téléphone. | The programme and your sets stay on this phone. | Client’s programme, foot | pending David's approval (6 October) |
| Autres programmes reçus | Other programmes received | Client’s programme, section head | pending David's approval (6 October) |
| Retirer ce programme | Remove this programme | Client’s programme, text button | pending David's approval (6 October) |
| Retirer ce programme de ce téléphone ? Vos séries restent dans Vos séries. | Remove this programme from this phone? Your sets stay in Your sets. | Client’s programme, confirmation | pending David's approval (6 October) |
| Retirer | Remove | Confirmation button | pending David's approval (6 October) |
| Ouverture du programme… | Opening the programme… | Client’s programme, while the link is read | pending David's approval (6 October) |
| Aucun programme sur ce téléphone. | No programme on this phone. | Client’s programme, nothing kept | pending David's approval (6 October) |
| Ouvrez le lien que votre coach vous a envoyé. | Open the link your coach sent you. | Same, under it | pending David's approval (6 October) |
| Ce lien ne s’ouvre pas | This link does not open | A link that cannot open, title | pending David's approval (6 October) |
| Le lien est incomplet ou abîmé. Demandez à votre coach de vous le renvoyer. | The link is incomplete or damaged. Ask your coach to send it again. | A link that cannot open (empty) | pending David's approval (6 October) |
| Le lien est incomplet ou abîmé. Demandez à votre coach de vous le renvoyer. | The link is incomplete or damaged. Ask your coach to send it again. | A link that cannot open (malformed) | pending David's approval (6 October) |
| Le lien est trop long pour être un programme de l’app. | The link is too long to be one of the app’s programmes. | A link that cannot open (too-long) | pending David's approval (6 October) |
| Ce navigateur ne sait pas lire ce lien. Mettez à jour votre téléphone ou votre navigateur, puis rouvrez-le. | This browser cannot read the link. Update your phone or browser, then open it again. | A link that cannot open (unsupported) | pending David's approval (6 October) |
| Ce programme contient un exercice que cette version de l’app ne connaît pas. Rechargez l’app, puis rouvrez le lien. | This programme holds an exercise this version of the app does not know. Reload the app, then open the link again. | A link that cannot open (unknown-exercise) | pending David's approval (6 October) |
| Une valeur du programme sort des limites de l’app. Demandez à votre coach de vous le renvoyer. | A value in the programme is outside the app’s limits. Ask your coach to send it again. | A link that cannot open (bad-value) | pending David's approval (6 October) |
| Retour aux exercices | Back to the exercises | Same screen, button | pending David's approval (6 October) |
| Prévu : 3 × 10 | Planned: 3 × 10 | Session report, sheet and PDF, under the exercise beside the count (example 3 × 10) | pending David's approval (6 October) |

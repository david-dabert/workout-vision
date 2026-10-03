# Live counting: the words for David's approval (R10)

Written 3 October 2026, register "vous", glossary DIRECTIVES.md Part 7 (série, répétition). Status of every line:
pending David's approval (3 October). Where a line repeats words David already approved on another screen, it says so.

## Film screen (src/components/experience/Film.jsx)

| FR | EN | Where | Status |
|---|---|---|---|
| Vidéo | Video | Mode switch, left half (the default) | pending David's approval (3 October) |
| En direct | Live | Mode switch, right half, with a red dot | pending David's approval (3 October) |
| Comment compter | How to count | Mode switch, read aloud only (group label) | pending David's approval (3 October) |
| Compter en direct | Count live | Primary button in live mode | pending David's approval (3 October) |
| L’image de la caméra reste sur votre téléphone : elle n’est ni enregistrée ni envoyée. | The camera’s picture stays on your phone: it is neither recorded nor sent. | Privacy line in live mode, and at the foot of the live screen. Replaces, 3 October, “L’image reste sur votre téléphone : rien n’est enregistré ni envoyé.” / “The picture stays on your phone: nothing is recorded or sent.”, untrue once a set is saved, shared or contributed, or the usage counts are on (review finding B1). The new line speaks only of the camera’s picture, so it holds in every case and does not depend on the usage counts | pending David's approval (3 October) |

## Live screen (src/components/experience/Live.jsx)

| FR | EN | Where | Status |
|---|---|---|---|
| En direct | Live | Top bar pill | pending David's approval (3 October) |
| Compter en direct · {exercice} | Count live · {exercise} | Screen name, read aloud only | pending David's approval (3 October) |
| Annoncer les répétitions à voix haute | Say each rep out loud | Voice toggle, read aloud only | pending David's approval (3 October) |
| Passer à la caméra avant / Passer à la caméra arrière | Switch to the front camera / Switch to the rear camera | Camera switch, read aloud only | pending David's approval (3 October) |
| Ouverture de la caméra… | Opening the camera… | Over the picture, while the camera opens | pending David's approval (3 October) |
| Préparation… | Getting ready… | Over the picture, while the pose model loads | pending David's approval (3 October) |
| On vous voit. Touchez Démarrer, puis mettez-vous en place. | You are in view. Tap Start, then get into position. | Over the picture, before the set, a body seen | pending David's approval (3 October) |
| Au moins de la tête aux hanches dans le cadre, mains comprises. / Le corps entier dans le cadre, pieds compris. | At least head to hips in the frame, hands included. / Your whole body in the frame, feet included. | Over the picture when nobody is seen: the Film screen's step 2, word for word | already on the Film screen |
| Démarrer | Start | Primary button before the set | pending David's approval (3 October) |
| Mettez-vous en place | Get into position | Under the countdown 3, 2, 1 | pending David's approval (3 October) |
| Annuler | Cancel | During the countdown | pending David's approval (3 October) |
| C’est parti ! | Go! | Spoken at the end of the countdown (voice on), and the title over the picture until the first rep | pending David's approval (3 October) |
| Le compte s’affiche à la première répétition. | The count appears at the first rep. | Over the picture, in view, before the first rep (no 0 is shown, R8) | pending David's approval (3 October) |
| Répétition / Répétitions | Rep / Reps | Under the live count | already on the result |
| Compte provisoire | Provisional count | Under the live count | pending David's approval (3 October) |
| Revenez dans le cadre | Step back into the frame | Over the picture during the set when nobody is seen for a second; the count is hidden (R8) | pending David's approval (3 October) |
| Terminer la série | End the set | Primary button during the set | pending David's approval (3 October) |
| Série en pause | Set paused | After the page was hidden during a set | pending David's approval (3 October) |
| Vous avez quitté l’écran : rien n’a été compté pendant ce temps. | You left the screen: nothing was counted meanwhile. | Same | pending David's approval (3 October) |
| Voir le compte | See the count | Same, primary: the count of what was filmed before the pause | pending David's approval (3 October) |
| Recommencer la série | Start the set again | Same, second button | pending David's approval (3 October) |
| Compte final… | Final count… | While the last samples are read after "Terminer la série" | pending David's approval (3 October) |
| Ce téléphone analyse lentement : le direct risque de s’arrêter. Filmer la série reste plus sûr. | This phone analyses slowly: live counting may stop. Recording the set is safer. | Under Start, when the pose model takes longer than one sample's interval | pending David's approval (3 October) |
| Accès à la caméra refusé. | Camera access denied. | Camera refused: title | pending David's approval (3 October) |
| Autorisez la caméra pour ce site dans les réglages de Safari, ou filmez votre série. | Allow the camera for this site in Safari’s settings, or record your set. | Same: text | pending David's approval (3 October) |
| Aucune caméra trouvée. | No camera found. | No camera: title | pending David's approval (3 October) |
| Filmez votre série ou choisissez une vidéo. | Record your set or choose a video. | Same: text | pending David's approval (3 October) |
| Ce navigateur ne donne pas accès à la caméra en direct. | This browser does not give live access to the camera. | Camera API refused by the browser: title | pending David's approval (3 October) |
| Filmez votre série : l’analyse se fera juste après. | Record your set: it is analysed right after. | Same: text | pending David's approval (3 October) |
| La caméra n’a pas pu s’ouvrir. | The camera could not open. | Camera busy: title | pending David's approval (3 October) |
| Elle sert peut-être à une autre app. Fermez-la, puis réessayez. | Another app may be using it. Close it, then try again. | Same: text | pending David's approval (3 October) |
| Ce téléphone ne suit pas le direct. | This phone cannot keep up live. | Two seconds of samples waiting for the pose model: title | pending David's approval (3 October) |
| Nous n’affichons pas un compte avec des trous. Filmez votre série : l’analyse se fera juste après. | We do not show a count with gaps in it. Record your set: it is analysed right after. | Same: text | pending David's approval (3 October) |
| Le comptage en direct n’a pas pu démarrer. | Live counting could not start. | Pose model failed: title | pending David's approval (3 October) |
| Rechargez la page, ou filmez votre série. | Reload the page, or record your set. | Same: text | pending David's approval (3 October) |
| Filmer ma série / Réessayer / Recharger la page | Record my set / Try again / Reload the page | Buttons of those screens | already on the Film and error screens |
| {n} (spoken) | {n} (spoken) | Each new rep, by the phone's own voice in the app's language, when the voice is on | pending David's approval (3 October) |

## Result and replay (Result.jsx, Replay.jsx), only for a set counted live

| FR | EN | Where | Status |
|---|---|---|---|
| En direct, l’app affichait {n}. Le compte final relit toute la série. | Live, the app showed {n}. The final count reads the whole set again. | Under the count, only when the live count differs from the final count | pending David's approval (3 October) |
| Personne n’apparaît à l’image. | We could not find you in the picture. | Refused live set, nobody found (a video's says "dans la vidéo") | pending David's approval (3 October) |
| La série s’arrête avant les {n} secondes : le score ne porte que sur ce qui a été filmé. | The set stops before {n} seconds: the score covers only what was filmed. | Fitness test counted live and ended early (a video's says "La vidéo s’arrête…") | pending David's approval (3 October) |
| Votre série comptée en direct, rejouée avec le squelette suivi par l’app | Your set counted live, replayed with the skeleton the app tracked | Replay picture, read aloud only | pending David's approval (3 October) |
| En doré, l’articulation dont l’angle compte les répétitions. Série comptée en direct : aucune vidéo n’a été enregistrée, seul le squelette est rejoué. | In gold, the joint whose angle counts the reps. Counted live: no video was recorded, only the skeleton is replayed. | Replay, last line | pending David's approval (3 October) |

README.md, "What it does" and "Privacy", carries the English description and disclosure.

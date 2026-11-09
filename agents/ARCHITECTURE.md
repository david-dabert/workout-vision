# Architecture Multi-Agents WorkoutVision

Ce document définit l'organisation, les responsabilités et les protocoles d'interaction du système multi-agents de WorkoutVision.

---

## 1. Philosophie & Principes Directeurs

WorkoutVision refuse le modèle du « prompt unique omniscient » qui tente de tout résoudre en mélangeant la cinématique d'un swing de golf, la détection de répétitions en musculation, le fitting cycliste et l'optimisation WebCodecs sur iPhone.

L'organisation repose sur une structure hiérarchique d'entreprise :
1. **Le Fondateur (David Dabert)** : Définit la vision produit, les priorités stratégiques, arbitre les décisions finales et valide les releases sur son iPhone.
2. **Le Bras Droit / Chief of Staff (« Sherman » - Orchestrateur)** : Reçoit la directive, la décompose en tâches unitaires, sollicite les spécialistes métiers, orchestre la revue adverse et synthétise les résultats avec preuves formelles.
3. **Le Collège des Métiers Spécialisés** : Des agents experts confinés à leur périmètre de code et de vérité scientifique (Squelette 3D, Golf, Vélo, Kiné, Comptage Cœur).
4. **Le Pôle Qualité & Vérification** : Des agents contradictoires (Reviewer adverse, Vérificateur de preuves, Ingénieur performance mobile) qui ne construisent rien mais cherchent activement la faille.

---

## 2. Organigramme des Agents

```
                        ┌────────────────────────┐
                        │   David (Fondateur)    │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │ 00-sherman-orchestrator │  (Chief of Staff)
                        └───────────┬────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ Pôle Biomécanique│    │  Pôle Kinématique│    │   Pôle Comptage  │
  │   & Squelette 3D │    │   Golf & Vélo    │    │      & Moteur    │
  │ (squelette-      │    │ (golf-kinematics,│    │ (counter-core.md)│
  │ biomecanique.md) │    │  velo-cycling.md)│    │                  │
  └─────────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │ Pôle Qualité & Preuves │
                        │  (wv-reviewer.md &     │
                        │   wv-verifier.md)      │
                        └────────────────────────┘
```

---

## 3. Registre des Profils d'Agents

| Fichier Markdown | Rôle | Périmètre Code / Domaine | Mode |
|---|---|---|---|
| [`00-sherman-orchestrator.md`](./00-sherman-orchestrator.md) | Bras Droit & Chef d'orchestre | Coordination, arbitrage, synthèse | Orchestration |
| [`metiers/squelette-biomecanique.md`](./metiers/squelette-biomecanique.md) | Biomécanicien & Squelette 3D | MediaPipe 33 landmarks, plans anatomiques, angles 3D | Spécialiste |
| [`metiers/golf-kinematics.md`](./metiers/golf-kinematics.md) | Biomécanicien Golf | `src/lib/golfKinematics.ts`, cinématique du swing | Spécialiste |
| [`metiers/velo-cycling.md`](./metiers/velo-cycling.md) | Ergomecanicien Cyclisme | `src/lib/cyclingKinematics.ts`, bike fitting | Spécialiste |
| [`metiers/kine-rehab.md`](./metiers/kine-rehab.md) | Consultant Kinésithérapie | Bilans d'amplitude ROM, compensations articulaires | Spécialiste |
| [`metiers/counter-core.md`](./metiers/counter-core.md) | Ingénieur Comptage Cœur | `src/lib/counting/`, matrices d'auto-similarité | Spécialiste |
| [`qualite/wv-reviewer.md`](./qualite/wv-reviewer.md) | Reviewer Adverse | Détection de failles, courses critiques, Safari iOS | Qualité |
| [`qualite/wv-verifier.md`](./qualite/wv-verifier.md) | Contrôleur de Preuves | Respect de DIRECTIVES.md, scoreboards, CI verte | Qualité |

---

## 4. Règles d'Interaction & Protocole

1. **Règle R15 (Issue #190)** : Tout agent doit lire le journal d'issue #190 avant d'agir, poser un `CLAIM` avant d'éditer un fichier, et clore la session par un `REPORT` avec la mention explicite « Non vérifié ».
2. **Isolation des Périmètres** : Un agent métier ne modifie jamais les fichiers d'un autre pôle sans l'accord explicite et l'arbitrage de Sherman.
3. **Zéro Chiffre sans Commande** : Aucun score de précision, pourcentage ou métrique ne peut être cité sans son fichier source ou la commande terminal exacte qui l'a produit.
4. **Revue Adverse Obligatoire** : Aucun code métier ne part en production sans passer le crible de `wv-reviewer` et `wv-verifier`.

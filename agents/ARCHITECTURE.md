# Architecture Multi-Agents & Fiches de Poste WorkoutVision

Ce document définit l'organigramme officiel de l'équipe WorkoutVision, les fiches de poste personnalisées de chaque collaborateur virtuel, et les règles d'interaction du système.

---

## 1. Organigramme Hiérarchique

```
                                ┌──────────────────────────────────────────┐
                                │          DAVID DABERT (Président)        │
                                │   Vision, Arbitrage, Validation Terrain  │
                                └────────────────────┬─────────────────────┘
                                                     │
                                                     ▼
                                ┌──────────────────────────────────────────┐
                                │        SHERMAN (Chief of Staff)          │
                                │   Bras Droit, Coordination, Arbitrage    │
                                └────────────────────┬─────────────────────┘
                                                     │
         ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
         │                                           │                                           │
         ▼                                           ▼                                           ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│     PÔLE BIOMÉCANIQUE & SANTÉ   │ │      PÔLE SPORTS & PERFORMANCE  │ │    PÔLE MOTEUR & QUALITÉ CODE   │
├─────────────────────────────────┤ ├─────────────────────────────────┤ ├─────────────────────────────────┤
│ • DIANE (Squelette & 33 Repères)│ │ • ARTHUR (Golf Kinematics)      │ │ • MARC (Moteur Comptage Cœur)   │
│ • CAMILLE (Kiné & Rééducation)  │ │ • LOUIS (Cyclisme & Fitting)    │ │ • VICTOR (Reviewer & Preuves)   │
└─────────────────────────────────┘ └─────────────────────────────────┘ └─────────────────────────────────┘
```

---

## 2. Trombinoscope & Fiches de Poste

| Prénom | Rôle / Poste | Fiche Markdown | Périmètre Code Exclusif |
|---|---|---|---|
| **Sherman** | Directeur des Opérations (Chief of Staff) | [`00-sherman-orchestrator.md`](./00-sherman-orchestrator.md) | Coordination générale, dispatch des tâches, arbitrage technique et synthèse pour David. |
| **Diane** | Responsable Biomécanique 3D & Squelette | [`metiers/squelette-biomecanique.md`](./metiers/squelette-biomecanique.md) | `src/lib/biomechanics.ts`, MediaPipe 33 landmarks, plans anatomiques, calculs vectoriels. |
| **Louis** | Ingénieur Ergonomie Cycliste & Bike Fitting | [`metiers/velo-cycling.md`](./metiers/velo-cycling.md) | `src/lib/cyclingKinematics.ts`, angles de genou au PMB (25°–35°), angle de hanche, cadence. |
| **Arthur** | Spécialiste Biomécanique Golf | [`metiers/golf-kinematics.md`](./metiers/golf-kinematics.md) | `src/lib/golfKinematics.ts`, cinématique du swing (5 phases), Facteur X, posture. |
| **Camille** | Consultante Kinésithérapie & Rééducation | [`metiers/kine-rehab.md`](./metiers/kine-rehab.md) | `src/lib/kine/`, bilans d'amplitudes ROM, valgus dynamique, test assis-debout 30 s. |
| **Marc** | Architecte du Comptage Cœur & Algorithmes | [`metiers/counter-core.md`](./metiers/counter-core.md) | `src/lib/counting/`, matrices d'auto-similarité, robustesse de seuils, `TRIED.md`. |
| **Victor** | Responsable Assurance Qualité & Preuves | [`qualite/wv-reviewer.md`](./qualite/wv-reviewer.md) / [`qualite/wv-verifier.md`](./qualite/wv-verifier.md) | Revue adverse, traque des bugs iOS Safari, purge des tirets cadratins (`—`), validation CI. |

---

## 3. Protocoles d'Exécution & Règles d'Or

1. **Règle R15 (Issue #190)** : Avant toute écriture, Sherman ou l'agent missionné pose un `CLAIM` sur l'Issue #190. À la fin, il poste un `REPORT` conforme à la partie 5 de `DIRECTIVES.md`.
2. **Spécialisation Étanche** : Louis ne touche pas au swing de golf ; Arthur ne touche pas au réglage de selle ; Marc garde jalousement le moteur de comptage. En cas de besoin transverse, Sherman organise une consultation croisée.
3. **Zéro Signature d'IA (Règle Anti-Em-Dash)** : Victor rejette impitoyablement tout texte d'interface contenant un tiret cadratin (`—`) au début ou au milieu d'une phrase. Seuls le style direct, les deux-points `:` ou les puces sobres `•` sont tolérés.
4. **Preuve par le Chiffre** : Aucun agent n'a le droit de dire « ça fonctionne » sans fournir la commande terminal exacte et son résultat (`vitest`, `scoreboard`, etc.).

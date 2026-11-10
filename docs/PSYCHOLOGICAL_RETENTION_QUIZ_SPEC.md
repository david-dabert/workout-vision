# Spécification Produit : Questionnaire Psychologique d'Engagement & Rétention

> **Auteur** : David Dabert & Équipe Produit WorkoutVision  
> **Date** : 10 Novembre 2026  
> **Statut** : Validé et Implémenté  

---

## 1. Vision & Psychologie de l'Engagement

Le modèle d'engagement de WorkoutVision suit le principe fondamental du **Progressive Profiling post-Aha! Moment** (inspiré de DanceBy, BetterMe et Noom) :

1. **L'Effet Waouh d'Abord (Zéro Friction)** :
   L'utilisateur essaye l'application sans création de compte ni questionnaire bloquant. Il filme une série réelle ou charge une vidéo. Le moteur local extrait les répétitions, la vitesse et le squelette 3D.
2. **L'Accroche Psychologique (The Hook)** :
   Une fois la série validée, l'application propose de valoriser cette analyse :
   *« Tirez le maximum de votre vidéo : prenez 90 secondes pour calibrer vos leviers articulaires, votre physique cible et vos charges optimales. »*
3. **Le Questionnaire Immersif TikTok-Like (High Dopamine)** :
   Un flux vertical rapide, tactile, ultra-fluide avec micro-vibrations haptiques.
   - **Biométrie de base** : Taille, Poids, Âge, Sexe biologique (calcul du BMR et de l'IMC).
   - **Silhouette & Physique recherché** : V-Taper athlétique, Puissance & Densité, Athlète sec & découpé, Galbe postérieur, Longévité kiné.
   - **Priorité musculaire** : Pectoraux/Épaules, Dos en V, Bras, Fessiers, Cuisses, Sangle abdominale.
   - **Objectifs Court & Long Terme** : Paliers techniques (4-8 sem) et transformation corporelle (6-12 mois).
   - **Disponibilité & Rythme** : Durée par séance (20 à 75+ min), fréquence hebdomadaire.
   - **Matériel & Sensibilités articulaires** : Salle de sport, home gym, poids du corps, zones sensibles (épaules, lombaires, genoux).
4. **La Synthèse Cinématique & La Carte d'Identité Athlète** :
   Une animation cinématique de calibration locale suivie de la délivrance de la **Carte d'Identité Athlète** avec prescription biomécanique personnalisée (stance de squat, tempo d'hypertrophie, calcul calorique réel).

---

## 2. Implémentation Technique

- **Composant UI** : [`src/components/experience/BiomechanicalRetentionQuiz.jsx`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/src/components/experience/BiomechanicalRetentionQuiz.jsx)
- **Feuille de styles** : [`src/components/experience/BiomechanicalRetentionQuiz.css`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/src/components/experience/BiomechanicalRetentionQuiz.css)
- **Déclencheur Résultat** : [`src/components/experience/Result.jsx`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/src/components/experience/Result.jsx) (`res-retention-hook`)
- **Déclencheur Hub** : [`src/components/experience/Choice.jsx`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/src/components/experience/Choice.jsx) (`choice-athlete-profile`)
- **Stockage Local** : `localStorage` (`wv_athlete_profile`, `wv_profile_completed`) et IndexedDB (`saveProfile`). Zéro fuite réseau.

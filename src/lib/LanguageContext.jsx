import { createContext, useContext, useState, useCallback } from 'react';

const translations = {
  // ─── Global / Shared ───
  'close': { en: 'Close', fr: 'Fermer' },
  'back': { en: 'Back', fr: 'Retour' },
  'done': { en: 'Done', fr: 'Terminé' },
  'remove': { en: 'Remove', fr: 'Retirer' },
  'delete': { en: 'Delete', fr: 'Supprimer' },
  'save': { en: 'Save', fr: 'Enregistrer' },
  'cancel': { en: 'Cancel', fr: 'Annuler' },
  'retry': { en: 'Retry', fr: 'Réessayer' },
  'search': { en: 'Search', fr: 'Rechercher' },
  'loading': { en: 'Loading...', fr: 'Chargement...' },
  'today': { en: 'Today', fr: "Aujourd'hui" },
  'reps': { en: 'Reps', fr: 'Reps' },
  'sets': { en: 'sets', fr: 'séries' },
  'set': { en: 'Set', fr: 'Série' },
  'form': { en: 'Form', fr: 'Forme' },
  'cal': { en: 'cal', fr: 'cal' },
  'kcal': { en: 'kcal', fr: 'kcal' },

  // ─── Tab bar / Navigation ───
  'home': { en: 'Home', fr: 'Accueil' },
  'nutrition': { en: 'Nutrition', fr: 'Nutrition' },
  'progress': { en: 'Progress', fr: 'Progrès' },
  'profile': { en: 'Profile', fr: 'Profil' },
  'train': { en: 'Train', fr: "S'entraîner" },

  // ─── Dashboard ───
  'tagline': { en: 'Your AI Gym Companion', fr: 'Votre coach fitness intelligent' },
  'ai_engine_ready': { en: 'AI Engine Ready', fr: 'Moteur IA prêt' },
  'engine_failed': { en: 'Engine Failed', fr: 'Moteur en erreur' },
  'loading_ai': { en: 'Loading AI...', fr: 'Chargement IA...' },
  'install_app': { en: 'Install WorkoutVision', fr: 'Installer WorkoutVision' },
  'install_desc': { en: 'Add to home screen for full app experience', fr: "Ajouter à l'écran d'accueil" },
  'install': { en: 'Install', fr: 'Installer' },
  'burned': { en: 'burned', fr: 'brûlées' },
  'kcal_eaten': { en: 'kcal eaten', fr: 'kcal ingérées' },
  'protein': { en: 'protein', fr: 'protéines' },
  'progressing': { en: 'Progressing', fr: 'En progression' },
  'needs_attention': { en: 'Needs attention', fr: 'À surveiller' },
  'plateau': { en: 'Plateau', fr: 'Plateau' },
  'd_streak': { en: 'd streak', fr: 'j. consécutifs' },
  'deload_warning': { en: 'Consider a deload week. Form scores declining over 4 weeks.', fr: 'Envisagez une semaine de décharge. Scores de forme en baisse depuis 4 semaines.' },
  'view_all_progressions': { en: 'View all progressions', fr: 'Voir toutes les progressions' },
  'nav_live': { en: 'LIVE', fr: 'DIRECT' },
  'nav_live_title': { en: 'Live Training', fr: 'Entraînement en direct' },
  'nav_live_desc': { en: 'Real-time form coaching with camera', fr: 'Coaching de forme en temps réel avec la caméra' },
  'nav_video': { en: 'VIDEO', fr: 'VIDÉO' },
  'nav_video_title': { en: 'Analyze Video', fr: 'Analyser une vidéo' },
  'nav_video_desc': { en: 'Upload and analyze recordings', fr: 'Importer et analyser des enregistrements' },
  'nav_id': { en: 'ID', fr: 'ID' },
  'nav_id_title': { en: 'Identify Machine', fr: 'Identifier une machine' },
  'nav_id_desc': { en: 'Photo a machine to find the exercise', fr: "Photographier une machine pour trouver l'exercice" },
  'nav_food': { en: 'FOOD', fr: 'REPAS' },
  'nav_food_title': { en: 'Log Nutrition', fr: 'Journal nutritionnel' },
  'nav_food_desc': { en: 'Scan barcode or photo your plate', fr: 'Scanner un code-barres ou photographier votre assiette' },
  'nav_plan': { en: 'PLAN', fr: 'PLAN' },
  'nav_plan_title': { en: 'My Plan', fr: 'Mon programme' },
  'nav_plan_desc': { en: 'Personalized workout plan & body analysis', fr: "Programme d'entraînement et analyse corporelle" },
  'nav_log': { en: 'LOG', fr: 'SAISIE' },
  'nav_log_title': { en: 'Manual Log', fr: 'Saisie manuelle' },
  'nav_log_desc': { en: 'Log sets without camera', fr: 'Enregistrer des séries sans caméra' },
  'nav_prs': { en: 'PRs', fr: 'PRs' },
  'nav_prs_title': { en: 'Exercise History', fr: 'Historique des exercices' },
  'nav_prs_desc': { en: 'All sets, PRs, and progress per exercise', fr: 'Séries, records et progression par exercice' },
  'nav_rest': { en: 'REST', fr: 'REPOS' },
  'nav_rest_title': { en: 'Rest Timer', fr: 'Minuteur de repos' },
  'nav_rest_desc': { en: 'Between-set countdown with audio alert', fr: 'Compte à rebours entre séries avec alerte sonore' },
  'setup_profile': { en: 'Set up your profile', fr: 'Configurer votre profil' },
  'setup_profile_desc': { en: 'Add your weight, height, age for personalized calories and macro targets', fr: 'Ajoutez poids, taille et âge pour des objectifs caloriques personnalisés' },
  'recent': { en: 'Recent', fr: 'Récent' },
  'form_colon': { en: 'Form:', fr: 'Forme :' },
  'what_makes_different': { en: 'What makes it different', fr: 'Ce qui fait la différence' },
  'step_1_desc': { en: 'Real-time pose detection with form coaching and voice cues', fr: 'Détection de posture en temps réel avec coaching vocal' },
  'step_2_desc': { en: 'Track nutrition: scan barcodes, photo plates, search 100+ foods', fr: 'Suivi nutritionnel : scanner, photographier, chercher plus de 100 aliments' },
  'step_3_desc': { en: 'Get science-backed progression and periodization recommendations', fr: 'Recommandations de progression et périodisation basées sur la science' },
  'diff_1': { en: 'Real-time pose detection with 33 body landmarks', fr: 'Détection de posture temps réel avec 33 points corporels' },
  'diff_2': { en: 'Per-rep form scoring and voice coaching', fr: 'Score de forme par répétition et coaching vocal' },
  'diff_3': { en: 'Velocity tracking for fatigue detection', fr: 'Suivi de vitesse pour détection de la fatigue' },
  'diff_4': { en: '55+ exercises with form analysis', fr: "Plus de 55 exercices avec analyse de la forme" },
  'diff_5': { en: 'Personalized nutrition and macro targets', fr: 'Objectifs nutritionnels et macros personnalisés' },
  'diff_6': { en: 'Periodized workout plans adapted to your goals', fr: "Programmes périodisés adaptés à vos objectifs" },

  // ─── Video Upload / Analyze ───
  'analyze_video': { en: 'Analyze Video', fr: 'Analyser la vidéo' },
  'tap_to_select': { en: 'Tap to select videos', fr: 'Appuyer pour sélectionner des vidéos' },
  'file_types': { en: 'MP4, MOV, WebM', fr: 'MP4, MOV, WebM' },
  'automatic': { en: 'Automatic', fr: 'Automatique' },
  'compound': { en: 'Compound', fr: 'Polyarticulaire' },
  'isolation': { en: 'Isolation', fr: 'Isolation' },
  'bodyweight': { en: 'Bodyweight', fr: 'Poids du corps' },
  'other': { en: 'Other', fr: 'Autre' },
  'analyze': { en: 'Analyze', fr: 'Analyser' },
  'failed_try_different': { en: 'Failed — try a different clip or use Live Training', fr: 'Échec — essayez un autre clip ou le mode en direct' },
  'loading_ai_engine': { en: 'Loading AI engine...', fr: 'Chargement du moteur IA...' },
  'downloading_model': { en: 'Downloading pose detection model (~3 MB)', fr: 'Téléchargement du modèle de détection (~3 Mo)' },
  'loading_file': { en: 'Loading', fr: 'Chargement de' },
  'analyzing_file': { en: 'Analyzing', fr: 'Analyse de' },
  'starting_file': { en: 'Starting', fr: 'Démarrage de' },
  'auto_detected': { en: 'Auto-detected', fr: 'Détecté auto.' },
  'duration': { en: 'Duration', fr: 'Durée' },
  'quality': { en: 'Quality', fr: 'Qualité' },
  'analysis': { en: 'Analysis', fr: 'Analyse' },
  'velocity_per_rep': { en: 'Velocity per rep', fr: 'Vitesse par rep' },
  'time_under_tension': { en: 'Time under tension', fr: 'Temps sous tension' },
  'eccentric': { en: 'Eccentric', fr: 'Excentrique' },
  'concentric': { en: 'Concentric', fr: 'Concentrique' },
  'total': { en: 'Total', fr: 'Total' },
  'range_of_motion': { en: 'Range of motion', fr: 'Amplitude de mouvement' },
  'avg_rom': { en: 'Avg ROM', fr: 'ROM moy.' },
  'consistency': { en: 'Consistency', fr: 'Régularité' },
  'asymmetry': { en: 'Asymmetry', fr: 'Asymétrie' },
  'imbalance': { en: 'Imbalance', fr: 'Déséquilibre' },
  'fatigue': { en: 'Fatigue', fr: 'Fatigue' },
  'fatigue_index': { en: 'Fatigue index', fr: 'Indice de fatigue' },
  'velocity_dropoff': { en: 'Velocity dropoff', fr: 'Perte de vitesse' },
  'form_notes': { en: 'Form notes', fr: 'Notes de forme' },
  'engine': { en: 'Engine', fr: 'Moteur' },
  'highlights': { en: 'Highlights', fr: 'Points forts' },
  'next_steps': { en: 'Next steps', fr: 'Prochaines étapes' },
  'per_rep_quality': { en: 'Per-rep quality', fr: 'Qualité par rep' },
  'watch_overlay': { en: 'Watch with AI Overlay', fr: 'Voir avec superposition IA' },
  'share_card': { en: 'Share Summary Card', fr: 'Partager la fiche résumé' },
  'no_poses': { en: 'Could not detect any poses', fr: 'Aucune pose détectée' },
  'try_different': { en: 'Try a different angle or better lighting, or use Live Training mode.', fr: 'Essayez un autre angle ou un meilleur éclairage, ou utilisez le mode en direct.' },
  'model_failed': { en: "AI model failed to load. Check your connection.", fr: "Le modèle IA n'a pas pu se charger. Vérifiez votre connexion." },
  'video_failed': { en: 'Video failed to load. Try a different file or shorter clip.', fr: 'Échec du chargement vidéo. Essayez un autre fichier ou un clip plus court.' },
  'too_large': { en: 'is too large. Maximum is 500 MB.', fr: 'est trop volumineux. Maximum 500 Mo.' },
  'need_more_reps': { en: 'Need more reps.', fr: 'Plus de reps nécessaires.' },

  // ─── Video Replay ───
  'ai_overlay': { en: 'AI Overlay', fr: 'Superposition IA' },
  'download_hd': { en: 'Download HD Video', fr: 'Télécharger vidéo HD' },
  'save_screenshot': { en: 'Save HD Screenshot', fr: 'Enregistrer capture HD' },
  'cancel_export': { en: 'Cancel Export', fr: "Annuler l'export" },

  // ─── Live Camera ───
  'live_training': { en: 'Live Training', fr: 'Entraînement en direct' },
  'start_set': { en: 'Start Set', fr: 'Démarrer série' },
  'stop_set': { en: 'Stop & Save', fr: 'Arrêter et sauver' },
  'rest_timer': { en: 'Rest Timer', fr: 'Minuteur de repos' },
  'skip_rest': { en: 'Skip', fr: 'Passer' },
  'next_set': { en: 'Next Set', fr: 'Série suivante' },
  'init_camera': { en: 'Initializing camera and model...', fr: 'Initialisation de la caméra et du modèle...' },
  'camera_failed': { en: "Camera or model failed to load.", fr: "Impossible de charger la caméra ou le modèle." },
  'move_into_frame': { en: 'Move into frame', fr: 'Placez-vous dans le cadre' },
  'no_pose_detected': { en: 'No pose detected', fr: 'Aucune posture détectée' },
  'downloading_model': { en: 'Downloading pose model (~5 MB)...', fr: 'Téléchargement du modèle (~5 Mo)...' },
  'starting_camera': { en: 'Starting camera...', fr: 'Démarrage de la caméra...' },
  'flip_camera': { en: 'Flip camera', fr: 'Retourner la caméra' },
  'slow_device_banner': { en: 'AI running slowly on this device. Skeleton hidden to save power.', fr: 'IA lente sur cet appareil. Squelette masqué pour économiser.' },
  'switch_manual': { en: 'Manual Log', fr: 'Saisie manuelle' },

  // ─── Coaching report (structured findings) ───
  'coach_no_exercises': { en: 'No exercises recorded in this session.', fr: 'Aucun exercice enregistré dans cette session.' },
  'coach_complete_one': { en: 'Complete at least one exercise to generate a report.', fr: 'Effectuez au moins un exercice pour générer un rapport.' },
  'coach_symmetry': { en: 'Excellent bilateral symmetry on {{exerciseName}}.', fr: 'Excellente symétrie bilatérale sur {{exerciseName}}.' },
  'coach_velocity_drop': { en: 'Velocity dropped {{dropoff}}% on {{exerciseName}}. Consider reducing reps or load.', fr: 'Vitesse en baisse de {{dropoff}}% sur {{exerciseName}}. Réduisez les reps ou la charge.' },
  'coach_rom_inconsistent': { en: 'Inconsistent range of motion on {{exerciseName}} ({{consistency}}%). Focus on controlled tempo.', fr: 'Amplitude irrégulière sur {{exerciseName}} ({{consistency}}%). Travaillez le tempo.' },
  'coach_compensation': { en: '{{pattern}} detected on {{exerciseName}}: {{description}}', fr: '{{pattern}} détecté sur {{exerciseName}} : {{description}}' },
  'coach_quality_strong': { en: 'Strong movement quality on {{exerciseName}} ({{score}}/100).', fr: 'Excellente qualité de mouvement sur {{exerciseName}} ({{score}}/100).' },
  'coach_good_volume': { en: 'Good volume on {{muscle}}: {{sets}} working sets.', fr: 'Bon volume sur {{muscle}} : {{sets}} séries de travail.' },
  'coach_session_completed': { en: 'Completed {{count}} exercise(s) this session.', fr: '{{count}} exercice(s) complété(s) cette session.' },
  'coach_no_issues': { en: 'No significant issues detected. Maintain current form and consider progressive overload.', fr: 'Aucun problème significatif détecté. Maintenez votre forme et envisagez une surcharge progressive.' },
  'coach_summary': { en: 'Session grade: {{grade}}. {{totalReps}} total reps across {{exerciseCount}} exercise(s). Volume: {{volumeLoad}} kg.', fr: 'Note de session : {{grade}}. {{totalReps}} reps au total sur {{exerciseCount}} exercice(s). Volume : {{volumeLoad}} kg.' },
  'detecting': { en: 'Detecting...', fr: 'Détection...' },
  'rest_label': { en: 'REST', fr: 'REPOS' },
  'seconds': { en: 'seconds', fr: 'secondes' },
  'voice_coach': { en: 'Voice coach', fr: 'Coach vocal' },
  'rest_x_s': { en: 'Rest', fr: 'Repos' },
  'sets_colon': { en: 'Sets:', fr: 'Séries :' },
  'burned_colon': { en: 'Burned:', fr: 'Brûlées :' },
  'exit_session': { en: 'Exit session?', fr: 'Quitter la session ?' },
  'superset_other': { en: 'Superset / Other', fr: 'Superset / Autre' },

  // ─── Voice coaching (spoken via TTS, session-locked language) ───
  'voice_rest': { en: 'Rest {{seconds}} seconds', fr: 'Repos {{seconds}} secondes' },
  'voice_next_set': { en: 'Time. Next set.', fr: 'Temps écoulé. Série suivante.' },
  'voice_set_complete': { en: '{{reps}} reps. Form score {{score}}. {{cal}} calories burned.', fr: '{{reps}} reps. Score {{score}}. {{cal}} calories brûlées.' },
  'model_download_progress': { en: 'Downloading model: {{percent}}%', fr: 'Téléchargement : {{percent}}%' },

  // ─── Profile ───
  'your_measurements': { en: 'Your measurements', fr: 'Vos mensurations' },
  'name': { en: 'Name', fr: 'Nom' },
  'age': { en: 'Age', fr: 'Âge' },
  'weight_kg': { en: 'Weight (kg)', fr: 'Poids (kg)' },
  'height_cm': { en: 'Height (cm)', fr: 'Taille (cm)' },
  'sex': { en: 'Sex', fr: 'Sexe' },
  'male': { en: 'Male', fr: 'Homme' },
  'female': { en: 'Female', fr: 'Femme' },
  'ethnicity': { en: 'Ethnicity', fr: 'Origine ethnique' },
  'activity_level': { en: 'Activity Level', fr: "Niveau d'activité" },
  'sedentary': { en: 'Sedentary', fr: 'Sédentaire' },
  'light_activity': { en: 'Light (1-2x/week)', fr: 'Léger (1-2x/sem.)' },
  'moderate_activity': { en: 'Moderate (3-4x/week)', fr: 'Modéré (3-4x/sem.)' },
  'active_activity': { en: 'Active (5-6x/week)', fr: 'Actif (5-6x/sem.)' },
  'very_active_activity': { en: 'Very Active (daily)', fr: 'Très actif (quotidien)' },
  'resting_hr': { en: 'Resting HR (bpm)', fr: 'FC repos (bpm)' },
  'experience': { en: 'Experience', fr: 'Expérience' },
  'beginner': { en: 'Beginner', fr: 'Débutant' },
  'intermediate': { en: 'Intermediate', fr: 'Intermédiaire' },
  'advanced': { en: 'Advanced', fr: 'Avancé' },
  'goal': { en: 'Goal', fr: 'Objectif' },
  'general_fitness': { en: 'General Fitness', fr: 'Forme générale' },
  'strength': { en: 'Strength', fr: 'Force' },
  'muscle_growth': { en: 'Muscle Growth', fr: 'Prise de muscle' },
  'endurance': { en: 'Endurance', fr: 'Endurance' },
  'weight_loss': { en: 'Weight Loss', fr: 'Perte de poids' },
  'injuries': { en: 'Injuries / limitations', fr: 'Blessures / limitations' },
  'save_profile': { en: 'Save Profile', fr: 'Enregistrer le profil' },
  'saved': { en: 'Saved!', fr: 'Enregistré !' },
  'your_baselines': { en: 'Your baselines', fr: 'Vos valeurs de référence' },
  'medical_records': { en: 'Medical records', fr: 'Dossier médical' },
  'upload_file': { en: 'Upload file', fr: 'Importer un fichier' },
  'file_too_large': { en: 'File too large. Maximum size is 10MB.', fr: 'Fichier trop volumineux. Taille maximale : 10 Mo.' },
  'hr_zones_title': { en: 'Heart rate zones', fr: 'Zones de fréquence cardiaque' },
  'daily_energy': { en: 'Daily energy needs', fr: 'Besoins énergétiques journaliers' },
  'strength_baselines': { en: 'Strength baselines (untrained est.)', fr: 'Bases de force (est. débutant)' },
  'est_bf': { en: 'Est. BF', fr: 'MG est.' },
  'max_hr_short': { en: 'Max HR', fr: 'FC max' },
  'upload_medical_desc': { en: 'Upload medical files. Everything stays on your device.', fr: 'Importez vos documents médicaux. Tout reste sur votre appareil.' },
  'pdf_images_docs': { en: 'PDF, images, documents', fr: 'PDF, images, documents' },
  'no_records_yet': { en: 'No records uploaded yet.', fr: 'Aucun document importé.' },
  'uploaded_on': { en: 'Uploaded', fr: 'Importé le' },
  'bmi': { en: 'BMI', fr: 'IMC' },
  'bmr': { en: 'BMR', fr: 'MB' },

  // ─── Onboarding ───
  'welcome_subtitle': { en: 'Your AI-powered fitness companion', fr: "Votre compagnon fitness propulsé par l'IA" },
  'get_started': { en: 'Get Started', fr: 'Commencer' },
  'skip': { en: 'Skip', fr: 'Passer' },
  'onb_step1_title': { en: 'Tell us about you', fr: 'Parlez-nous de vous' },
  'onb_step1_desc': { en: 'We personalize your experience based on your profile.', fr: 'Nous personnalisons votre expérience selon votre profil.' },
  'onb_step2_title': { en: 'Your goals', fr: 'Vos objectifs' },
  'onb_step2_desc': { en: 'Help us tailor your workout recommendations.', fr: 'Aidez-nous à adapter vos recommandations.' },
  'next': { en: 'Next', fr: 'Suivant' },
  'finish': { en: 'Finish', fr: 'Terminer' },
  'onb_feature_live': { en: 'Real-time form analysis', fr: 'Analyse de forme en temps réel' },
  'onb_feature_video': { en: 'Video upload analysis', fr: 'Analyse de vidéos importées' },
  'onb_feature_nutrition': { en: 'Nutrition tracking', fr: 'Suivi nutritionnel' },
  'onb_feature_progress': { en: 'Progress tracking', fr: 'Suivi de progression' },

  // ─── Progress / Workout History ───
  'no_workouts': { en: 'No workouts yet', fr: 'Aucun entraînement' },
  'no_workouts_desc': { en: 'Start a live session or upload a video to see your progress here.', fr: 'Lancez une session en direct ou importez une vidéo pour voir votre progression.' },
  'sessions': { en: 'Sessions', fr: 'Sessions' },
  'total_reps': { en: 'Total Reps', fr: 'Reps totales' },
  'avg_form': { en: 'Avg Form', fr: 'Forme moy.' },
  'day_streak': { en: 'Day Streak', fr: 'Jours consécutifs' },
  'form_score_trend': { en: 'Form score trend', fr: 'Tendance du score de forme' },
  'delete_workout_confirm': { en: 'Delete this workout?', fr: 'Supprimer cet entraînement ?' },
  'this_week': { en: 'This week', fr: 'Cette semaine' },
  'last_week': { en: 'Last week', fr: 'Semaine dernière' },
  'weeks_ago': { en: 'weeks ago', fr: 'semaines' },
  'video_tag': { en: '(video)', fr: '(vidéo)' },
  'live_tag': { en: '(live)', fr: '(direct)' },
  'workouts': { en: 'Workouts', fr: 'Entraînements' },
  'training_load': { en: 'Training load', fr: "Charge d'entraînement" },
  'optimal': { en: 'optimal', fr: 'optimal' },
  'oldest': { en: 'Oldest', fr: 'Ancien' },
  'latest': { en: 'Latest', fr: 'Récent' },
  'loading_workouts': { en: 'Loading workouts...', fr: 'Chargement des entraînements...' },
  'week_of': { en: 'Week of', fr: 'Semaine du' },

  // ─── Rest Timer ───
  'rest_timer_title': { en: 'Rest Timer', fr: 'Minuteur de repos' },
  'rests': { en: 'RESTS', fr: 'REPOS' },
  'ready': { en: 'READY', fr: 'PRÊT' },
  'custom': { en: 'Custom', fr: 'Personnalisé' },
  'seconds_max_600': { en: 'Seconds (max 600)', fr: 'Secondes (max 600)' },
  'reset': { en: 'Reset', fr: 'Réinitialiser' },
  'pause': { en: 'Pause', fr: 'Pause' },
  'restart': { en: 'Restart', fr: 'Reprendre' },
  'start': { en: 'Start', fr: 'Démarrer' },

  // ─── Manual Log ───
  'log_workout': { en: 'Log Workout', fr: 'Enregistrer un entraînement' },
  'select_exercise': { en: 'Select exercise...', fr: 'Choisir un exercice...' },
  'search_exercises': { en: 'Search exercises...', fr: 'Rechercher un exercice...' },
  'no_exercises_found': { en: 'No exercises found.', fr: 'Aucun exercice trouvé.' },
  'weight_kg_short': { en: 'Weight (kg)', fr: 'Poids (kg)' },
  'add_set': { en: '+ Add set', fr: '+ Ajouter une série' },
  'add_exercise': { en: '+ Add exercise', fr: '+ Ajouter un exercice' },
  'saving': { en: 'Saving...', fr: 'Enregistrement...' },
  'workout_saved': { en: 'Workout logged successfully.', fr: 'Entraînement enregistré.' },

  // ─── Machine Identifier ───
  'identify_machine': { en: 'Identify machine', fr: 'Identifier la machine' },
  'take_photo': { en: 'Take a photo', fr: 'Prendre une photo' },
  'browse_catalog': { en: 'Browse equipment catalog', fr: 'Parcourir le catalogue' },
  'how_it_works': { en: 'How it works', fr: 'Comment ça marche' },
  'step_photo': { en: 'Take a photo of the machine or yourself using it', fr: "Photographiez la machine ou vous en train de l'utiliser" },
  'step_detect': { en: 'AI detects the exercise from your pose', fr: "L'IA détecte l'exercice d'après votre posture" },
  'step_start': { en: 'Start tracking with the correct exercise', fr: "Commencez le suivi avec le bon exercice" },
  'analyzing_pose': { en: 'Analyzing pose...', fr: 'Analyse de la posture...' },
  'exercise_detected': { en: 'Exercise detected', fr: 'Exercice détecté' },
  'confidence': { en: 'Confidence:', fr: 'Confiance :' },
  'use_this_exercise': { en: 'Use this exercise', fr: 'Utiliser cet exercice' },
  'not_right_browse': { en: 'Not right? Browse catalog', fr: 'Incorrect ? Parcourir le catalogue' },
  'no_person_detected': { en: 'No person detected', fr: 'Aucune personne détectée' },
  'try_another_photo': { en: 'Try another photo', fr: 'Essayer une autre photo' },
  'search_machines': { en: 'Search machines or exercises...', fr: 'Chercher machines ou exercices...' },
  'select': { en: 'Select', fr: 'Sélectionner' },

  // ─── Exercise History ───
  'exercise_history': { en: 'Exercise History', fr: 'Historique des exercices' },
  'loading_history': { en: 'Loading history...', fr: "Chargement de l'historique..." },
  'personal_records': { en: 'Personal Records', fr: 'Records personnels' },
  'best_weight': { en: 'Best Weight', fr: 'Meilleur poids' },
  'most_reps': { en: 'Most Reps', fr: 'Max reps' },
  'best_form': { en: 'Best Form', fr: 'Meilleure forme' },
  'weight_progression': { en: 'Weight Progression', fr: 'Progression en poids' },
  'all_sets': { en: 'All Sets', fr: 'Toutes les séries' },
  'pr': { en: 'PR', fr: 'PR' },
  'no_exercises_recorded': { en: "No exercises recorded yet.", fr: "Aucun exercice enregistré." },
  'best_colon': { en: 'Best:', fr: 'Meilleur :' },
  'max_reps_colon': { en: 'Max reps:', fr: 'Max reps :' },
  'last_colon': { en: 'Last:', fr: 'Dernier :' },

  // ─── Nutrition ───
  'maintain': { en: 'Maintain', fr: 'Maintien' },
  'cut': { en: 'Cut (-500)', fr: 'Sèche (-500)' },
  'bulk': { en: 'Bulk (+300)', fr: 'Prise (+300)' },
  'target': { en: 'Target', fr: 'Objectif' },
  'eaten': { en: 'Eaten', fr: 'Ingéré' },
  'remaining': { en: 'remaining', fr: 'restant' },
  'over': { en: 'over', fr: 'en excès' },
  'macros': { en: 'Macros', fr: 'Macros' },
  'protein_cap': { en: 'Protein', fr: 'Protéines' },
  'carbs': { en: 'Carbs', fr: 'Glucides' },
  'fat': { en: 'Fat', fr: 'Lipides' },
  'search_food': { en: 'Search food', fr: 'Chercher un aliment' },
  'scan_barcode': { en: 'Scan barcode', fr: 'Scanner un code-barres' },
  'photo_plate': { en: 'Photo plate', fr: 'Photographier le plat' },
  'food_log': { en: 'Food log', fr: 'Journal alimentaire' },
  'no_food_logged_today': { en: "No food logged today", fr: "Aucun aliment enregistré aujourd'hui" },
  'no_food_logged_day': { en: 'No food logged this day', fr: 'Aucun aliment enregistré ce jour' },
  'food_log_empty_desc': { en: 'Search, scan a barcode, or photo your plate to start tracking.', fr: 'Cherchez, scannez un code-barres ou photographiez votre assiette pour commencer.' },
  'workout_burn': { en: 'Workout burn', fr: 'Dépense entraînement' },
  'add_food': { en: 'Add food', fr: 'Ajouter un aliment' },
  'amount_g': { en: 'Amount (g)', fr: 'Quantité (g)' },
  'meal': { en: 'Meal', fr: 'Repas' },
  'breakfast': { en: 'Breakfast', fr: 'Petit-déjeuner' },
  'lunch': { en: 'Lunch', fr: 'Déjeuner' },
  'dinner': { en: 'Dinner', fr: 'Dîner' },
  'snack': { en: 'Snack', fr: 'Collation' },
  'add_to': { en: 'Add to', fr: 'Ajouter au' },
  'quick_portions': { en: 'Quick portions', fr: 'Portions rapides' },
  'search_foods': { en: 'Search foods...', fr: 'Rechercher des aliments...' },
  'no_results': { en: 'No results found', fr: 'Aucun résultat' },
  'scanned_product': { en: 'Scanned product', fr: 'Produit scanné' },
  'nutri_score': { en: 'Nutri-Score', fr: 'Nutri-Score' },
  'scan_barcode_title': { en: 'Scan Barcode', fr: 'Scanner un code-barres' },
  'point_camera_barcode': { en: 'Point camera at a barcode', fr: 'Pointez la caméra vers un code-barres' },
  'barcode_not_supported': { en: 'Barcode scanning not supported in this browser.', fr: 'Scan de code-barres non supporté dans ce navigateur.' },
  'barcode_try_other': { en: 'Try Chrome or Edge on Android, or Safari 17+ on iOS.', fr: 'Essayez Chrome ou Edge sur Android, ou Safari 17+ sur iOS.' },
  'go_back': { en: 'Go back', fr: 'Retour' },
  'camera_denied': { en: "Camera access denied.", fr: "Accès à la caméra refusé." },
  'looking_up_product': { en: 'Looking up product...', fr: 'Recherche du produit...' },
  'photo_your_plate': { en: 'Photo your plate', fr: 'Photographiez votre assiette' },
  'take_photo_meal': { en: 'Take a photo of your meal', fr: 'Prenez une photo de votre repas' },
  'tap_open_camera': { en: 'Tap to open camera', fr: 'Appuyez pour ouvrir la caméra' },
  'photo_plate_desc': { en: 'Describe your meal and estimate the macros. Portion photos help you track consistency over time.', fr: 'Décrivez votre repas et estimez les macros. Les photos aident à suivre la régularité.' },
  'what_did_you_eat': { en: "What did you eat?", fr: "Qu'avez-vous mangé ?" },
  'meal_placeholder': { en: 'e.g. Grilled chicken with rice', fr: 'Ex. Poulet grillé avec riz' },
  'portion_g': { en: 'Portion (g)', fr: 'Portion (g)' },
  'calories_est': { en: 'Calories (est.)', fr: 'Calories (est.)' },
  'protein_g': { en: 'Protein (g)', fr: 'Protéines (g)' },
  'carbs_g': { en: 'Carbs (g)', fr: 'Glucides (g)' },
  'fat_g': { en: 'Fat (g)', fr: 'Lipides (g)' },
  'retake_photo': { en: 'Retake photo', fr: 'Reprendre la photo' },
  'delete_entry_confirm': { en: 'Delete this entry?', fr: 'Supprimer cette entrée ?' },

  // ─── Workout Plan ───
  'workout_plan': { en: 'Workout Plan', fr: "Programme d'entraînement" },
  'generating': { en: 'Generating...', fr: 'Génération...' },
  'building_plan': { en: 'Building your personalized plan', fr: 'Construction de votre programme personnalisé' },
  'no_profile_found': { en: 'No Profile Found', fr: 'Aucun profil trouvé' },
  'setup_profile_first': { en: 'Set up your profile first to get a personalized plan.', fr: 'Configurez votre profil pour obtenir un programme personnalisé.' },
  'go_to_profile': { en: 'Go to Profile', fr: 'Aller au profil' },
  'profile_incomplete_hint': { en: 'Add experience, goals, resting HR, and injuries in your profile for more accurate results.', fr: 'Ajoutez expérience, objectifs, FC repos et blessures dans votre profil pour plus de précision.' },
  'my_analysis': { en: 'My Analysis', fr: 'Mon analyse' },
  'key_stats': { en: 'Key Stats', fr: 'Statistiques clés' },
  'body_composition': { en: 'Body Composition', fr: 'Composition corporelle' },
  'est_body_fat': { en: 'Est. Body Fat', fr: 'Masse grasse est.' },
  'ideal_weight': { en: 'Ideal Weight', fr: 'Poids idéal' },
  'tdee': { en: 'TDEE', fr: 'DETT' },
  'hr_zones': { en: 'Heart Rate Zones', fr: 'Zones de fréquence cardiaque' },
  'max_hr': { en: 'Max HR:', fr: 'FC max :' },
  'resting': { en: 'Resting:', fr: 'Repos :' },
  'bpm': { en: 'bpm', fr: 'bpm' },
  'daily_targets': { en: 'Daily Targets', fr: 'Objectifs journaliers' },
  'calories': { en: 'Calories', fr: 'Calories' },
  'est_1rm': { en: 'Estimated 1RM Potential', fr: 'Potentiel 1RM estimé' },
  'squat': { en: 'Squat', fr: 'Squat' },
  'bench_press': { en: 'Bench Press', fr: 'Développé couché' },
  'deadlift': { en: 'Deadlift', fr: 'Soulevé de terre' },
  'recommendations': { en: 'Recommendations', fr: 'Recommandations' },
  'your_program': { en: 'Your Program', fr: 'Votre programme' },
  'days_week': { en: 'days/week', fr: 'jours/sem.' },
  'week_mesocycle': { en: 'week mesocycle:', fr: 'semaines mésocycle :' },
  'day': { en: 'Day', fr: 'Jour' },
  'rest_colon': { en: 'Rest:', fr: 'Repos :' },
  'recovery': { en: 'Recovery', fr: 'Récupération' },
  'aerobic': { en: 'Aerobic', fr: 'Aérobie' },
  'tempo': { en: 'Tempo', fr: 'Tempo' },
  'threshold': { en: 'Threshold', fr: 'Seuil' },
  'vo2max': { en: 'VO2max', fr: 'VO2max' },

  // ─── Medical Records ───
  'medical_records_title': { en: 'Medical Records', fr: 'Dossier médical' },
  'uploading': { en: 'Uploading...', fr: 'Importation...' },
  'upload_medical': { en: 'Upload medical records', fr: 'Importer un dossier médical' },
  'pdf_jpg_png': { en: 'PDF, JPG, PNG', fr: 'PDF, JPG, PNG' },
  'key_health_markers': { en: 'Key health markers to track', fr: 'Marqueurs de santé à suivre' },
  'uploaded_records': { en: 'Uploaded records', fr: 'Documents importés' },
  'pdf_document': { en: 'PDF document', fr: 'Document PDF' },
  'add_notes_record': { en: 'Add notes about this record...', fr: 'Ajouter des notes sur ce document...' },
  'uploaded': { en: 'Uploaded', fr: 'Importé le' },
  'marker_resting_hr': { en: 'Resting heart rate', fr: 'Fréquence cardiaque au repos' },
  'marker_blood_pressure': { en: 'Blood pressure (systolic/diastolic)', fr: 'Tension artérielle (systolique/diastolique)' },
  'marker_hba1c': { en: 'HbA1c', fr: 'HbA1c' },
  'marker_testosterone': { en: 'Testosterone', fr: 'Testostérone' },
  'marker_vitamin_d': { en: 'Vitamin D', fr: 'Vitamine D' },
  'marker_iron': { en: 'Iron / Ferritin', fr: 'Fer / Ferritine' },
  'marker_crp': { en: 'CRP (inflammation)', fr: 'CRP (inflammation)' },
  'marker_lipids': { en: 'Lipid panel (LDL, HDL, triglycerides)', fr: 'Bilan lipidique (LDL, HDL, triglycérides)' },
  'marker_injuries': { en: 'Injury history / notes', fr: 'Historique de blessures / notes' },

  // ─── Training load zones ───
  'zone_undertraining': { en: 'Undertraining', fr: 'Sous-entraînement' },
  'zone_optimal': { en: 'Optimal', fr: 'Optimal' },
  'zone_caution': { en: 'Caution', fr: 'Attention' },
  'zone_danger': { en: 'Danger', fr: 'Danger' },
  'unknown': { en: 'Unknown', fr: 'Inconnu' },

  // ─── Exercise names ───
  'ex.squat': { en: 'Squat', fr: 'Squat' },
  'ex.deadlift': { en: 'Deadlift', fr: 'Soulevé de terre' },
  'ex.bench_press': { en: 'Bench Press', fr: 'Développé couché' },
  'ex.overhead_press': { en: 'Overhead Press', fr: 'Développé militaire' },
  'ex.barbell_row': { en: 'Barbell Row', fr: 'Rowing barre' },
  'ex.bicep_curl': { en: 'Bicep Curl', fr: 'Curl biceps' },
  'ex.tricep_extension': { en: 'Tricep Extension', fr: 'Extension triceps' },
  'ex.lateral_raise': { en: 'Lateral Raise', fr: 'Élévation latérale' },
  'ex.front_raise': { en: 'Front Raise', fr: 'Élévation frontale' },
  'ex.romanian_deadlift': { en: 'Romanian Deadlift', fr: 'Soulevé de terre roumain' },
  'ex.leg_press': { en: 'Leg Press', fr: 'Presse à cuisses' },
  'ex.leg_extension': { en: 'Leg Extension', fr: 'Extension de jambe' },
  'ex.leg_curl': { en: 'Leg Curl', fr: 'Curl de jambe' },
  'ex.calf_raise': { en: 'Calf Raise', fr: 'Mollets debout' },
  'ex.pull_up': { en: 'Pull-Up', fr: 'Traction' },
  'ex.push_up': { en: 'Push-Up', fr: 'Pompe' },
  'ex.dip': { en: 'Dip', fr: 'Dips' },
  'ex.plank': { en: 'Plank', fr: 'Planche' },
  'ex.lunge': { en: 'Lunge', fr: 'Fente' },
  'ex.hip_thrust': { en: 'Hip Thrust', fr: 'Hip Thrust' },
  'ex.cable_fly': { en: 'Cable Fly', fr: 'Écarté poulie' },
  'ex.face_pull': { en: 'Face Pull', fr: 'Face Pull' },
  'ex.hammer_curl': { en: 'Hammer Curl', fr: 'Curl marteau' },
  'ex.skull_crusher': { en: 'Skull Crusher', fr: 'Barre au front' },
  'ex.upright_row': { en: 'Upright Row', fr: 'Rowing menton' },
  'ex.shrug': { en: 'Shrug', fr: "Haussement d'épaules" },
  'ex.chest_fly': { en: 'Chest Fly', fr: 'Écarté pectoraux' },
  'ex.incline_press': { en: 'Incline Press', fr: 'Développé incliné' },
  'ex.decline_press': { en: 'Decline Press', fr: 'Développé décliné' },
  'ex.seated_row': { en: 'Seated Row', fr: 'Rowing assis' },
  'ex.lat_pulldown': { en: 'Lat Pulldown', fr: 'Tirage vertical' },
  'ex.preacher_curl': { en: 'Preacher Curl', fr: 'Curl au pupitre' },
  'ex.concentration_curl': { en: 'Concentration Curl', fr: 'Curl concentration' },
  'ex.lying_bicep_curl': { en: 'Lying Bicep Curl', fr: 'Curl allongé' },
  'ex.spider_curl': { en: 'Spider Curl', fr: 'Spider curl' },
  'ex.cable_curl': { en: 'Cable Curl', fr: 'Curl poulie' },
  'ex.tricep_pushdown': { en: 'Tricep Pushdown', fr: 'Poussée triceps poulie' },
  'ex.overhead_tricep': { en: 'Overhead Tricep Extension', fr: 'Extension triceps au-dessus' },
  'ex.kickback': { en: 'Tricep Kickback', fr: 'Kickback triceps' },
  'ex.goblet_squat': { en: 'Goblet Squat', fr: 'Goblet squat' },
  'ex.bulgarian_split': { en: 'Bulgarian Split Squat', fr: 'Squat bulgare' },
  'ex.step_up': { en: 'Step-Up', fr: 'Step-up' },
  'ex.good_morning': { en: 'Good Morning', fr: 'Good morning' },
  'ex.sumo_deadlift': { en: 'Sumo Deadlift', fr: 'Soulevé sumo' },
  'ex.hack_squat': { en: 'Hack Squat', fr: 'Hack squat' },
  'ex.sit_up': { en: 'Sit-Up', fr: 'Abdos' },
  'ex.crunch': { en: 'Crunch', fr: 'Crunch' },
  'ex.mountain_climber': { en: 'Mountain Climber', fr: 'Mountain climber' },
  'ex.burpee': { en: 'Burpee', fr: 'Burpee' },
  'ex.jumping_jack': { en: 'Jumping Jack', fr: 'Jumping jack' },
  'ex.box_jump': { en: 'Box Jump', fr: 'Box jump' },
  'ex.superset': { en: 'Superset / Other', fr: 'Superset / Autre' },
};

// ─── Detect initial language ───
function detectLang() {
  try {
    const saved = localStorage.getItem('wv_lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch (_) {}
  if (typeof navigator !== 'undefined') {
    const bl = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (bl.startsWith('fr')) return 'fr';
  }
  return 'en';
}

// ─── React Context ───
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const detected = detectLang();
    try { document.documentElement.lang = detected; } catch (_) {}
    return detected;
  });

  const setLang = useCallback((newLang) => {
    if (newLang !== 'en' && newLang !== 'fr') return;
    setLangState(newLang);
    try { localStorage.setItem('wv_lang', newLang); } catch (_) {}
    try { document.documentElement.lang = newLang; } catch (_) {}
  }, []);

  const t = useCallback((key, params) => {
    const entry = translations[key];
    if (!entry) return key;
    let str = entry[lang] || entry.en || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (k === 'key') continue;
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
      }
    }
    return str;
  }, [lang]);

  const tExercise = useCallback((exerciseKey, fallbackName) => {
    const key = `ex.${exerciseKey}`;
    const entry = translations[key];
    if (entry && entry[lang]) return entry[lang];
    return fallbackName || exerciseKey;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tExercise }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within LanguageProvider');
  return ctx;
}

// Module-level t() for non-React code (canvas overlays, utilities).
// Reads directly from localStorage so it stays in sync.
export function tModule(key, params) {
  let lang = 'en';
  try {
    const saved = localStorage.getItem('wv_lang');
    if (saved === 'en' || saved === 'fr') lang = saved;
  } catch (_) {}
  const entry = translations[key];
  if (!entry) return key;
  let str = entry[lang] || entry.en || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (k === 'key') continue;
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
    }
  }
  return str;
}

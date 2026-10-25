/**
 * The WorkoutVision Manifesto: The Science, History, and Mechanics of Optimal Lifting
 * Bilingual: French and English.
 *
 * Honesty pass of 14 October 2026, wave 2B (MAN-2 to MAN-4, the em dashes of the English text). The conclusion's
 * accuracy claim (MAN-1), the stimulus-to-fatigue injury claim and the 10 % / 15 % asymmetry rule (part of MAN-3) are
 * rewritten on the branch honesty-pass (commit 1959f6e) and left as they are here, to keep the two changes apart.
 * The claims changed here, with their source and status (R9); "not fetched" means not opened again on that day:
 * - Blair: fitness strongly associated with lower all-cause mortality (Blair SN et al., JAMA 1989;262(17):2395-2401);
 *   muscular strength likewise (Ruiz JR et al., BMJ 2008;337:a439). Literature, not fetched. "Definitive proof" is
 *   gone: cohorts show association.
 * - Layne Norton: PhD in nutritional sciences, University of Illinois, not a physician (biolayne.com, per the audit).
 * - Mechanical tension as the main driver of hypertrophy: Wackerhage H et al., J Appl Physiol 2019;126(1):30-43 (a
 *   review). Literature, not fetched. "Prove" became "indicate".
 * - Repetition tempo (rule 02): similar hypertrophy for repetitions of 0.5 to 8 s (Schoenfeld BJ et al., Sports Med
 *   2015;45(4):577-585, a meta-analysis). Literature, not fetched. A 2 to 3 s descent is an option, not a must.
 * - Momentum unloading the muscle and loading the joints (rule 02, its body), full range and stretch (rule 01), line of
 *   pull (rule 03), individual anatomy and joint pain (principle 3): convention, UNSOURCED. The app measures none of
 *   them: the buttons only open the lift for filming.
 * - The stimulus-to-fatigue ratio is a coaching idea (Israetel et al., Renaissance Periodization; convention): its
 *   drawn "equation" is not shown (Manifesto.jsx).
 * French lines changed here: awaiting David's approval (R10).
 */

export const MANIFESTO = {
  en: {
    badge: 'Educational Treatise & Scientific Blueprint',
    title: 'The WorkoutVision Manifesto',
    subtitle: 'The Science, History, and Mechanics of Optimal Lifting',
    readTime: '8 min read',
    lead: 'Welcome to WorkoutVision. You are holding a blueprint designed to bridge the gap between academic exercise physiology and the gym floor.',
    introP1: 'For decades, the fitness industry was dictated by dogmatic traditions, anecdotal hearsay, and unverified coaching lore. Today, we live in the era of science-based lifting, a discipline rooted in biomechanics, muscle protein synthesis, physics, and empirical data.',
    introP2: 'This guide details the history of sports science, the giants who built the field, why evidence-based training yields superior results, and how to execute movements with surgical precision.',

    tocTitle: 'Table of Contents',
    chapters: [
      { id: 'ch1', title: 'Chapter 1: The Evolution of Sports Science', subtitle: 'A Historical Overview' },
      { id: 'ch2', title: 'Chapter 2: The Giants of Human Performance', subtitle: 'Academic Pioneers & Modern Proponents' },
      { id: 'ch3', title: 'Chapter 3: Why Science-Based Lifting is Superior', subtitle: 'From Anecdote to First Principles' },
      { id: 'ch4', title: 'Chapter 4: The Mechanics of Optimal Gains', subtitle: 'Perfecting Physical Execution' },
      { id: 'conclusion', title: 'Conclusion: What the App Does, and What It Does Not', subtitle: 'WorkoutVision’s Core Ethos' },
    ],

    chapter1: {
      number: 'Chapter 1',
      title: 'The Evolution of Sports Science: A Historical Overview',
      intro: 'Human movement has always been studied, but the systematic quantification of exercise is a remarkably recent development.',
      sections: [
        {
          title: 'The Era of Energetics (Late 19th to Mid 20th Century)',
          text: 'The roots of modern exercise science trace back to respiratory physiology and muscle energetics. Before resistance training entered academia, researchers sought to understand the thermodynamic limits of the human engine.',
          figures: [
            {
              name: 'Archibald Vivian Hill (A.V. Hill)',
              dates: '1886–1977',
              role: 'Nobel Laureate in Physiology or Medicine (1922)',
              desc: 'British physiologist who discovered the fundamental relationship between muscle heat production and mechanical work. Hill introduced the foundational concepts of oxygen debt and maximal oxygen uptake (VO₂ max), establishing that physical exertion could be quantified with thermodynamic laws.',
              formula: 'W = \\int F \\cdot ds \\quad \\text{and} \\quad \\eta = \\frac{W}{E_{\\text{chem}}} \\approx 20\\text{--}25\\%',
              formulaNote: 'Hill demonstrated that muscle efficiency obeys strict thermodynamic conversion limits, transforming chemical energy into mechanical force.',
            },
            {
              name: 'Per-Olof Åstrand',
              dates: '1922–2015',
              role: 'Pioneer of Work Physiology (Karolinska Institute)',
              desc: 'Swedish physiologist who mapped out human physical working capacity and aerobic endurance. Åstrand developed standardized submaximal and maximal testing nomograms that remain clinical benchmarks today, establishing normative physiological baselines across sex and age.',
            },
            {
              name: 'Karlman Wasserman',
              dates: '1927–2020',
              role: 'Father of Cardiopulmonary Exercise Testing (CPET)',
              desc: 'Revolutionized clinical and exercise physiology in the 1960s by introducing Cardiopulmonary Exercise Testing (CPET). Wasserman enabled scientists to analyze gas exchange breath-by-breath during maximal exertion, unlocking the anaerobic threshold and gas exchange ratio (RER).',
            },
          ],
        },
        {
          title: 'The Epidemiological Shift (Late 20th Century)',
          text: 'As infectious diseases declined in developed nations, researchers turned their attention to chronic illness, cardiovascular disease, and metabolic dysfunction.',
          figures: [
            {
              name: 'Steven N. Blair',
              dates: '1939–2023',
              role: 'Lead Investigator, Aerobics Center Longitudinal Study (ACLS)',
              desc: 'Through the Aerobics Center Longitudinal Study, Blair showed that cardiorespiratory fitness is strongly associated with lower all-cause mortality, independently of other risk factors (Blair et al., JAMA 1989), and later muscular strength too (Ruiz et al., BMJ 2008). Exercise moved from an optional athletic pursuit to a pillar of preventive medicine.',
            },
          ],
        },
      ],
    },

    chapter2: {
      number: 'Chapter 2',
      title: 'The Giants of Human Performance & Muscle Science',
      intro: 'In the 21st century, exercise science expanded past endurance physiology into resistance training, skeletal muscle hypertrophy, and neuromuscular adaptation. Two distinct groups drive this modern renaissance: academic researchers running randomized controlled trials, and evidence-based educators translating data into actionable gym frameworks.',
      subsections: [
        {
          heading: 'The Academic Pioneers',
          leaders: [
            {
              name: 'Dr. Brad Schoenfeld',
              affiliation: 'Lehman College, CUNY',
              specialty: 'Mechanisms of Muscle Hypertrophy',
              summary: 'Widely regarded as the leading global authority on hypertrophy. His landmark meta-analyses and laboratory studies have systematically dissected how training volume, frequency, proximity to failure (RIR), and exercise selection dictate skeletal muscle remodeling.',
            },
            {
              name: 'Dr. Stuart Phillips',
              affiliation: 'McMaster University',
              specialty: 'Muscle Protein Synthesis (MPS) & Protein Kinetics',
              summary: 'Phillips’ research centers on skeletal muscle protein synthesis, amino acid metabolism (fractional synthetic rate), and how dietary protein synergizes with mechanical tension across the human lifespan to combat sarcopenia and drive adaptation.',
            },
            {
              name: 'Dr. Layne Norton',
              affiliation: 'PhD, Nutritional Sciences (University of Illinois)',
              specialty: 'mTOR Signaling & Energy Balance',
              summary: 'Bridged the gap between cellular leucine sensing (mTORC1 activation) and practical nutritional programming, debunking dogmatic bro-science in favor of strict thermodynamic balance and evidence-based dietary adherence.',
            },
          ],
        },
        {
          heading: 'The Proponents of Science-Based Lifting',
          leaders: [
            {
              name: 'Dr. Mike Israetel',
              affiliation: 'Renaissance Periodization (RP)',
              specialty: 'Volume Landmarks & Fatigue Architecture',
              summary: 'Combined a PhD in sport physiology with accessible, rigorous algorithmic frameworks for volume landmarks (Minimum Effective Volume [MEV], Maximum Adaptive Volume [MAV], Maximum Recoverable Volume [MRV]) and systemic fatigue management.',
            },
            {
              name: 'Greg Nuckols',
              affiliation: 'Stronger by Science (SBS)',
              specialty: 'Statistical Rigor & Powerlifting Biomechanics',
              summary: 'Celebrated for parsing complex statistical meta-regressions and turning peer-reviewed sports literature into nuanced, highly actionable guides for strength athletes and coaches.',
            },
            {
              name: 'Menno Henselmans & Chris Beardsley',
              affiliation: 'Independent Biomechanics Researchers',
              specialty: 'Internal Moment Arms & Active Insufficiency',
              summary: 'Popularized biomechanical optimization, focusing heavily on internal joint moment arms, sarcomere length-tension curves, active/passive insufficiency, and stretch-mediated hypertrophy.',
            },
          ],
        },
      ],
    },

    chapter3: {
      number: 'Chapter 3',
      title: 'Why Science-Based Lifting is Superior',
      intro: 'Old-school bodybuilding relied on the "feel" of a pump, arbitrary traditions, and the authority of genetic outliers. While champions possess immense work ethic, genetics often allowed them to succeed in spite of their programming, not because of it.',
      principles: [
        {
          title: '1. Efficiency of Stimulus-to-Fatigue Ratio (SFR)',
          desc: 'Every exercise carries a systemic, neural, and connective tissue cost. Science-based lifting seeks movements and ranges of motion that maximize mechanical tension on the target muscle fibers while minimizing spinal loading, joint friction, and central nervous system depletion.',
          formula: '\\text{SFR} = \\frac{\\text{High-Threshold Motor Unit Recruitment} \\times \\text{Active Mechanical Tension}}{\\text{Axial Loading} + \\text{Joint Shear Force} + \\text{CNS Fatigue}}',
          // The injury claim is withdrawn (honesty audit of 14 October 2026: no source, and the app measures none of it, R9).
          highlight: 'A way of thinking when choosing exercises, not a measured number. The app does not compute it.',
        },
        {
          title: '2. Mechanical Tension as the Primary Driver',
          desc: 'Cell biology and human studies indicate that mechanical tension, the elongation and contraction of muscle fibers under load acting on costameres and focal adhesions, is the primary catalyst for myofibrillar hypertrophy. Metabolic stress ("the burn") and muscle damage are secondary byproducts, not primary drivers.',
          highlight: 'Chasing pure fatigue or soreness is a sub-optimal proxy for mechanical tension.',
        },
        {
          title: '3. Individualized Biomechanics over Dogma',
          desc: 'Anatomy dictates mechanics. A "one-size-fits-all" squat stance or bench press path ignores profound human skeletal variation: acetabular depth, femoral neck angle, clavicle-to-torso width, and limb-to-torso ratios. Science teaches us to match exercise execution to individual bone geometry and internal moment arms.',
          highlight: 'If an exercise causes articular pain rather than target muscle burn, the line of pull disagrees with your anatomy.',
        },
        {
          title: '4. Bilateral Symmetry & Musculoskeletal Equilibrium',
          // The injury and tendinopathy claims and the 10 % / 15 % rule are withdrawn (honesty audit of 14 October 2026: no
          // source or status, R9; a care conclusion the app may not draw, sides-line.js, R8).
          desc: 'Human movement rarely operates in perfect geometric parity: one side often moves through a little more range than the other. How large a gap matters, and what to do about it, is for a coach or a physiotherapist who sees you to judge.',
          // The gap as the app computes it (sides-line.js, counting/symmetry.ts): relative to the mean of the two ranges, not
          // to the larger (honesty pass, second round, 14 October 2026).
          formula: '\\text{Left-right gap} = \\frac{|\\text{ROM}_{\\text{left}} - \\text{ROM}_{\\text{right}}|}{(\\text{ROM}_{\\text{left}} + \\text{ROM}_{\\text{right}}) / 2} \\times 100\\%',
          highlight: 'The app compares left and right only on a lateral raise filmed from the front, and gives both ranges without judging the gap.',
        },
      ],
    },

    chapter4: {
      number: 'Chapter 4',
      title: 'The Mechanics of Optimal Gains: Perfecting Execution',
      intro: 'To maximize hypertrophic adaptation, an exercise must be executed with uncompromising fidelity to fundamental Newtonian physics and joint kinetics. Here is how modern sports science dictates surgical execution across movement profiles:',
      rules: [
        {
          num: '01',
          name: 'The Principle of Length-Tension Relationships & Stretch-Mediated Hypertrophy',
          body: 'Sarcomeres produce high active tension and stimulate titin-mediated passive tension when challenged at long muscle lengths (the deep stretched position). Cutting the range of motion eliminates the most hypertrophic portion of the repetition.',
          application: 'Never cut repetitions short at the turnaround. For a Bicep Curl, the bottom position (full elbow extension) provides superior stretch-mediated signaling. For a Lateral Raise, match the resistance profile to the shoulder’s strength curve so peak resistance aligns with active abduction.',
          liftKey: 'bicep_curl',
          liftLabel: 'Film a biceps curl',
        },
        {
          num: '02',
          name: 'Eliminating Momentum (Inertial Leakage)',
          body: 'When a lifter bounces out of the hole or uses body English, they inject kinetic energy into the system. This produces a sudden spike in joint shear force while unloading the target muscle during the critical mid-range inflection point.',
          // literature: Schoenfeld, Ogborn and Krieger 2015, Sports Med 45(4):577-585 (repetition duration and hypertrophy). The
          // "2 to 3 seconds" rule is withdrawn (set-notes.js, source 3); it stays only as one option. French awaiting David's approval (R10).
          application: 'Every repetition must begin from a controlled state or deliberate directional reversal. Controlling the lowering phase is one option: a meta-analysis found similar muscle growth for repetitions lasting 0.5 to 8 seconds (Schoenfeld et al. 2015).',
          liftKey: 'squat',
          liftLabel: 'Film a squat',
        },
        {
          num: '03',
          name: 'Joint Alignment and Line of Pull',
          body: 'External resistance must act directly opposite to the muscle fibers’ architectural orientation. When joint motion deviates from the fascicle plane, rotational shear is transferred into ligaments and non-target synergists.',
          application: 'On a Lat Pulldown, the humerus must track precisely in the plane of the latissimus dorsi fibers: pulling elbows down and slightly inward toward the front pockets, rather than flaring wide like an upper-back row.',
          liftKey: 'lat_pulldown',
          liftLabel: 'Film a lat pulldown',
        },
      ],
    },

    conclusion: {
      title: 'Conclusion: What the App Does, and What It Does Not',
      // The promise the app keeps (honesty audit of 14 October 2026, CORE-14), with the dated scoreboard (R13:
      // test/real-phone/accuracy/scoreboard.txt; honesty-guard.test.js checks the figures).
      text1: 'WorkoutVision counts your reps, shows you what it saw and asks you to confirm. When it is unsure, it says so: at most it suggests a number for you to check, never a grade. On the 16 real videos filmed by the app’s maker, it finds the right number on 9 (scoreboard of 25 October 2026). That is why it always asks you to confirm.',
      text2: 'By combining the rigour of exercise physiology with an analysis made on your phone, the app helps you keep track of your sets, without claiming to measure what it cannot.',
      creed: 'Lift with intent. Train with data. Trust the science.',
    },

    cta: {
      startFilming: 'Put Theory into Practice: Choose an Exercise',
      back: 'Back to Dashboard',
    },
  },

  fr: {
    badge: 'Traité pédagogique et bases scientifiques',
    title: 'Le Manifeste WorkoutVision',
    subtitle: 'La science, l’histoire et la mécanique de la musculation optimale',
    readTime: '8 min de lecture',
    lead: 'Bienvenue sur WorkoutVision. Vous avez sous les yeux un guide qui relie la physiologie universitaire au plateau de musculation.',
    introP1: 'Pendant des décennies, le monde du fitness a été régi par des traditions dogmatiques, des récits anecdotiques et des croyances empiriques sans vérification. Aujourd’hui, nous sommes entrés dans l’ère de la musculation scientifique, une discipline fondée sur la biomécanique, la synthèse des protéines musculaires, la physique et les données probantes.',
    introP2: 'Ce guide retrace l’histoire des sciences du sport, les pionniers qui ont bâti cette discipline, pourquoi l’entraînement fondé sur les preuves surpasse les méthodes traditionnelles, et comment exécuter chaque mouvement avec une rigueur chirurgicale.',

    tocTitle: 'Sommaire',
    chapters: [
      { id: 'ch1', title: 'Chapitre 1\u00A0: L’évolution des sciences du sport', subtitle: 'Un aperçu historique' },
      { id: 'ch2', title: 'Chapitre 2\u00A0: Les géants de la performance humaine', subtitle: 'Pionniers universitaires et pédagogues d’aujourd’hui' },
      { id: 'ch3', title: 'Chapitre 3\u00A0: Pourquoi la musculation scientifique l’emporte sur le dogme', subtitle: 'Des anecdotes aux premiers principes' },
      { id: 'ch4', title: 'Chapitre 4\u00A0: La mécanique des gains optimaux', subtitle: 'Perfectionner l’exécution' },
      { id: 'conclusion', title: 'Conclusion\u00A0: ce que fait l’appli, et ce qu’elle ne fait pas', subtitle: 'L’éthique WorkoutVision' },
    ],

    chapter1: {
      number: 'Chapitre 1',
      title: 'L’évolution des sciences du sport\u00A0: un aperçu historique',
      intro: 'Le mouvement humain a toujours fasciné, mais la quantification systématique de l’exercice physique est une conquête scientifique remarquablement récente.',
      sections: [
        {
          title: 'L’ère de l’énergétique (de la fin du XIXe siècle au milieu du XXe)',
          text: 'Les racines de la science moderne de l’exercice trouvent leur origine dans la physiologie respiratoire et la thermodynamique musculaire. Avant que la musculation n’entre à l’université, les chercheurs ont d’abord mesuré les limites énergétiques du corps humain.',
          figures: [
            {
              name: 'Archibald Vivian Hill (A.V. Hill)',
              dates: '1886–1977',
              role: 'Prix Nobel de physiologie ou médecine (1922)',
              desc: 'Physiologiste britannique récompensé pour sa découverte relative à la production de chaleur dans le muscle. Hill a introduit les concepts de dette d’oxygène et de consommation maximale d’oxygène (VO₂ max), établissant que l’effort physique obéit aux lois de la thermodynamique.',
              formula: 'W = \\int F \\cdot ds \\quad \\text{et} \\quad \\eta = \\frac{W}{E_{\\text{chim}}} \\approx 20\\text{--}25\\%',
              formulaNote: 'Hill a démontré le rendement thermodynamique strict du muscle squelettique, transformant l’énergie chimique en travail mécanique.',
            },
            {
              name: 'Per-Olof Åstrand',
              dates: '1922–2015',
              role: 'Pionnier de la physiologie du travail (Institut Karolinska)',
              desc: 'Physiologiste suédois ayant cartographié la capacité de travail physique et l’endurance aérobie. Åstrand a créé des nomogrammes standardisés qui restent aujourd’hui des références cliniques incontournables pour étalonner la condition physique selon le sexe et l’âge.',
            },
            {
              name: 'Karlman Wasserman',
              dates: '1927–2020',
              role: 'Père de l’épreuve d’effort cardiorespiratoire (CPET)',
              desc: 'A révolutionné la physiologie clinique dans les années 1960 en introduisant l’évaluation cardio-pulmonaire souffle par souffle. Wasserman a permis de mesurer les échanges gazeux en temps réel, ouvrant la voie à la détection précise du seuil anaérobie.',
            },
          ],
        },
        {
          title: 'Le tournant épidémiologique (fin du XXe siècle)',
          text: 'Face au recul des maladies infectieuses, la recherche s’est tournée vers les pathologies chroniques, le métabolisme et le mode de vie.',
          figures: [
            {
              name: 'Steven N. Blair',
              dates: '1939–2023',
              role: 'Chercheur principal, Aerobics Center Longitudinal Study (ACLS)',
              desc: 'Avec l’étude ACLS, Blair a montré que la capacité cardiorespiratoire est fortement associée à une mortalité plus faible, indépendamment des autres facteurs de risque (Blair et al., JAMA 1989), puis la force musculaire aussi (Ruiz et al., BMJ 2008). L’exercice physique est ainsi devenu un pilier de la médecine préventive.',
            },
          ],
        },
      ],
    },

    chapter2: {
      number: 'Chapitre 2',
      title: 'Les géants de la performance humaine et de l’hypertrophie',
      intro: 'Au XXIe siècle, la science de l’exercice s’est déployée au-delà de l’endurance pour conquérir la résistance musculaire, l’hypertrophie et l’adaptation neuromusculaire. Deux forces complémentaires animent cette renaissance\u00A0: les chercheurs universitaires menant des essais randomisés, et les pédagogues qui traduisent ces données en protocoles concrets sur le plateau de musculation.',
      subsections: [
        {
          heading: 'Les pionniers universitaires',
          leaders: [
            {
              name: 'Dr. Brad Schoenfeld',
              affiliation: 'Lehman College, CUNY',
              specialty: 'Mécanismes de l’hypertrophie musculaire',
              summary: 'Considéré mondialement comme la figure de proue de la recherche sur l’hypertrophie. Ses méta-analyses et études cliniques ont rigoureusement analysé l’impact du volume, de la fréquence, de la proximité de l’échec (RIR) et du choix des exercices sur la croissance musculaire.',
            },
            {
              name: 'Dr. Stuart Phillips',
              affiliation: 'Université McMaster',
              specialty: 'Synthèse des protéines musculaires (MPS)',
              summary: 'Ses travaux explorent le métabolisme des acides aminés et la manière dont la tension mécanique interagit avec les apports protéiques à tout âge pour stimuler la régénération musculaire et prévenir la sarcopénie.',
            },
            {
              name: 'Dr. Layne Norton',
              affiliation: 'Docteur en sciences de la nutrition',
              specialty: 'Signalisation mTOR et équilibre énergétique',
              summary: 'A fait le lien entre la biologie moléculaire de la leucine (activation de la voie mTOR) et la diététique flexible, démontant les mythes infondés au profit de la thermodynamique et de la cohérence métabolique.',
            },
          ],
        },
        {
          heading: 'Les défenseurs d’une musculation fondée sur les données',
          leaders: [
            {
              name: 'Dr. Mike Israetel',
              affiliation: 'Renaissance Periodization (RP)',
              specialty: 'Repères de volume et gestion de la fatigue',
              summary: 'A combiné son doctorat en physiologie sportive avec une méthodologie algorithmique claire\u00A0: volume minimal efficace (MEV), volume adaptatif maximal (MAV) et le rapport stimulus/fatigue (SFR).', // SFR: stimulus-to-fatigue ratio (second review, 14 October 2026); French awaiting David's approval (R10)
            },
            {
              name: 'Greg Nuckols',
              affiliation: 'Stronger by Science (SBS)',
              specialty: 'Rigueur statistique et force athlétique',
              summary: 'Célèbre pour son analyse critique des méta-analyses complexes, transformant des articles scientifiques denses en guides applicables pour athlètes de force et entraîneurs.',
            },
            {
              name: 'Menno Henselmans & Chris Beardsley',
              affiliation: 'Chercheurs indépendants en biomécanique',
              specialty: 'Bras de levier et hypertrophie en étirement',
              summary: 'Ont popularisé l’optimisation biomécanique en insistant sur les moments articulaires internes, les courbes tension-longueur des sarcomères et l’hypertrophie médiée par l’étirement sous charge.',
            },
          ],
        },
      ],
    },

    chapter3: {
      number: 'Chapitre 3',
      title: 'Pourquoi la musculation scientifique l’emporte sur le dogme',
      intro: 'L’entraînement à l’ancienne reposait sur le ressenti de la congestion, les recettes transmises par tradition et l’admiration aveugle des champions. Si ces athlètes étaient des travailleurs acharnés, leur génétique leur permettait souvent de progresser malgré leur programmation, et non grâce à elle.',
      principles: [
        {
          title: '1. L’efficience du rapport stimulus/fatigue (SFR)',
          desc: 'Chaque exercice engendre un coût systémique, articulaire et neural. L’approche scientifique sélectionne les mouvements et amplitudes qui maximisent la tension mécanique sur les fibres cibles tout en minimisant la charge axiale sur le rachis et l’usure tendineuse.',
          formula: '\\text{SFR} = \\frac{\\text{Recrutement des Unités Motrices} \\times \\text{Tension Mécanique Active}}{\\text{Charge Axiale} + \\text{Frottement Articulaire} + \\text{Fatigue SNC}}',
          // Awaiting David's approval (R10), as the whole page.
          highlight: 'Une façon de choisir ses exercices, pas un chiffre mesuré. L’appli ne le calcule pas.',
        },
        {
          title: '2. La tension mécanique, moteur principal',
          desc: 'La biologie cellulaire et les études chez l’humain indiquent que la tension mécanique (l’étirement et la contraction sous charge captés par les mécanorécepteurs des costamères) est le stimulus primaire de l’hypertrophie. Le stress métabolique («\u00A0la brûlure\u00A0») et les courbatures ne sont que des sous-produits secondaires.',
          highlight: 'Rechercher la fatigue pure ou la douleur aiguë n’est pas un indicateur de croissance musculaire.',
        },
        {
          title: '3. Une biomécanique individuelle plutôt qu’une recette unique',
          desc: 'L’anatomie dicte la mécanique. Un écartement de pieds imposé au squat ou une prise fixe au développé couché ignorent les variations squelettiques majeures\u00A0: profondeur du cotyle, angle du col fémoral, largeur claviculaire. La science enseigne d’adapter l’exercice à la structure osseuse et aux bras de levier de chaque individu.',
          highlight: 'Si un mouvement génère une douleur articulaire au lieu d’une tension musculaire, la trajectoire est en conflit avec votre squelette.',
        },
        {
          title: '4. La symétrie bilatérale et l’équilibre musculosquelettique',
          desc: 'Le corps fonctionne rarement de façon parfaitement symétrique\u00A0: un côté bouge souvent sur une amplitude un peu plus grande que l’autre. À partir de quel écart il faut s’en occuper, et comment, c’est à un coach ou à un kiné qui vous voit d’en juger.',
          formula: '\\text{Écart gauche-droite} = \\frac{|\\text{ROM}_{\\text{gauche}} - \\text{ROM}_{\\text{droite}}|}{(\\text{ROM}_{\\text{gauche}} + \\text{ROM}_{\\text{droite}}) / 2} \\times 100\\%',
          highlight: 'L’appli ne compare la gauche et la droite que sur une élévation latérale filmée de face, et donne les deux amplitudes sans juger l’écart.',
        },
      ],
    },

    chapter4: {
      number: 'Chapitre 4',
      title: 'La mécanique des gains optimaux\u00A0: l’exécution parfaite',
      intro: 'Pour maximiser les gains musculaires, chaque exercice doit être exécuté dans le respect absolu des lois de Newton et de la cinématique articulaire. Voici les règles d’or dictées par la science du sport\u00A0:',
      rules: [
        {
          num: '01',
          name: 'La relation tension-longueur et l’hypertrophie en étirement',
          body: 'Les sarcomères produisent une tension active maximale et recrutent la titine (tension passive) lorsqu’ils sont sollicités en position allongée (étirement sous charge). Réduire l’amplitude revient à supprimer la portion la plus anabolique de la répétition.',
          application: 'Ne tronquez jamais le bas du mouvement. Au curl biceps, l’extension complète du coude active l’hypertrophie en étirement. Aux élévations latérales, alignez la courbe de résistance avec le profil de force de l’épaule.',
          liftKey: 'bicep_curl',
          liftLabel: 'Filmer un curl biceps',
        },
        {
          num: '02',
          name: 'Supprimer l’élan (fuite inertielle)',
          body: 'Lorsqu’un pratiquant rebondit en bas ou utilise un balancement du buste, il injecte de l’énergie cinétique balistique. Cela décharge le muscle cible précisément au moment où la tension est la plus stimulante, tout en surchargeant les cartilages.',
          // literature: Schoenfeld, Ogborn and Krieger 2015, Sports Med 45(4):577-585 (repetition duration and hypertrophy). The bare
          // "2 to 3 seconds" rule is withdrawn (set-notes.js, source 3); it stays only as one option. French awaiting David's approval (R10).
          application: 'Chaque répétition doit démarrer d’un point fixe sans impulsion parasite. Contrôler la descente est une option\u00A0: une méta-analyse a trouvé une prise de muscle comparable pour des répétitions de 0,5 à 8 secondes (Schoenfeld et al. 2015).',
          liftKey: 'squat',
          liftLabel: 'Filmer un squat',
        },
        {
          num: '03',
          name: 'Alignement articulaire et ligne de tirage',
          body: 'La résistance doit s’opposer directement au plan anatomique des faisceaux musculaires cibles. Tout désalignement disperse les forces sous forme de cisaillement articulaire.',
          application: 'Au tirage vertical, l’humérus doit se déplacer exactement dans le plan des fibres du grand dorsal\u00A0: coudes tirés vers le bas et légèrement vers les poches, et non écartés vers l’arrière.',
          liftKey: 'lat_pulldown',
          liftLabel: 'Filmer un tirage vertical',
        },
      ],
    },

    conclusion: {
      // The promise the app keeps (honesty pass, second round, 14 October 2026): when it doubts it may propose a number to
      // check, never a grade (Result.jsx), so "elle ne donne pas de chiffre" was untrue; a public reader does not know
      // David, so the videos are the app's maker's. Awaiting David's approval (R10), with the rest of the page.
      title: 'Conclusion\u00A0: ce que fait l’appli, et ce qu’elle ne fait pas',
      text1: 'L’appli compte vos répétitions, vous montre ce qu’elle a vu et vous demande de confirmer. Quand elle doute, elle le dit\u00A0: tout au plus, elle vous propose un nombre à vérifier, jamais une note. Sur les 16 vraies vidéos filmées par le créateur de l’appli, elle trouve le bon nombre sur 9 (tableau du 25 octobre 2026). C’est pour ça qu’elle vous demande toujours de confirmer.',
      text2: 'En alliant la rigueur de la physiologie de l’exercice à une analyse faite sur votre téléphone, l’appli vous aide à suivre vos séries, sans prétendre mesurer ce qu’elle ne sait pas mesurer.',
      creed: 'Bougez avec intention. Entraînez-vous avec des données. Faites confiance à la science.',
    },

    cta: {
      startFilming: 'De la théorie à la pratique\u00A0: choisir un mouvement',
      back: 'Retour à l’accueil',
    },
  },
};

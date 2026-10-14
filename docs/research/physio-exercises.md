# Physiotherapy Movement Reference: 40 Core Rehabilitation Exercises

## Clinical Governance and Regulatory Scope
This document provides biomechanical specifications, kinematics, camera positioning guidelines, and repetition boundary criteria for the 40 most commonly prescribed rehabilitation and physical therapy exercises across five anatomical regions: Shoulder, Knee, Hip, Lower Back, and Neck.

> **Scope & Non-Medical Notice:**
> This reference compiles biomechanical and movement parameter standards from published clinical protocols (NHS Foundation Trusts, Haute Autorité de Santé (HAS), American Physical Therapy Association (APTA) Clinical Practice Guidelines, and Cochrane Musculoskeletal Systematic Reviews). It contains strictly factual kinematic definitions intended for automated computer-vision rep-counting and form validation algorithms. It does not constitute medical advice, diagnosis, or personalized treatment prescription.

---

## Anatomical Joint Landmark Convention (MediaPipe Blazepose)
All rep boundaries and angle definitions refer to standard 3D pose landmarks:
- **Head & Spine:** `NOSE (0)`, `LEFT_EAR (7)`, `RIGHT_EAR (8)`, `MOUTH (9/10)`, Mid-shoulder virtual center, Mid-hip virtual center.
- **Upper Extremity:** `LEFT_SHOULDER (11)`, `RIGHT_SHOULDER (12)`, `LEFT_ELBOW (13)`, `RIGHT_ELBOW (14)`, `LEFT_WRIST (15)`, `RIGHT_WRIST (16)`, `LEFT_INDEX (19)`, `RIGHT_INDEX (20)`.
- **Lower Extremity:** `LEFT_HIP (23)`, `RIGHT_HIP (24)`, `LEFT_KNEE (25)`, `RIGHT_KNEE (26)`, `LEFT_ANKLE (27)`, `RIGHT_ANKLE (28)`, `LEFT_HEEL (29)`, `RIGHT_HEEL (30)`, `LEFT_FOOT_INDEX (31)`, `RIGHT_FOOT_INDEX (32)`.

---

## Section 1: Shoulder Rehabilitation (8 Exercises)

### 1.1 Pendulum (Codman's) Exercise
- **Primary Target:** Glenohumeral joint passive mobilization, capsular release without deltoid activation.
- **Starting Position:** Athlete standing in forward trunk flexion (~45–60°), non-involved forearm resting on table or chair for trunk support. Involved arm hangs completely vertical under gravity.
- **Movement:** Gentle circular oscillation or sagittal swing initiated entirely by subtle body weight shifts (legs/torso); the hanging arm remains passive.
- **Prescription (Literature):** 2–3 sets of 30–60 seconds continuous oscillation; low cadence (~0.5–1.0 Hz).
- **Variants:** Small clockwise circles, counter-clockwise circles, anterior-posterior pendular swing.
- **Camera Placement:** Lateral sagittal view (side profile, 90° to torso flexion) or 45° front-quarter. Phone height: 60–80 cm (knee-to-hip height on stable floor stand).
- **Repetition Boundary Criteria:**
  - *Full Repetition (or Oscillation Cycle):* 360° circular orbit of wrist around shoulder vertical projection, radius between 10 cm and 30 cm, with deltoid EMG proxy (shoulder elevation velocity delta < 0.15 m/s²).
  - *Partial Repetition:* Small diameter orbit (< 10 cm) or abrupt reversal before completing 360°.
  - *Form Fault / Rejection:* Active arm muscle contraction detected (elbow flexion angle deviates > 15° from 180° full extension; active shoulder elevation lifting arm forward).

### 1.2 External Rotation with Elastic Band
- **Primary Target:** Infraspinatus, teres minor (posterior rotator cuff).
- **Starting Position:** Standing or seated tall, spine neutral. Elbow flexed to exactly 90°, humerus adducted firmly against lateral ribcage. Resistance band held across abdomen at waistband level.
- **Movement:** Humerus rotates externally, moving forearm outward away from abdominal midline through a horizontal transverse arc, keeping elbow pinned to side. End-range isometric pause (1–2 s), slow eccentric return.
- **Prescription (Literature):** 3 sets of 10–15 reps, tempo 2-1-2 (2 s outward, 1 s hold, 2 s return).
- **Variants:** With towel roll between elbow and lateral thorax to enforce adduction.
- **Camera Placement:** Face-on (coronal view, 0° anterior) at mid-chest height (100–120 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Forearm angle exceeds 45° external rotation relative to sagittal plane while humerus abduction stays < 15°.
  - *Partial Repetition:* Forearm rotates between 20° and 44°.
  - *Form Fault / Rejection:* Elbow abducts outward (> 20° separation from lateral torso) to substitute deltoid; trunk rotates to fake range of motion (> 10° thoracic rotation).

### 1.3 Prone Y Raise (Lower Trapezius)
- **Primary Target:** Lower trapezius activation, scapular upward rotation and posterior tilt.
- **Starting Position:** Prone (lying face down) on mat or flat bench. Arms extended overhead at 135° abduction relative to spine (forming a 'Y' shape), thumbs pointing upward toward ceiling (glenohumeral external rotation).
- **Movement:** Scapulae retract and depress, lifting hands and forearms 5–15 cm off floor. Pause 2–3 seconds at top apex. Lower under control.
- **Prescription (Literature):** 3 sets of 8–12 reps, 2–3 s hold at peak contraction.
- **Variants:** Bilateral simultaneous or unilateral alternating.
- **Camera Placement:** 45° oblique view from head end or overhead side angle, 30–50 cm off floor.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Wrist and elbow lift clear of floor (> 5 cm vertical displacement) with thumbs pointing within 30° of vertical ceiling vector, cervical spine remaining neutral (< 10° hyperextension).
  - *Partial Repetition:* Wrist clears floor by < 5 cm or held < 1.0 s.
  - *Form Fault / Rejection:* Cervical hyperextension (> 25° neck arching); excessive lumbar lordosis substitution (> 15° trunk hyperextension); thumbs rotated inward.

### 1.4 Prone T Raise (Middle Trapezius / Rhomboids)
- **Primary Target:** Middle trapezius, rhomboid major and minor.
- **Starting Position:** Prone on floor or flat bench. Arms abducted to 90° perpendicular to torso (forming a 'T'), thumbs oriented upward toward ceiling.
- **Movement:** Retract scapulae toward midline, lifting arms horizontally off floor into horizontal abduction. Hold 2 s, return smoothly.
- **Prescription (Literature):** 3 sets of 10–12 reps, tempo 2-2-2.
- **Variants:** Bodyweight only progressing to light micro-weights (0.5–1 kg).
- **Camera Placement:** Perpendicular lateral or 45° overhead floor view, height 40 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Hands lift >= 8 cm above support plane; scapular adduction visibly initiates movement.
  - *Partial Repetition:* Hand lift between 3 and 7 cm.
  - *Form Fault / Rejection:* Upper trapezius shrugging (shoulders pulled toward ears, shoulder-ear distance reduces by > 20%); elbow flexion > 20°.

### 1.5 Scaption (Scapular Plane Elevation)
- **Primary Target:** Supraspinatus, anterior and middle deltoid, serratus anterior in scapular plane.
- **Starting Position:** Standing upright, feet shoulder-width, arms at sides holding light dumbbell or resistance band. Thumbs facing forward-upward (~30° anterior to frontal plane).
- **Movement:** Raise arms along the scapular plane (30–40° forward of the coronal plane) up to shoulder level (90–100° humeral elevation), pause 1 s, lower slowly.
- **Prescription (Literature):** 3 sets of 10–12 reps, tempo 2-1-2.
- **Variants:** Dumbbell vs elastic tubing; seated vs standing.
- **Camera Placement:** 45° anterior-lateral view or direct frontal view, camera at shoulder height (120–140 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Humeral elevation reaches 80°–100° in scapular plane (azimuth 30–45° from frontal).
  - *Partial Repetition:* Humeral elevation reaches only 50°–79°.
  - *Form Fault / Rejection:* Elevation > 110° causing subacromial impingement; excessive scapular hiking/shrugging (clavicular elevation > 15°); trunk leaning backward (> 10° lumbar extension).

### 1.6 Wall Slide with Serratus Activation
- **Primary Target:** Serratus anterior, scapular upward rotation.
- **Starting Position:** Standing facing wall, feet 15–20 cm from wall. Ulnar border of forearms resting flat against wall, elbows flexed 90° at shoulder height.
- **Movement:** Slide forearms upward along the wall into full overhead reach (135–150° elevation), maintaining continuous forearm contact and protracting scapulae at top of stroke.
- **Prescription (Literature):** 3 sets of 8–10 reps, tempo 3-1-3.
- **Variants:** With elastic resistance band looped around wrists; foam roller under forearms.
- **Camera Placement:** 45° posterolateral view, height 100 cm, 2–3 m distance.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Elbows ascend from 90° elevation to >= 135° elevation without loss of wall contact.
  - *Partial Repetition:* Elbow elevation reaches 110°–134°.
  - *Form Fault / Rejection:* Lumbar hyperextension (arching lower back to fake reach, anterior pelvic tilt > 15°); forearms separating or peeling off wall.

### 1.7 Sleeper Stretch (Internal Rotation)
- **Primary Target:** Posterior glenohumeral capsule, infraspinatus/teres minor passive extensibility.
- **Starting Position:** Side-lying directly on involved shoulder, torso rolled 15–20° backward. Involved shoulder flexed 90°, elbow flexed 90°, forearm vertical pointing toward ceiling.
- **Movement:** Opposite hand gently applies downward overpressure at involved wrist, rotating forearm toward floor into internal rotation until gentle stretch felt. Hold statically.
- **Prescription (Literature):** 3–4 repetitions of 30-second sustained holds.
- **Variants:** Towel roll under head and arm for comfort.
- **Camera Placement:** Lateral view perpendicular to patient's chest or oblique head-end view, height 40 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Internal rotation angle held stable (+/- 5°) for continuous duration >= 25 seconds.
  - *Partial Repetition:* Hold released between 10 and 24 seconds.
  - *Form Fault / Rejection:* Shoulder hiking upward into neck or anterior shoulder lifting off mat (> 25° anterior humeral roll).

### 1.8 Serratus Punch (Supine Scapular Protraction)
- **Primary Target:** Isolated serratus anterior protraction.
- **Starting Position:** Supine on mat, knees flexed 90°, feet flat. Involved arm extended vertically toward ceiling (90° shoulder flexion, elbow locked straight at 180°).
- **Movement:** Push fist vertically toward ceiling by protracting scapula off mat (2–5 cm anterior translation) without bending elbow. Hold 1 s, retract scapula smoothly back to mat.
- **Prescription (Literature):** 3 sets of 12–15 reps, tempo 1-1-2.
- **Variants:** Bodyweight fist, holding dumbbell (1–3 kg), or elastic band anchored beneath back.
- **Camera Placement:** Lateral horizontal view (level with mat, height 30–40 cm) or 45° side profile.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Vertical displacement of wrist landmark >= 4 cm, elbow angle maintained >= 170° throughout.
  - *Partial Repetition:* Vertical displacement between 2.0 and 3.9 cm.
  - *Form Fault / Rejection:* Elbow flexion > 15° (turning movement into a triceps press); torso rotation off mat (> 10° asymmetry between left and right rib cage).

---

## Section 2: Knee Rehabilitation (8 Exercises)

### 2.1 Straight Leg Raise (SLR)
- **Primary Target:** Quadriceps (rectus femoris), hip flexor activation with knee locked in full extension.
- **Starting Position:** Supine on mat. Non-involved leg bent at 90° knee flexion with foot flat on floor. Involved leg extended fully straight on mat, foot dorsiflexed.
- **Movement:** Tighten quadriceps to lock knee into 0° extension; raise entire leg smoothly until thigh is parallel to contralateral flexed knee (~45° hip flexion). Pause 1–2 s, lower slowly without heel slamming.
- **Prescription (Literature):** 3 sets of 10–15 reps, tempo 2-1-2.
- **Variants:** With ankle weights (0.5–2 kg); toes turned slightly outward (vastus medialis bias).
- **Camera Placement:** Lateral profile (sagittal view), phone on floor or 20–30 cm stand, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Leg elevation reaches 35°–50° hip flexion with knee extension angle maintained >= 175° (no knee lag).
  - *Partial Repetition:* Hip flexion reaches 20°–34°.
  - *Form Fault / Rejection:* Quadriceps extension lag (knee flexes > 10° during ascent); pelvis rotates or lumbar spine arches excessively (> 10° lumbar gap change).

### 2.2 Terminal Knee Extension (TKE) with Band
- **Primary Target:** Vastus medialis oblique (VMO), terminal extension motor control.
- **Starting Position:** Standing facing band anchor. Heavy elastic band looped behind popliteal crease of involved knee. Involved knee begins in slight flexion (~25–30°), heel resting on floor, ball of foot planted.
- **Movement:** Contract quadriceps to drive knee backward into full extension (0°), pulling against band tension, while pressing heel firmly into floor. Hold 2 s, return with control to 30° flexion.
- **Prescription (Literature):** 3 sets of 15–20 reps, tempo 1-2-1.
- **Variants:** Standing single-leg vs split stance.
- **Camera Placement:** 90° lateral sagittal view, height 40–50 cm (knee height).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Knee joint angle transitions from 150°–155° (flexion) to >= 178° (full terminal extension) and holds >= 1.5 s.
  - *Partial Repetition:* Extension achieves 168°–177°.
  - *Form Fault / Rejection:* Trunk leans forward or backward to cheat band tension; knee hyperextends into genu recurvatum (> 185°); heel lifts off floor.

### 2.3 Quad Set (Isometric Quadriceps Contraction)
- **Primary Target:** Quadriceps isometric recruitment, patellar gliding.
- **Starting Position:** Long sitting or supine on firm mat, involved leg extended straight. Small rolled hand towel placed beneath knee or ankle.
- **Movement:** Firmly contract quadriceps, driving back of knee downward into towel/mat, drawing patella superiorly, dorsiflexing ankle. Hold maximally for 5–10 seconds, then completely relax.
- **Prescription (Literature):** 3 sets of 10 repetitions, each held for 6–10 seconds.
- **Variants:** With biofeedback or electrical stimulation.
- **Camera Placement:** 45° anterior-lateral view, camera height 30 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Isometric Hold):* Superior patellar displacement proxy (ankle dorsiflexion + sustained knee extension >= 178°) maintained continuously for >= 5.0 s.
  - *Partial Repetition:* Sustained contraction between 2.0 and 4.9 s.
  - *Form Fault / Rejection:* Gluteal squeezing compensating for quad contraction; contraction held < 2 s.

### 2.4 Prone / Standing Hamstring Curl
- **Primary Target:** Hamstrings (biceps femoris, semitendinosus, semimembranosus).
- **Starting Position:** Prone on mat with legs fully extended, feet in neutral position (or standing upright holding wall).
- **Movement:** Bend involved knee, drawing heel toward gluteals through full comfortable range of motion (>= 90° flexion). Pause 1 s at peak, lower slowly over 3 seconds.
- **Prescription (Literature):** 3 sets of 10–12 reps, tempo 2-1-3.
- **Variants:** Prone with ankle cuff weight or resistance band; standing hamstring curl.
- **Camera Placement:** Sagittal profile view, camera height 30 cm (prone) or 60 cm (standing).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Knee flexion angle reaches <= 90° (from 180° baseline, an excursion of >= 90°).
  - *Partial Repetition:* Knee flexion reaches 100°–120°.
  - *Form Fault / Rejection:* Anterior pelvic tilt / hip hiking off mat (> 15° hip elevation); opposite knee flexes or thrashes.

### 2.5 Wall Sit (Isometric Squat Hold)
- **Primary Target:** Quadriceps, gluteus maximus isometric endurance, patellofemoral load management.
- **Starting Position:** Back resting flat against smooth wall, feet shoulder-width apart, placed 50–60 cm forward from wall.
- **Movement:** Slide back down wall until thighs are parallel or at prescribed rehab angle (typically 45° to 60° knee flexion initially, progressing to 90°). Maintain spine and head in contact with wall. Hold position.
- **Prescription (Literature):** 3–4 sets of 20–45 second holds.
- **Variants:** Depth modulated by pathology: shallow (30–45°) for patellofemoral syndrome; standard (90°) for late-stage ACL.
- **Camera Placement:** 90° lateral sagittal view, height 60 cm, distance 2.5 m.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Knee joint angle maintained within prescribed target window (e.g., 85°–95° or 45°–60°) for >= 20 continuous seconds.
  - *Partial Repetition:* Hold sustained between 10 and 19 seconds.
  - *Form Fault / Rejection:* Knees caving into dynamic valgus (knee-to-knee separation decreases by > 20%); hands resting on thighs to offload weight; heels lifting.

### 2.6 Heel Slide (Supine Knee Flexion)
- **Primary Target:** Active-assisted knee flexion ROM post-surgery / trauma.
- **Starting Position:** Supine on slick surface or mat, legs extended. Sock or slider sheet under involved heel.
- **Movement:** Slowly slide involved heel along surface toward buttocks, flexing hip and knee concurrently until full available flexion reached. Hold 2 s, slide slowly back to full extension.
- **Prescription (Literature):** 3 sets of 10–15 reps, tempo 3-2-3.
- **Variants:** Using towel/strap looped around foot for gentle active-assisted end-range overpressure.
- **Camera Placement:** Lateral sagittal view, height 30–40 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Knee flexes from full extension (>= 170°) to <= 90° (or patient-specific target), returning to >= 170°.
  - *Partial Repetition:* Flexion reaches between 95° and 120°.
  - *Form Fault / Rejection:* Hip abducts excessively (> 25° outward leg splay) to avoid flexion pain; heel lifts off floor surface.

### 2.7 Step-Up (Low Step)
- **Primary Target:** Quadriceps, gluteus medius, eccentric/concentric patellofemoral control.
- **Starting Position:** Standing facing low aerobic step or box (height 10–15 cm). Feet hip-width apart.
- **Movement:** Place involved foot entirely on step platform. Step up through heel, extending involved hip and knee to reach standing balance on step without pushing off trailing toe. Step down under control.
- **Prescription (Literature):** 3 sets of 10–12 reps per leg, tempo 2-1-2.
- **Variants:** Forward step-up vs lateral step-up.
- **Camera Placement:** Frontal view (coronal) or 45° anterior-lateral view, height 70 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Involved knee achieves full extension (>= 175°) at top of step with contralateral foot clearing floor, followed by controlled descent.
  - *Partial Repetition:* Incomplete knee extension at top (< 165°).
  - *Form Fault / Rejection:* Contralateral foot springs off floor (jumping rather than pressing); dynamic knee valgus (> 10° inward collapse); trunk forward lurch (> 25° trunk flexion).

### 2.8 Short Arc Quad (SAQ / Towel Roll Extension)
- **Primary Target:** Terminal 30° quadriceps extension, vastus medialis isolation.
- **Starting Position:** Supine or semi-reclined on mat. Bolster, foam roller, or rolled towel (diameter 15–20 cm) positioned directly under popliteal fossa of involved knee, flexing knee to ~30–40°.
- **Movement:** Keeping posterior thigh resting firmly on bolster, extend knee upward until leg is completely straight (180°). Hold 2–3 seconds at top apex with foot dorsiflexed. Lower slowly.
- **Prescription (Literature):** 3 sets of 12–15 reps, tempo 2-2-2.
- **Variants:** With light ankle weight (0.5–2 kg).
- **Camera Placement:** Lateral sagittal view, camera height 30 cm, 2.0 m distance.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Knee extends from 140°–150° resting angle to >= 175° and holds >= 1.5 s, while thigh maintains bolster contact.
  - *Partial Repetition:* Extension reaches 160°–174°.
  - *Form Fault / Rejection:* Thigh lifts off bolster (hip flexor substitution); hold time < 0.5 s; uncontrolled dropping of leg.

---

## Section 3: Hip Rehabilitation (8 Exercises)

### 3.1 Clamshell
- **Primary Target:** Gluteus medius (posterior fibers), external rotators.
- **Starting Position:** Side-lying with hips flexed 45° and knees flexed 90°. Pelvis stacked perpendicular to floor, feet aligned with spine, heels glued together.
- **Movement:** Keeping inner borders of feet together, rotate top knee upward toward ceiling like an opening clamshell. Hold 1–2 s at peak without rolling pelvis backward. Slowly lower.
- **Prescription (Literature):** 3 sets of 12–15 reps, tempo 2-1-2.
- **Variants:** Elastic mini-band around distal thighs (above knees).
- **Camera Placement:** Frontal-oblique view (45° facing patient's abdomen) or direct lateral view, camera height 30–40 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Top knee elevates to achieve >= 30° inter-thigh separation angle while feet remain in contact.
  - *Partial Repetition:* Separation angle reaches 15°–29°.
  - *Form Fault / Rejection:* Posterior pelvic roll (> 15° backward rotation of ASIS/PSIS plane); feet separate; lumbar spine twists.

### 3.2 Side-Lying Hip Abduction
- **Primary Target:** Gluteus medius, tensor fasciae latae regulation.
- **Starting Position:** Side-lying on floor, bottom leg flexed for stability, top leg fully extended with knee straight and hip in slight extension (~5–10° posterior to midline). Toes pointing horizontally forward or slightly down.
- **Movement:** Raise top leg upward toward ceiling (abduction to ~35–45°), leading with the heel. Hold 1–2 s at top. Lower slowly.
- **Prescription (Literature):** 3 sets of 10–12 reps per side, tempo 2-1-3.
- **Variants:** Ankle weights; mini-band.
- **Camera Placement:** Front-facing (facing patient's torso, 0° perpendicular to mat), height 30 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Hip abduction angle reaches >= 30° above horizontal while knee extension remains >= 170°.
  - *Partial Repetition:* Abduction reaches 18°–29°.
  - *Form Fault / Rejection:* Hip flexes forward (> 15° anterior drift) turning movement into TFL/hip flexor dominant; pelvis rolls backward; foot externally rotates toward ceiling (> 20°).

### 3.3 Glute Bridge (Bilateral Supine)
- **Primary Target:** Gluteus maximus, hamstrings, lumbopelvic core stability.
- **Starting Position:** Supine on mat, knees flexed ~90°, feet flat on floor hip-width apart. Arms at sides, palms down.
- **Movement:** Engage glutes and core; drive through heels to elevate hips until thighs, pelvis, and torso form a straight linear incline (180° hip extension). Hold 2 s, return without resting fully on floor.
- **Prescription (Literature):** 3 sets of 12–15 reps, tempo 2-2-2.
- **Variants:** Mini-band around knees; toes elevated (heel drive focus).
- **Camera Placement:** Lateral profile (sagittal view), height 30–40 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Hip extension angle reaches 170°–180° (thigh-torso alignment) with knee angles between 80° and 100°.
  - *Partial Repetition:* Hip extension reaches 145°–169°.
  - *Form Fault / Rejection:* Excessive lumbar hyperextension (rib cage flaring, lordotic angle > 20°); knees caving inward into valgus.

### 3.4 Bird-Dog (Quadruped Contralateral Extension)
- **Primary Target:** Multifidus, erector spinae, gluteus maximus, contralateral core stability.
- **Starting Position:** Quadruped (all fours) on mat: hands under shoulders, knees directly under hips. Spine in neutral alignment.
- **Movement:** Simultaneously extend right arm forward horizontally and left leg backward horizontally until both are parallel to floor. Maintain level hips and shoulders. Hold 2–3 s, return smoothly to all fours. Alternate sides.
- **Prescription (Literature):** 3 sets of 8–10 reps per side, 3 s hold at peak.
- **Variants:** Hand/toe tapping floor between reps vs drawing elbow to knee under torso.
- **Camera Placement:** 45° anterolateral or 90° lateral profile view, height 40 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Arm elevation reaches >= horizontal (humeral angle to torso >= 165°) and leg elevation reaches horizontal (hip extension >= 170°) held for >= 2.0 s.
  - *Partial Repetition:* Limb elevation between 140° and 164°, or hold < 1.0 s.
  - *Form Fault / Rejection:* Pelvic rotation / roll (> 15° tilt of pelvis); lumbar sagging/hyperextension (> 15°); head dropping into cervical flexion.

### 3.5 Donkey Kick (Quadruped Hip Extension)
- **Primary Target:** Isolated gluteus maximus (hamstring slackened).
- **Starting Position:** All-fours on mat: wrists under shoulders, knees under hips, core braced.
- **Movement:** Keeping involved knee bent at 90°, extend hip upward and backward, driving sole of foot toward ceiling until thigh is parallel to torso. Squeeze glute for 1–2 s, return without touching knee to mat.
- **Prescription (Literature):** 3 sets of 12–15 reps per leg, tempo 2-1-2.
- **Variants:** With mini-band; ankle weights.
- **Camera Placement:** Lateral sagittal view, height 40 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Thigh reaches horizontal (hip extension >= 170° relative to trunk) while knee maintains 80°–100° flexion.
  - *Partial Repetition:* Thigh reaches 145°–169°.
  - *Form Fault / Rejection:* Lumbar spine hyper-extension (swaying back to fake hip range); knee straightening to recruit hamstrings (> 115° knee angle); pelvis tilting laterally > 15°.

### 3.6 Monster Walk / Lateral Band Walk
- **Primary Target:** Gluteus medius, tensor fasciae latae, abductor functional endurance.
- **Starting Position:** Standing in quarter squat (hip flexion ~30°, knee flexion ~30°), feet hip-width apart. Resistance loop band placed around ankles (or distal thighs).
- **Movement:** Step laterally with lead foot (30–40 cm step), maintaining knee alignment over toes and constant band tension. Bring trailing foot in controlled fashion, preserving at least shoulder-width base of support.
- **Prescription (Literature):** 3 sets of 10–15 paces in each direction.
- **Variants:** Band at knees (easiest), ankles (moderate), or mid-foot (hardest).
- **Camera Placement:** Frontal view (coronal), height 70 cm, 3.0 m distance.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Lateral step width >= 1.5x shoulder width followed by controlled step recovery without feet touching.
  - *Partial Repetition:* Lateral step width < 1.2x shoulder width.
  - *Form Fault / Rejection:* Knee caving inward on lead or trailing leg; upright trunk posture losing athletic quarter squat; excessive lateral trunk sway (> 15° torso lean).

### 3.7 Single-Leg Glute Bridge
- **Primary Target:** Unilateral gluteus maximus recruitment, pelvic rotational stability.
- **Starting Position:** Supine on mat, both knees bent 90°. One leg lifted off floor (knee pulled to chest or extended straight in line with thigh).
- **Movement:** Drive through heel of planted foot to raise hips until torso, pelvis, and stance thigh form a straight line. Hold 1–2 s at top. Lower slowly.
- **Prescription (Literature):** 3 sets of 8–10 reps per side, tempo 2-1-2.
- **Variants:** Floating leg bent 90° vs straight.
- **Camera Placement:** Lateral sagittal view, height 30 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Stance hip achieves >= 165° extension while pelvis remains horizontal within 5° lateral tilt.
  - *Partial Repetition:* Stance hip achieves 140°–164°.
  - *Form Fault / Rejection:* Unsupported pelvic drop / tilt (> 10° ASIS asymmetry); cramping hamstring substitution; lumbar arching.

### 3.8 Half-Kneeling Hip Flexor Stretch
- **Primary Target:** Iliopsoas, rectus femoris elongation, anterior hip mobility.
- **Starting Position:** Half-kneeling position: front foot flat on floor with knee at 90°, back knee resting on padded mat with hip extended. Torso upright, pelvis tucked into posterior pelvic tilt.
- **Movement:** Gently shift weight forward a few centimeters into front hip while strictly maintaining posterior pelvic tilt and upright spine until stretch is felt in front of back hip. Hold statically.
- **Prescription (Literature):** 3–4 repetitions of 30-second sustained holds per side.
- **Variants:** Raising ipsilateral arm overhead with slight lateral flexion away from back leg.
- **Camera Placement:** Sagittal profile view, height 50 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Position maintained with back hip extension >= 15° beyond neutral, upright trunk within 10° of vertical, held continuously for >= 25 s.
  - *Partial Repetition:* Hold sustained between 12 and 24 s.
  - *Form Fault / Rejection:* Lumbar hyperextension (> 15° lordotic bow); loss of posterior pelvic tilt; front knee drifting past toes by > 15 cm.

---

## Section 4: Lower Back Rehabilitation (8 Exercises)

### 4.1 Pelvic Tilt (Supine Lumbopelvic Stabilization)
- **Primary Target:** Transversus abdominis, internal obliques, rectus abdominis, lumbar spine flattening.
- **Starting Position:** Supine on mat, knees flexed 90°, feet flat on floor. Natural lumbar lordotic curve leaves small space under lower back.
- **Movement:** Gently tighten abdominal muscles and contract gluteals, rolling pelvis backward to press lumbar spine flat against mat, eliminating the lumbar space. Hold 3–5 seconds, release smoothly to neutral.
- **Prescription (Literature):** 3 sets of 10–12 reps, 5 s hold per rep.
- **Variants:** Supine vs standing against wall.
- **Camera Placement:** 45° anterolateral view, height 30 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Posterior pelvic rotation eliminates floor-to-lumbar gap, accompanied by rib cage depression, held >= 3.0 s.
  - *Partial Repetition:* Incomplete flattening or hold duration 1.0–2.9 s.
  - *Form Fault / Rejection:* Breath-holding (Valsalva); pushing down with feet/legs rather than abdominal draw-in; lifting buttocks off floor (bridging).

### 4.2 Cat-Cow (Quadruped Segmental Mobilization)
- **Primary Target:** Full-spine sagittal mobilization (flexion and extension), paraspinal relaxation.
- **Starting Position:** All-fours on mat: wrists under shoulders, knees under hips. Spine in neutral flat posture.
- **Movement:**
  - *Cat Phase:* Exhale, tuck chin to chest, draw navel toward spine, round entire back toward ceiling like an angry cat.
  - *Cow Phase:* Inhale, gently drop belly toward floor, lift chest and gaze forward, arching spine into gentle extension.
- **Prescription (Literature):** 2–3 sets of 10 smooth, unhurried cycles, tempo 3-1-3.
- **Variants:** Controlled segmental motion vs global motion.
- **Camera Placement:** 90° lateral sagittal view, height 40 cm, 2.5 m distance.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Cycle):* Full cycle moving from flexion (thoracolumbar kyphosis convex arc >= 20° above baseline) to extension (lumbar lordosis concave arc >= 15° below baseline).
  - *Partial Repetition:* Shallow excursion in either direction (< 10° deviation).
  - *Form Fault / Rejection:* Shifting hips backward toward heels; elbow bending (> 15° flexion); aggressive cervical whiplash motion.

### 4.3 Deadbug (Contralateral Core Stabilization)
- **Primary Target:** Anterior core stability (transversus abdominis), anti-extension control under limb load.
- **Starting Position:** Supine on mat. Arms pointing vertically toward ceiling (90° shoulder flexion). Hips and knees flexed to 90° (tabletop position). Lumbar spine pressed firmly into mat.
- **Movement:** Slowly lower right arm overhead toward floor while simultaneously extending left leg straight out hovering 5–10 cm above floor. Lumbar spine must remain glued to mat. Pause 1 s, return to starting position. Alternate sides.
- **Prescription (Literature):** 3 sets of 8–10 reps per side, tempo 2-1-2.
- **Variants:** Heel taps only (bent knee, less lever arm) progressing to full leg extension.
- **Camera Placement:** 45° oblique view from side, height 40 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Extended limb reaches within 15° of horizontal (arm and leg extended) while lumbar spine maintains continuous floor contact.
  - *Partial Repetition:* Leg extends only halfway (knee reaches 120°–150°).
  - *Form Fault / Rejection:* Lumbar spine arches off floor (> 2 cm clearance, loss of core brace); opposite knee pulls into chest to compensate; rapid flailing tempo.

### 4.4 McGill Curl-Up
- **Primary Target:** Rectus abdominis, deep neck flexors, core bracing with zero lumbar flexion load.
- **Starting Position:** Supine on mat. One leg bent with foot flat on floor, one leg straight. Both hands placed palms-down beneath natural lumbar lordosis to monitor neutral curve.
- **Movement:** Brace abdomen. Hover head and upper shoulders 2–5 cm off mat as a single rigid block (pivoting at thoracic spine), keeping cervical spine completely locked in neutral (no chin jutting or neck flexion). Hold 8–10 seconds. Lower under control.
- **Prescription (Literature):** Descending pyramid (McGill Big 3): 5 reps, 3 reps, 1 rep of 8–10 s holds per side.
- **Variants:** Switching bent leg between sets.
- **Camera Placement:** 90° lateral profile view, height 30 cm, 2.0 m distance.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Scapulae lift 2–4 cm off floor while cervical-cranial angle deviates < 5° from neutral, held continuously for >= 7.0 s.
  - *Partial Repetition:* Scapulae lift but hold is only 3.0–6.9 s.
  - *Form Fault / Rejection:* Cervical poking / severe chin jutting (> 15° neck flexion); flattening lumbar spine into hands (loss of neutral lordosis); elbow push-off.

### 4.5 Side Plank (Knees or Full Feet)
- **Primary Target:** Quadratus lumborum, obliques, lateral core stability (McGill Big 3).
- **Starting Position:** Side-lying supported on bottom forearm, elbow directly beneath shoulder. Knees bent 90° (beginner) or legs straight with feet stacked/staggered (advanced).
- **Movement:** Lift hips and pelvis off floor until body forms a straight line from shoulder to knee (or ankle). Hold isometric position without sagging or rotating.
- **Prescription (Literature):** 3–4 holds of 10–20 seconds per side.
- **Variants:** Modified (from knees) vs standard (from feet).
- **Camera Placement:** Frontal view (facing patient's chest), height 40 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Trunk-pelvis-lower extremity alignment maintained within 10° of straight linear axis for >= 10.0 continuous seconds.
  - *Partial Repetition:* Hold sustained between 5.0 and 9.9 seconds.
  - *Form Fault / Rejection:* Hip sagging downward (> 15° drop); anterior pelvic rotation toward floor; shoulder shrugging into neck.

### 4.6 McKenzie Prone Press-Up (Extension in Lying)
- **Primary Target:** Lumbar disc centralization, restoration of lumbar lordosis.
- **Starting Position:** Prone on mat, forehead down, hands placed flat on floor under shoulders (like a push-up position). Glutes and legs completely relaxed.
- **Movement:** Press down through hands to straighten elbows and lift chest off mat into lumbar extension. Hips, pelvis, and legs remain limp on the floor. Exhale and sag into extension at top, hold 1–2 s, lower.
- **Prescription (Literature):** 2–3 sets of 10 smooth repetitions, tempo 2-2-2.
- **Variants:** Prone prop on elbows (passive hold) progressing to full press-up.
- **Camera Placement:** 90° lateral sagittal view, height 30 cm, 2.5 m distance.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Elbows extend toward straight (>= 150° extension) while anterior superior iliac spines (ASIS) remain within 5 cm of mat.
  - *Partial Repetition:* Incomplete press-up (elbows < 120° extension).
  - *Form Fault / Rejection:* Gluteal contraction / leg lifting (active muscle guarding); hips lifting off mat turning movement into a plank.

### 4.7 Knee-to-Chest (Single or Double Supine Flexion)
- **Primary Target:** Lumbar paraspinal passive stretch, facet joint opening.
- **Starting Position:** Supine on mat, legs extended or knees bent.
- **Movement:** Draw one knee (or both knees) up toward chest, grasping shin or posterior thigh with hands. Gently pull thigh toward rib cage until mild stretch in lower back/glute is felt. Hold 20–30 seconds.
- **Prescription (Literature):** 3 holds of 20–30 seconds per side.
- **Variants:** Single knee to chest vs double knees to chest.
- **Camera Placement:** Lateral sagittal view, height 30 cm, 2.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Thigh held within 30° of chest contact for continuous duration >= 20.0 seconds.
  - *Partial Repetition:* Hold sustained between 10 and 19 seconds.
  - *Form Fault / Rejection:* Cervical hyperextension (head lifting off floor); pulling on patella rather than proximal tibia/hamstring.

### 4.8 Child's Pose (Lumbar & Latissimus Relaxation)
- **Primary Target:** Thoracolumbar fascia relaxation, hip flexion mobility.
- **Starting Position:** Kneeling on mat, big toes touching, knees spread wide (mat-width).
- **Movement:** Sit hips back onto heels, fold torso forward between thighs, extend arms straight forward along floor, resting forehead on mat. Breathe deeply and hold.
- **Prescription (Literature):** 3 holds of 30–60 seconds.
- **Variants:** Walking hands 30° to left or right to bias latissimus dorsi stretch.
- **Camera Placement:** 45° anterolateral or 90° lateral profile view, height 30 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Buttocks within 10 cm of heels, chest lowered, held continuously for >= 25.0 seconds.
  - *Partial Repetition:* Hold sustained between 12 and 24 seconds.
  - *Form Fault / Rejection:* Hips hovering high in air (> 20 cm off heels due to knee or hip tightness); shrugging shoulders aggressively.

---

## Section 5: Neck Rehabilitation (8 Exercises)

### 5.1 Chin Tuck (Cervical Axial Retraction)
- **Primary Target:** Longus colli, longus capitis (deep cervical flexors), suboccipital stretch.
- **Starting Position:** Seated or standing tall with neutral spine. Gaze straight ahead at eye level. Shoulders relaxed and depressed.
- **Movement:** Draw chin horizontally backward as if sliding head along a horizontal plane (creating a subtle "double chin"), lengthening the back of the neck without tilting head downward or looking down. Hold 3–5 seconds, release smoothly.
- **Prescription (Literature):** 3 sets of 10 reps, 3–5 s isometric hold per rep.
- **Variants:** Supine with towel roll vs seated vs standing against wall.
- **Camera Placement:** 90° lateral profile view (true sagittal view of head/neck), height at head level (120–140 cm seated/standing).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Horizontal posterior translation of ear landmark relative to shoulder landmark >= 2.0 cm, with cervical flexion/extension angle deviation < 5°, held >= 3.0 s.
  - *Partial Repetition:* Translation between 1.0 and 1.9 cm, or hold duration 1.0–2.9 s.
  - *Form Fault / Rejection:* Cervical flexion (looking down at floor); cervical extension (head tilting back); thoracic slumping.

### 5.2 Levator Scapulae Stretch
- **Primary Target:** Levator scapulae muscle length, posterior-lateral cervical release.
- **Starting Position:** Seated upright. Anchor shoulder on affected side by holding underside of chair seat with that hand.
- **Movement:** Turn head 45° away from affected side, then gently tuck chin down toward opposite armpit / chest pocket. Place opposite hand lightly on crown of head for gentle guidance. Hold 20–30 seconds.
- **Prescription (Literature):** 3 sets of 30-second sustained holds per side.
- **Variants:** Seated vs standing.
- **Camera Placement:** 45° anterior-lateral view, height at eye level (120 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Combined cervical rotation (~45°) and flexion held stable for continuous duration >= 25.0 seconds with shoulder anchored.
  - *Partial Repetition:* Hold sustained between 12 and 24 seconds.
  - *Form Fault / Rejection:* Shoulder hiking upward (loss of scapular anchor); forceful aggressive pulling on neck.

### 5.3 Upper Trapezius Stretch
- **Primary Target:** Upper trapezius, lateral cervical myofascial elongation.
- **Starting Position:** Seated upright. Anchor affected arm behind back or under chair.
- **Movement:** Tilt head directly sideways (lateral flexion), bringing opposite ear toward opposite shoulder. Face points straight ahead (no head turning). Gentle overpressure with hand over temple. Hold 20–30 seconds.
- **Prescription (Literature):** 3 sets of 30 seconds per side.
- **Variants:** Seated vs standing.
- **Camera Placement:** Direct frontal view (coronal 0°), height at eye level (120 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Lateral flexion angle >= 25° relative to vertical axis, held continuously for >= 25.0 seconds without facial rotation.
  - *Partial Repetition:* Lateral flexion angle 15°–24°, or hold 12–24 seconds.
  - *Form Fault / Rejection:* Head rotating instead of side-bending; shoulder elevating to meet ear; trunk leaning laterally.

### 5.4 Cervical Rotation Active Range of Motion (AROM)
- **Primary Target:** Atlantoaxial joint, cervical facet mobility, sternocleidomastoid/splenius activation.
- **Starting Position:** Seated upright with neutral thoracic posture, shoulders relaxed.
- **Movement:** Turn head smoothly to the right through full comfortable arc, hold 2 s at end-range, return to center, then turn head smoothly to the left, hold 2 s, return to center.
- **Prescription (Literature):** 2–3 sets of 10 repetitions per direction, tempo 2-2-2.
- **Variants:** Seated vs standing.
- **Camera Placement:** Direct frontal view (coronal 0°), height at head level (120 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Head rotation reaches >= 60° from neutral to either side, pausing >= 1.5 s, without shoulder rotation.
  - *Partial Repetition:* Rotation reaches 40°–59°.
  - *Form Fault / Rejection:* Shoulder girdle rotation (> 10° torso twist to cheat neck range); head lateral tilt (> 10° ear drop during turn).

### 5.5 Deep Neck Flexor Endurance Hold (Craniocervical Flexion)
- **Primary Target:** Longus colli and longus capitis endurance, postural stabilizers.
- **Starting Position:** Supine on mat, knees flexed 90°, head resting flat in neutral.
- **Movement:** Perform subtle craniocervical nod (nodding "yes" with skull only, without contracting superficial platysma or sternocleidomastoid). Lift head just 1 cm off mat while strictly maintaining the nod. Hold 10 seconds.
- **Prescription (Literature):** 3–5 sets of 10-second holds (clinical norm: > 25–30 s endurance in healthy adults).
- **Variants:** Pressure biofeedback unit (PBU) under occiput (20 to 30 mmHg progression).
- **Camera Placement:** True lateral sagittal view at mat level, height 15–20 cm, 1.5 m away.
- **Repetition Boundary Criteria:**
  - *Full Repetition (Sustained Hold):* Head elevated 1.0–2.5 cm off floor with chin tuck maintained for >= 8.0 continuous seconds.
  - *Partial Repetition:* Hold sustained between 4.0 and 7.9 seconds.
  - *Form Fault / Rejection:* Chin poking upward / head extension; excessive elevation (> 4 cm, recruiting rectus abdominis / SCM); shaking / breath holding.

### 5.6 Scapular Retraction (Shoulder Blade Squeeze)
- **Primary Target:** Rhomboids, middle trapezius, reversal of upper crossed syndrome.
- **Starting Position:** Seated or standing tall, arms bent 90° at sides or resting comfortably.
- **Movement:** Draw shoulder blades together toward spine and slightly downward, opening anterior chest wall. Hold 3–5 seconds, release smoothly.
- **Prescription (Literature):** 3 sets of 10–12 reps, 3–5 s hold.
- **Variants:** With elastic resistance band held between hands.
- **Camera Placement:** Posterior or 45° posterolateral view, height 110 cm.
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Posterior displacement of shoulder tips >= 3.0 cm with inter-scapular distance decreasing >= 15%, held >= 3.0 s.
  - *Partial Repetition:* Displacement 1.5–2.9 cm, or hold 1.0–2.9 s.
  - *Form Fault / Rejection:* Shrugging shoulders upward (upper trapezius hiking); lumbar hyperextension (flaring ribs).

### 5.7 Cervical Lateral Flexion Active Range of Motion
- **Primary Target:** Cervical coronal plane mobility, scalenes, intertransversarii.
- **Starting Position:** Seated tall, gaze horizontal, shoulders depressed.
- **Movement:** Side-bend head by lowering ear toward shoulder on same side without rotating face. Pause 2 s at end-range, return to center, repeat on opposite side.
- **Prescription (Literature):** 2 sets of 8–10 reps per side, tempo 2-2-2.
- **Variants:** Active unassisted vs gentle self-overpressure.
- **Camera Placement:** Direct frontal view (coronal 0°), height at eye level (120 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Lateral flexion angle reaches >= 30° from vertical without transverse rotation.
  - *Partial Repetition:* Lateral flexion reaches 18°–29°.
  - *Form Fault / Rejection:* Shoulder elevation (> 15 mm shoulder hitch); head rotation (> 10° nose turn); lateral trunk lean.

### 5.8 Thoracic Extension over Chair / Foam Roller
- **Primary Target:** Thoracic spine extension mobility, relieving cervical compensatory strain.
- **Starting Position:** Seated in stable chair with mid-back height backrest (or supine with foam roller under mid-thoracic spine). Interlace fingers behind neck to support cervical spine.
- **Movement:** Inhale, gently lean backward over backrest/roller, arching upper back into extension while keeping cervical spine supported in neutral. Exhale and hold 2–3 s, return upright.
- **Prescription (Literature):** 2 sets of 8–10 reps, tempo 2-2-2.
- **Variants:** Chair backrest vs foam roller.
- **Camera Placement:** 90° lateral profile view, height at chest level (100 cm).
- **Repetition Boundary Criteria:**
  - *Full Repetition:* Thoracic extension excursion >= 15° relative to upright vertical without lumbar hyper-lordosis.
  - *Partial Repetition:* Thoracic excursion between 8° and 14°.
  - *Form Fault / Rejection:* Neck hyperextending backward unsupported; hips lifting off seat; rib cage over-flaring.

---

## Section 6: Summary Table of Technical Repetition Boundaries

| ID | Exercise Name | Primary Joint / Plane | Full Rep Metric | Partial Rep Metric | Primary Form Fault |
|---|---|---|---|---|---|
| **S01** | Pendulum (Codman's) | Glenohumeral (Sagittal/Circ.) | 360° circular orbit, r: 10–30 cm | Radius < 10 cm | Active deltoid firing / elbow flexion > 15° |
| **S02** | ER with Band | Shoulder (Transverse) | Forearm ER >= 45°, elbow pinned | ER 20°–44° | Elbow abduction > 20° / trunk twist > 10° |
| **S03** | Prone Y Raise | Scapulothoracic (135° Scaption) | Lift >= 5 cm, thumbs ceiling, hold >= 2s | Lift < 5 cm / hold < 1s | Neck hyperextension > 25° / lumbar arch > 15° |
| **S04** | Prone T Raise | Scapulothoracic (90° Abduction) | Lift >= 8 cm, hold >= 2s | Lift 3–7 cm | Upper trap shrugging / elbow flex > 20° |
| **S05** | Scaption | Glenohumeral (Scapular Plane) | Elevation 80°–100° in scapular plane | Elevation 50°–79° | Elevation > 110° / shoulder shrugging > 15° |
| **S06** | Wall Slide | Scapulothoracic (Overhead) | Elbows glide from 90° to >= 135° | Elbows reach 110°–134° | Forearms peeling off wall / lumbar lordosis |
| **S07** | Sleeper Stretch | Shoulder (Internal Rotation) | IR hold stable >= 25 s | Hold 10–24 s | Anterior shoulder rolling forward off mat |
| **S08** | Serratus Punch | Scapulothoracic (Protraction) | Wrist vertical lift >= 4 cm, elbow 180° | Lift 2.0–3.9 cm | Elbow flex > 15° (triceps cheat) / trunk roll |
| **K01** | Straight Leg Raise | Hip (Sagittal) / Knee | Hip flex 35°–50°, knee >= 175° | Hip flex 20°–34° | Knee lag (flexion > 10°) / pelvic tilt |
| **K02** | Terminal Knee Ext. | Knee (Sagittal) | Knee 150° to >= 178°, hold >= 1.5s | Extension 168°–177° | Recurvatum (> 185°) / heel lift / trunk lean |
| **K03** | Quad Set | Knee (Isometric) | Sustained full ext >= 178° for >= 5s | Hold 2.0–4.9 s | Glute squeeze substitution / hold < 2s |
| **K04** | Hamstring Curl | Knee (Sagittal) | Knee flexion <= 90° (from 180°) | Knee flexion 100°–120° | Pelvis lifting off mat > 15° / thrashing |
| **K05** | Wall Sit | Knee / Hip (Isometric) | Target knee angle held >= 20 s | Hold 10–19 s | Knee valgus collapse / hands on thighs |
| **K06** | Heel Slide | Knee (Sagittal Flexion) | Full ext >= 170° to flex <= 90° to >= 170° | Flexion 95°–120° | Hip abduction splay > 25° / heel lift |
| **K07** | Step-Up | Hip / Knee (Triple Extension) | Stance knee >= 175° at top, smooth down | Top knee < 165° | Jumping off back toe / knee valgus collapse |
| **K08** | Short Arc Quad | Knee (Terminal Sagittal) | Ext 140°–150° to >= 175°, hold >= 1.5s | Ext 160°–174° | Thigh lifts off bolster / uncontrolled drop |
| **H01** | Clamshell | Hip (Transverse / Frontal) | Inter-thigh angle >= 30°, feet touching | Angle 15°–29° | Pelvis rolling backward > 15° / feet separate |
| **H02** | Side-Lying Hip Abd. | Hip (Frontal) | Abduction >= 30°, knee straight | Abduction 18°–29° | Hip anterior flexion > 15° / external rotation |
| **H03** | Glute Bridge | Hip (Sagittal) | Hip extension 170°–180° | Hip extension 145°–169° | Lumbar hyper-lordosis > 20° / knee valgus |
| **H04** | Bird-Dog | Hip / Shoulder (Contralateral) | Arm >= 165°, leg >= 170°, hold >= 2s | Angles 140°–164° | Pelvis tilt > 15° / lumbar sagging > 15° |
| **H05** | Donkey Kick | Hip (Sagittal Extension) | Thigh >= 170° (horizontal), knee 90° | Thigh 145°–169° | Lumbar sagging / knee straightening > 115° |
| **H06** | Monster Walk | Hip (Abduction / Stance) | Step width >= 1.5x shoulder width | Step width < 1.2x | Knee valgus / upright loss of athletic stance |
| **H07** | Single-Leg Bridge | Hip (Unilateral Extension) | Stance hip >= 165°, pelvis level within 5° | Stance hip 140°–164° | Pelvic drop > 10° / lumbar hyperextension |
| **H08** | Half-Kneeling Stretch| Hip (Anterior Extensibility) | Back hip ext >= 15°, torso vertical, >= 25s | Hold 12–24 s | Lumbar hyperextension > 15° / lost PPT |
| **L01** | Pelvic Tilt | Lumbopelvic (Sagittal) | Lumbar gap flat against mat, hold >= 3s | Hold 1.0–2.9 s | Breath-holding (Valsalva) / pushing with feet |
| **L02** | Cat-Cow | Spine (Sagittal Flex/Ext) | Flex arc >= 20° to ext arc >= 15° | Excursion < 10° | Shifting hips back / elbow bending > 15° |
| **L03** | Deadbug | Core (Anti-Extension) | Arm/leg reach within 15° horiz., back flat| Half extension | Lumbar arching > 2 cm clearance / speed flail |
| **L04** | McGill Curl-Up | Core (Braced Thoracic) | Scapulae lift 2–4 cm, neck neutral, >= 7s | Hold 3.0–6.9 s | Chin poking > 15° / lumbar flattening |
| **L05** | Side Plank | Core (Lateral Chain) | Linear axis aligned within 10°, hold >= 10s| Hold 5.0–9.9 s | Hip sagging > 15° / anterior chest roll |
| **L06** | McKenzie Press-Up | Lumbar (Passive Extension) | Elbows ext >= 150°, ASIS on floor | Elbows < 120° | Glute contraction / lifting hips off floor |
| **L07** | Knee-to-Chest | Lumbar / Gluteal (Passive) | Thigh within 30° of chest, hold >= 20s | Hold 10–19 s | Neck hyperextension / pulling on patella |
| **L08** | Child's Pose | Thoracolumbar (Passive) | Buttocks on heels, torso folded, hold >= 25s| Hold 12–24 s | Hips hovering > 20 cm off heels / shrugging |
| **N01** | Chin Tuck | Cervical (Axial Retraction) | Horizontal retraction >= 2.0 cm, hold >= 3s| Retraction 1.0–1.9 cm | Cervical flexion (looking down) / neck tilt |
| **N02** | Levator Scap. Stretch| Cervical (Flexion/Rotation) | Neck 45° rot + flex, shoulder low, >= 25s | Hold 12–24 s | Shoulder hiking / forceful neck pulling |
| **N03** | Upper Trap Stretch | Cervical (Lateral Flexion) | Pure lat flex >= 25°, shoulder down, >= 25s| Lat flex 15°–24° | Head rotation / shoulder elevating |
| **N04** | Cervical Rot. AROM | Cervical (Transverse) | Rotation >= 60° each side, hold >= 1.5s | Rotation 40°–59° | Shoulder twist > 10° / lateral head tilt |
| **N05** | Deep Neck Flexor | Craniocervical (Endurance) | Head 1.0–2.5 cm off mat, chin tucked, >= 8s | Hold 4.0–7.9 s | Chin jutting / head lifting > 4 cm (SCM cheat) |
| **N06** | Scapular Retraction| Scapulothoracic (Adduction) | Shoulder tips pull back >= 3 cm, hold >= 3s | Pull 1.5–2.9 cm | Upper trap hiking / lumbar lordosis flare |
| **N07** | Cervical Lat. Flex. | Cervical (Coronal AROM) | Lateral tilt >= 30° each side, pause >= 1.5s| Tilt 18°–29° | Shoulder hitching / head rotation |
| **N08** | Thoracic Extension | Thoracic (Sagittal Extension) | Thoracic arc >= 15° over backrest | Arc 8°–14° | Neck unsupported arching / hips lifting |

---

## Section 7: Primary Literature and Clinical Guidelines Citations

1. **National Health Service (NHS):**
   - *Shoulder Pain and Rehabilitation Guidelines*, Guy's and St Thomas' NHS Foundation Trust, 2024. Snapshot: `docs/research/sources/nhs-shoulder-rehab.txt`.
   - *Knee Rehabilitation and Exercise Protocols*, Oxford University Hospitals NHS Trust, 2024. Snapshot: `docs/research/sources/nhs-knee-rehab.txt`.
   - *Hip Pain Rehabilitation Protocols*, The Royal Orthopaedic Hospital NHS Foundation Trust, 2024. Snapshot: `docs/research/sources/nhs-hip-rehab.txt`.
   - *Low Back Pain Management and Rehabilitation Guidelines*, Sheffield Teaching Hospitals NHS Trust, 2024. Snapshot: `docs/research/sources/nhs-lower-back-rehab.txt`.
   - *Neck Pain and Cervical Spine Rehabilitation Protocol*, Cambridge University Hospitals NHS Foundation Trust, 2024. Snapshot: `docs/research/sources/nhs-neck-rehab.txt`.
2. **Haute Autorité de Santé (HAS):**
   - *Prise en charge de la lombalgie commune de l'adulte*, Recommandations de bonne pratique, HAS, 2019.
   - *Rééducation dans le cadre des suites d'arthroplastie de hanche ou de genou*, HAS, 2021.
3. **American Physical Therapy Association (APTA):**
   - Martin RL, et al. *Clinical Practice Guideline: Neck Pain Revision 2017*, J Orthop Sports Phys Ther. 2017;47(7):A1-A83. DOI: 10.2519/jospt.2017.0302.
   - Logerstedt DS, et al. *Knee Stability and Movement Coordination Impairments: Knee Ligament Sprain Clinical Practice Guidelines*, J Orthop Sports Phys Ther. 2017;47(11):A1-A47. DOI: 10.2519/jospt.2017.0303.
   - George SZ, et al. *Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021*, J Orthop Sports Phys Ther. 2021;51(11):CPG1-CPG60. DOI: 10.2519/jospt.2021.0304.
4. **Cochrane Musculoskeletal Group:**
   - Page MJ, et al. *Manual therapy and exercise for rotator cuff disease*, Cochrane Database Syst Rev. 2016;(6):CD012224. DOI: 10.1002/14651858.CD012224.
   - Gross A, et al. *Exercises for mechanical neck disorders*, Cochrane Database Syst Rev. 2015;(1):CD004249. DOI: 10.1002/14651858.CD004249.pub4.

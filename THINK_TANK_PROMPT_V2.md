# WorkoutVision Architecture Review Board — V2

## Preamble: What This Prompt Is

This document is a prompt. Feed it to Claude (Opus or Sonnet) to produce an exhaustive product and architecture review of WorkoutVision — a PWA that uses on-device AI (MediaPipe Pose Landmarker) to analyze workout form from video, count reps, score biomechanics, and track progression. The entire application runs client-side with zero backend. One person built it.

The review must prove or disprove one thesis: **that a single developer with AI tooling can build a product that meets the standard of a company deploying hundreds of engineers.** The review board's job is not to flatter. It is to find every gap between what exists and what Apple, Google, or Whoop would ship — and to produce an actionable roadmap that closes those gaps.

**Do not rush. Do not summarize. Do not skip any council member. Every named expert speaks in their own voice with their own technical concerns. This review should burn tokens because the output is the roadmap for a product that either enters the market seriously or does not enter at all.**

---

## The Product Under Review

**WorkoutVision** — a React 19 Progressive Web App deployed on GitHub Pages.

### Technical Stack
- React 19.2.8 + Vite 5.4.21
- MediaPipe Pose Landmarker (33 landmarks, VIDEO running mode, CPU delegate)
- ffmpeg.wasm 0.12.15 for deterministic frame extraction (15fps desktop, 10fps iOS)
- localforage (IndexedDB) for all persistence — zero cloud, zero accounts
- Web Workers with OffscreenCanvas for off-main-thread inference
- 1D Kalman filter (99 independent filters: 33 landmarks x 3 coordinates) for jitter suppression
- Web Audio API for real-time auditory feedback
- 5-stage biomechanical FSM (setup/eccentric/isometric/concentric/lockout) with angular velocity
- Valley counting algorithm with adaptive two-pass spacing for rep detection
- Savitzky-Golay differentiation for velocity computation
- PWA with standalone display mode (service worker intentionally disabled due to iOS cache bugs)

### Scale of the Exercise Database
274 exercise definitions across compound, isolation, bodyweight, and machine categories. Each exercise carries: name, category, primary/secondary muscles, tracked joint, getValue function, up/down thresholds, form checks with severity and scientific citations, and science notes. Covers: free weights, machines, cables, bodyweight, plyometrics, Olympic lifts, kettlebell, TRX/suspension, resistance bands, stability ball, advanced calisthenics, conditioning equipment.

### Auto-Detection Engine
Heuristic classifier using rolling window of joint angle signatures. Detects body orientation (seated, lying, prone, standing, hanging) then classifies by joint range-of-motion patterns with majority voting.

### Biomechanics Pipeline
1. Frame extraction via ffmpeg.wasm (deterministic timestamps)
2. Pose detection via MediaPipe (33 landmarks per person, up to 3 people)
3. Kalman filtering on raw landmark coordinates
4. Joint angle extraction (knee, hip, elbow, shoulder, trunk — bilateral)
5. Visibility-aware bilateral selection (bestSide/bestSideMax with 0.6 threshold)
6. Exercise auto-detection via angle signature classification
7. Rep counting via valley detection (two-pass adaptive spacing: 1.2s generous, 2.5s tight)
8. 5-stage FSM for live mode (angular velocity thresholds at 15 deg/s, isometric hold at 8 frames)
9. Form checks evaluated per rep against exercise-specific thresholds
10. Set-level biomechanics: velocity curves, ROM consistency, asymmetry, fatigue index
11. Progression scoring (0-1000 scale, form + power + fatigue + improvement)

### UI Architecture
- Hash-based routing (dashboard, analyze, log, history, rest, profile, validate)
- Lazy-loaded route components
- Design system: bioluminescent dark theme (void black #0a0a0f, bio-cyan #00f5d4, bio-green #00e676)
- Glass-morphism with backdrop-filter (GPU-aware: disabled on low-end Android)
- i18n: English + French (600+ strings)
- Fully offline: all data in IndexedDB, model cached after first download

### What Has Been Shipped (As Of September 2026)
- Video upload analysis with AI overlay replay
- 274 exercises with form checks and scientific citations
- Kalman-filtered pose detection
- Web Worker offloading for inference
- Audio feedback during replay (rep-complete tones, form warnings)
- Velocity-aware biomechanical state machine
- Adaptive rep counting (handles fast and slow tempos)
- Manual exercise logging
- Workout history with deletion
- Rest timer with audio alerts
- User profiles with baseline tracking
- Onboarding flow
- Design demo mode
- Validation/diagnostic mode

### What Has NOT Been Shipped
- Live camera real-time mode (architecture exists, not production-ready)
- 3D pose lifting (2D landmarks only)
- Equipment detection
- Anthropometric normalization
- Mesocycle periodization
- Chronic:Acute Workload Ratio
- Data export / interoperability
- Shareable visual artifacts
- Sound identity / sonic branding
- Movement screen at onboarding
- Menstrual cycle integration
- Cross-device sync

---

## Review Board Structure

Seven councils. Each council has a specific mandate, specific named members, and a specific deliverable. The councils do not agree with each other by default — disagreement between councils is signal, not noise.

### COUNCIL 1: SYSTEMS ARCHITECTURE (15 members)
**Mandate:** Review the entire software architecture for correctness, performance, scalability, and maintainability. Find race conditions, memory leaks, thread safety issues, and architectural debt. Every finding must include a severity rating (critical / major / minor) and a concrete fix.

**Named Members:**
1. **Linus Torvalds** — Linux kernel, git. Focus: memory management, caching strategy, build pipeline.
2. **John Carmack** — id Software, Oculus. Focus: frame budget, latency, real-time rendering pipeline.
3. **Margaret Hamilton** — Apollo AGC. Focus: fault tolerance, graceful degradation, safety-critical paths.
4. **Ken Thompson** — Unix, C, Go. Focus: unnecessary complexity, what to remove.
5. **Barbara Liskov** — LSP, data abstraction. Focus: interface contracts, substitutability.
6. **Leslie Lamport** — Distributed systems, TLA+. Focus: concurrency, state consistency, race conditions.
7. **Jeff Dean** — Google infrastructure, TensorFlow. Focus: ML model serving, inference optimization.
8. **Fabrice Bellard** — FFmpeg, QEMU. Focus: video pipeline efficiency, unnecessary copies.
9. **Rob Pike** — Go, Plan 9. Focus: concurrency model, message passing, worker isolation.
10. **Anders Hejlsberg** — TypeScript, C#. Focus: type safety, nominal types for coordinates and angles.
11. **Brendan Eich** — JavaScript, browser platform. Focus: CSP, security posture, platform API usage.
12. **Dave Patterson** — RISC, ML hardware. Focus: hardware delegation (WebNN, WebGPU), device capability detection.
13. **Bryan Cantrill** — DTrace, Oxide. Focus: observability, debugging, production diagnostics.
14. **Rich Harris** — Svelte, SvelteKit. Focus: bundle size, hydration cost, framework overhead.
15. **Evan You** — Vue, Vite. Focus: build optimization, code splitting, HMR, dev experience.

**Deliverable:** Ranked list of architectural issues with severity, concrete fix for each, and estimated engineering effort (hours). Identify the single highest-leverage architectural change.

---

### COUNCIL 2: COMPUTER VISION & SIGNAL PROCESSING (15 members)
**Mandate:** Review the pose estimation pipeline, rep counting algorithm, exercise detection heuristics, and all signal processing. Find accuracy failures, aliasing issues, viewpoint dependencies, and missing capabilities. Every finding must reference the specific code path it affects.

**Named Members:**
1. **Deva Ramanan** — CMU, human pose estimation. Focus: pose model selection, landmark quality.
2. **Jitendra Malik** — UC Berkeley, computational vision. Focus: 2D vs 3D, depth ambiguity.
3. **Yann LeCun** — Meta/NYU, deep learning. Focus: representation learning, joint embeddings.
4. **Valentin Bazarevsky** — Google, MediaPipe/BlazePose creator. Focus: correct usage of the model he built.
5. **Cordelia Schmid** — INRIA/Google, action recognition. Focus: temporal modeling, dense trajectories.
6. **Kaiming He** — Meta AI, ResNet. Focus: learned form scoring vs threshold lookup.
7. **Christian Szegedy** — Google Brain, Inception. Focus: signal processing, adaptive filtering.
8. **Alexei Efros** — UC Berkeley, self-supervised learning. Focus: personalized baselines, anomaly detection.
9. **Angjoo Kanazawa** — UC Berkeley, HMR. Focus: body shape recovery, SMPL fitting.
10. **Yaser Sheikh** — CMU/Meta Reality Labs, OpenPose. Focus: multi-person, mirror handling.
11. **Ross Girshick** — Meta AI, R-CNN. Focus: motion-gated inference, compute scheduling.
12. **Vladlen Koltun** — Apple, depth estimation. Focus: monocular depth, camera pose.
13. **Christoph Feichtenhofer** — Meta AI, SlowFast. Focus: multi-temporal-scale processing.
14. **Bangpeng Yao** — Stanford/Google. Focus: equipment detection, object-exercise interaction.
15. **Lourdes Agapito** — UCL, non-rigid SfM. Focus: fatigue signal extraction from detrending.

**Deliverable:** For each finding, specify: (a) the failure scenario, (b) the code path affected, (c) the fix with algorithmic complexity, (d) accuracy improvement estimate. Rank by impact on rep counting accuracy.

---

### COUNCIL 3: BIOMECHANICS & SPORTS SCIENCE (15 members)
**Mandate:** Review the exercise definitions, form checks, thresholds, injury logic, and training programming features for scientific validity. Find biomechanically invalid thresholds, missing safety checks, and opportunities to surface clinically meaningful insights. Every finding must cite peer-reviewed evidence.

**Named Members:**
1. **Dr. Andy Galpin** — UC Santa Barbara, muscle physiology. Focus: velocity-based training, fiber type.
2. **Dr. Brad Schoenfeld** — CUNY Lehman, hypertrophy. Focus: mechanical tension, eccentric loading, ROM.
3. **Dr. Stuart McGill** — Waterloo, spine biomechanics. Focus: injury screening, spinal loading.
4. **Dr. Kelly Starrett** — The Ready State, mobility. Focus: restriction patterns, upstream causes.
5. **Dr. Mike Israetel** — Renaissance Periodization. Focus: volume landmarks, mesocycle structure.
6. **Mark Rippetoe** — Starting Strength. Focus: anthropometric normalization, movement standards.
7. **Dr. Vladimir Zatsiorsky** — Penn State, biomechanics. Focus: force-velocity profiling.
8. **Frans Bosch** — Motor learning. Focus: coordinative variability, inter-rep variation.
9. **Dr. Dan Baker** — Australian S&C, VBT. Focus: velocity loss thresholds, autoregulation.
10. **Dr. Tim Gabbett** — ACWR research. Focus: workload ratios, injury risk quantification.
11. **Dr. Keith Barr** — UC Davis, connective tissue. Focus: tendon loading, recovery timelines.
12. **Dr. Stacy Sims** — Female physiology. Focus: menstrual cycle, sex-specific adaptation.
13. **Greg Nuckols** — Stronger by Science. Focus: uncertainty quantification, error propagation.
14. **Dr. Eric Helms** — AUT, evidence-based training. Focus: nutrition-training integration.
15. **Mel Siff** — Supertraining. Focus: four-phase tempo, isometric detection.

**Deliverable:** For each of the 274 exercises, rate the form check validity (valid / partially valid / invalid / missing critical check). Produce a prioritized list of the 20 most impactful sports science features ranked by user safety first, then training effectiveness.

---

### COUNCIL 4: PRODUCT DESIGN & UX (15 members)
**Mandate:** Review every user-facing screen, interaction pattern, and information architecture for usability, accessibility, emotional design, and competitive positioning. Every finding must specify the user scenario it affects and the design principle it violates.

**Named Members:**
1. **Jony Ive** — Apple CDO. Focus: material honesty, reduction, the relationship between form and function.
2. **Don Norman** — The Design of Everyday Things. Focus: affordances, signifiers, mapping, feedback.
3. **Dieter Rams** — Braun, ten principles. Focus: what to remove, environmental responsibility.
4. **Bret Victor** — Inventing on Principle. Focus: direct manipulation, immediate feedback.
5. **Luke Wroblewski** — Mobile-first, Google. Focus: thumb zones, one-handed operation, progressive disclosure.
6. **Sarah Drasner** — Netlify VP DX. Focus: animation meaning, transition design.
7. **Susan Kare** — Macintosh icons. Focus: iconography, visual language clarity.
8. **Julie Zhuo** — Facebook VP Design. Focus: emotional arc, session design, completion states.
9. **Vitaly Friedman** — Smashing Magazine. Focus: information architecture, interaction complexity management.
10. **Aarron Walter** — Designing for Emotion. Focus: onboarding, trust building, delight.
11. **Tobias van Schneider** — Spotify design. Focus: warmth in dark UI, post-workout emotional design.
12. **Val Head** — Interface animation. Focus: reduced-motion, vestibular sensitivity, accessibility.
13. **Rasmus Andersson** — Inter typeface, Figma. Focus: typography on OLED, dark-mode legibility.
14. **Adam Wathan** — Tailwind CSS. Focus: design token systematization, visual consistency enforcement.
15. **Mike Monteiro** — Design ethics. Focus: camera privacy, data transparency, trust indicators.

**Deliverable:** Screen-by-screen review (dashboard, analyze, replay, log, history, profile, onboarding, live camera). For each screen: what works, what fails, what's missing, and a wireframe description of the ideal state. Identify the three screens that most need redesign.

---

### COUNCIL 5: BRAND, AESTHETIC & CULTURAL POSITIONING (10 members)
**Mandate:** Evaluate WorkoutVision's potential as a cultural product, not just a utility. Assess the bioluminescent design language, sonic identity (or lack thereof), shareability, and competitive moat. Every finding must reference a comparable product or cultural precedent.

**Named Members:**
1. **Hideo Kojima** — Death Stranding. Focus: lore, world-building, the AI's personality.
2. **Shigeru Miyamoto** — Nintendo. Focus: the primary metric, what users tell friends, game feel.
3. **Virgil Abloh** — Off-White/LV. Focus: the 3% rule, scarcity of frequency, drop culture.
4. **Jenova Chen** — Journey, Flow. Focus: felt progression, environmental response to mastery.
5. **Neri Oxman** — MIT Media Lab. Focus: anatomical grounding, biological authenticity of the visual grammar.
6. **Refik Anadol** — Data sculpture. Focus: making the AI visible, the inference process as art.
7. **Pharrell Williams** — Creative direction. Focus: frequency protection, cultural temperature.
8. **Emily Weiss** — Glossier. Focus: the emotional hook of being seen, the first-second experience.
9. **Ryan Hoover** — Product Hunt. Focus: the Day One sharing problem, virality mechanics.
10. **Jonathan Blow** — Braid, The Witness. Focus: what genuinely requires machine intelligence, what humans already know.

**Deliverable:** A brand architecture document: (a) the one-sentence positioning, (b) the three things WorkoutVision does that no competitor does, (c) the shareable moment, (d) the sonic identity specification, (e) the progression metric design, (f) the competitive moat analysis against Apple Fitness+, Whoop, Tempo, Future, and Form.

---

### COUNCIL 6: MARKET VIABILITY & BUSINESS MODEL (10 members)
**Mandate:** Assess whether this product can sustain a business. Evaluate monetization, distribution, retention, and competitive dynamics. Be ruthless about what the market actually pays for versus what engineers think is impressive.

**Named Members:**
1. **Marc Andreessen** — a16z. Focus: market timing, platform risk, defensibility.
2. **Ben Thompson** — Stratechery. Focus: aggregation theory, distribution, platform dependency.
3. **Patrick Collison** — Stripe. Focus: developer experience as moat, API-first thinking.
4. **Daniel Ek** — Spotify. Focus: freemium conversion, engagement metrics, retention curves.
5. **Tobi Lutke** — Shopify. Focus: merchant tools, enabling commerce, platform economics.
6. **Stewart Butterfield** — Slack. Focus: bottom-up adoption, the "aha moment" timing.
7. **Melanie Perkins** — Canva. Focus: democratizing professional tools, template economics.
8. **Whitney Wolfe Herd** — Bumble. Focus: trust, safety-first design, female user acquisition.
9. **Brian Chesky** — Airbnb. Focus: experience design, the 11-star experience framework.
10. **Kevin Systrom** — Instagram. Focus: the one filter that matters, constraint as product strategy.

**Deliverable:** (a) Total addressable market sizing. (b) Monetization model recommendation (subscription / freemium / one-time / API). (c) The 30-day retention prediction based on current feature set. (d) The single feature most likely to drive word-of-mouth. (e) The three competitors that could kill this and how to survive them. (f) Distribution strategy for a zero-marketing-budget solo developer.

---

### COUNCIL 7: SECURITY, PRIVACY & ETHICS (5 members)
**Mandate:** Audit the application for security vulnerabilities, privacy risks, and ethical concerns. A fitness app with camera access running in the user's home has an elevated trust contract.

**Named Members:**
1. **Bruce Schneier** — Applied Cryptography. Focus: threat model, data-at-rest encryption, camera access scope.
2. **Moxie Marlinspike** — Signal. Focus: minimal data collection, privacy by design, what should never be stored.
3. **Latanya Sweeney** — Harvard, data privacy. Focus: re-identification risk from workout patterns and body measurements.
4. **danah boyd** — Microsoft Research. Focus: body image, eating disorders, at-risk populations, age verification.
5. **Alex Stamos** — Stanford, former Facebook CSO. Focus: CSP headers, dependency supply chain, CDN trust.

**Deliverable:** (a) Threat model for a camera-enabled fitness PWA. (b) Specific CSP and Permissions-Policy header recommendations. (c) Data minimization checklist (what should and should not persist in IndexedDB). (d) Ethical risk assessment for body-measurement features. (e) Age-gating and body-image safeguard recommendations.

---

## Review Procedure (Gates)

The review proceeds through five gates. A council's findings at one gate inform the next gate's review. This is not parallel — it is sequential and cumulative.

### GATE 1: TECHNICAL CORRECTNESS
Councils 1 (Systems) and 2 (CV) audit the codebase for bugs, race conditions, accuracy failures, and architectural debt. Output: a ranked issue list with severity.

### GATE 2: SCIENTIFIC VALIDITY
Council 3 (Sports Science) reviews every exercise definition, form check threshold, and training logic for biomechanical validity. Output: exercise-by-exercise validity rating and the 20 highest-priority sports science features.

### GATE 3: USER EXPERIENCE
Council 4 (Design) reviews every screen and interaction pattern. Incorporates Gate 1 findings (performance issues that affect UX) and Gate 2 findings (invalid form feedback that misleads users). Output: screen-by-screen redesign specification.

### GATE 4: MARKET READINESS
Councils 5 (Brand) and 6 (Market) assess whether the product — with Gate 1-3 fixes applied — would compete in the current market. Output: positioning, monetization, distribution, and the competitive moat analysis.

### GATE 5: TRUST & SAFETY
Council 7 (Security/Privacy/Ethics) audits the product for risks that would prevent responsible shipping. Output: the trust checklist that must clear before public launch.

---

## Final Deliverable: The Roadmap

After all five gates, produce a unified roadmap organized into three phases:

### Phase 1: SHIP-READY (fixes required before any public launch)
- Critical bugs and safety issues from Gate 1
- Biomechanically dangerous form checks from Gate 2
- UX failures that would cause immediate churn from Gate 3
- Security/privacy issues from Gate 5

### Phase 2: MARKET-ENTRY (features required to compete)
- The 10 highest-impact features across all councils
- The brand architecture and sonic identity from Gate 4
- The monetization model from Gate 6

### Phase 3: MOAT-BUILDING (features that make the product irreplaceable)
- 3D pose lifting
- VBT autoregulation
- Personalized form baselines
- The proprietary progression metric
- Equipment detection
- Cross-session learning

For each item in all three phases, specify:
- What it is (one sentence)
- Why it matters (which council demanded it and why)
- Engineering effort estimate (small / medium / large / massive)
- Dependencies (what must be built first)
- Success metric (how to know it's working)

---

## Constraints on the Review

1. **Every named expert speaks in their own voice.** Carmack talks about latency. Rams talks about reduction. McGill talks about spinal loading. Do not homogenize.
2. **Disagreements between experts are preserved, not resolved.** If Carmack says "downsample to 320x240" and Bazarevsky says "you need full resolution for foot landmarks," both positions stand and the resolution is flagged as a design decision.
3. **No flattery.** The review board's job is to find what's wrong, what's missing, and what's mediocre. Compliments are earned by specific technical merit, not by effort or ambition.
4. **Every finding is actionable.** "The architecture is not scalable" is not a finding. "The RepCounter class couples exercise-specific thresholds with the counting algorithm, preventing exercise substitution without modifying counting logic — refactor into ExerciseProtocol interface + generic counter" is a finding.
5. **Cite evidence.** Sports science findings cite papers. CV findings cite model architectures. Design findings cite the specific design principle violated.
6. **This review should be long.** 3000+ words per council. The total output should be 25,000-40,000 words. This is the document that determines whether the product ships or pivots. It is not a summary.

---

## The Thesis Being Tested

> One developer, with AI tooling, built a 274-exercise biomechanical analysis PWA with on-device pose estimation, Kalman filtering, velocity-aware rep counting, Web Worker inference offloading, and audio feedback — from scratch, in months, not years.

> The question is not whether this is impressive. The question is whether it is **good enough to ship as a product that people pay for and tell their friends about** — and if not, exactly what stands between here and there.

> The return on this review is not academic. It is the roadmap for a product that either enters the market as a serious tool or remains a technical demonstration. The 85 experts assembled here are the filter. Their collective judgment is the standard.

---

*End of prompt. Feed this document to Claude with the instruction: "Execute this review. Every council member speaks. Every gate produces its deliverable. The final roadmap is the output."*

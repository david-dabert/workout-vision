# WorkoutVision Think Tank Report

*Five councils. 100 minds. One product.*
*Compiled 2026-08-30.*

---

# COUNCIL 1: DEV ENGINEERING (20 Members)

## The Panel

**1. Linus Torvalds** *(Linux kernel, git, systems performance)*

Your 30MB WASM blob loaded from CDN at session start is amateur hour. Cache it in IndexedDB on first load, yes, but you're not versioning the cache invalidation properly — when the model updates, stale WASM will silently serve wrong inference for weeks. Use a content-addressed cache key derived from the model file hash, not a version string you forget to bump. And your main thread is blocking on WASM init; move it to a Worker or you've already lost me.

**2. John Carmack** *(id Software, Oculus, real-time rendering, latency obsession)*

30fps pose inference on a 720p feed is your ceiling and you're accepting it as fate. You should be running inference on downsampled 320x240 frames — human pose landmarks don't need pixel-perfect resolution, they need temporal consistency. Halve your input resolution, double your inference cadence, run a Kalman filter over the landmark stream, and your rep counter will be smoother and faster simultaneously. Latency is the experience; you're leaving 40ms on the table by processing full-res frames.

**3. Margaret Hamilton** *(Apollo Guidance Computer, software reliability, fault tolerance)*

Your injury awareness layer has no defined failure mode. What happens when MediaPipe returns low-confidence landmarks mid-rep? Your system silently continues counting on bad data. Every safety-critical path — particularly the joint angle thresholds that trigger injury warnings — needs an explicit confidence gate with a defined degraded-mode behavior: pause counting, surface a warning, log the dropout. "It worked in testing" is not an argument; the AGC didn't have that luxury either.

**4. Ken Thompson** *(Unix, C, Go, simplicity as a design principle)*

You have exercise-specific signal priority maps, autocorrelation passes, multi-signal fusion, AND a hysteresis layer. Each of those is a moving part that can break independently and interact in ways you cannot predict. I would take one signal — the primary joint angle for each movement — implement it correctly and robustly, ship that, and add complexity only when the simple version provably fails. Your architecture diagram reads like it was designed to impress, not to work.

**5. Barbara Liskov** *(CLU, object-oriented design, Liskov Substitution Principle, data abstraction)*

Your exercise models — squat, deadlift, curl — almost certainly share a common behavioral contract but I'd wager your RepCounter class exposes concrete exercise names rather than an abstract interface. The moment you add a new movement, you're patching conditionals. Define an `ExerciseProtocol` with explicit pre/post conditions on what a valid "rep cycle" means: entry angle, exit angle, minimum ROM, hold duration. Substituting a new exercise should require zero changes to counting logic.

**6. Donald Knuth** *(The Art of Computer Programming, TeX, algorithmic analysis)*

You are using autocorrelation for rep counting without, I suspect, having formally analyzed the computational complexity of your implementation against the real-time frame budget. Autocorrelation on a 30-second sliding window at 30fps is O(n²) if implemented naively. A proper FFT-based autocorrelation is O(n log n) and your window fits in L1 cache if you're disciplined about your buffer sizes. Measure before you optimize, but measure correctly — instrument the actual inference-to-count pipeline latency, not just the model forward pass.

**7. Bjarne Stroustrup** *(C++, zero-cost abstractions, type systems)*

Your multi-signal fusion weights are, I assume, magic numbers hardcoded somewhere in a configuration object. That is a type-safety disaster. Model those weights as a strongly-typed `SignalFusionConfig` with validated ranges at construction time — not at runtime, not in a try/catch. The type system is your first line of defense against a weight of 1.3 slipping into a field that expects a value between 0 and 1. JavaScript gives you TypeScript; use it as if your safety depends on it, because your users' joints do.

**8. Grace Hopper** *(first compiler, COBOL, debugging, making computers accessible)*

Your multilingual interface is a feature, not an implementation. Fitness cueing language is not a direct translation problem — "keep your chest up" in English carries biomechanical specificity that a naive i18n string replacement will mangle in Arabic or Japanese. You need native-speaker-reviewed fitness-domain translations, not google-translated strings with an `i18next` wrapper. And your voice cues — if you have them — must account for phoneme timing in each language, because a cue that arrives 200ms late in German arrives even later when the TTS engine is generating longer syllable chains.

**9. Alan Kay** *(Smalltalk, OOP, the personal computer, messaging)*

You built a pose detection app that knows what a squat is. That is the wrong level of abstraction. A truly revolutionary architecture would allow the system to learn what a squat is — from the user's own movement pattern — and represent it as a first-class object that can be modified, shared, and composed. Your exercise models should be live, editable message-passing objects, not compiled-in state machines. The computer should be a medium for extending human movement literacy, not a pre-programmed judge.

**10. Tim Berners-Lee** *(World Wide Web, HTTP, open data, linked data)*

You store workouts in IndexedDB with a schema you invented. In six months, users cannot export their data to any other fitness tool without writing custom code. Define your workout data model against an open schema — schema.org `ExerciseAction` and `ExercisePlan` exist — and export as JSON-LD by default. The web's value is interoperability. An offline-first app that silos its data in a proprietary IndexedDB format is philosophically identical to a walled garden, just with worse tooling.

**11. Rob Pike** *(Plan 9, Go, Unix philosophy, concurrency)*

You have a single JavaScript file, I presume, or a component tree where pose detection, rep counting, form scoring, nutrition tracking, and barcode scanning are coupled by shared state. Those are four distinct concurrent concerns. In Go we'd model them as independent goroutines communicating over channels. In your architecture, use Web Workers with a strict message-passing protocol — no shared mutable state between pose inference, rep counting, and UI rendering. When your barcode scanner causes a frame drop in pose detection, you'll understand why isolation matters.

**12. Leslie Lamport** *(distributed systems, TLA+, Paxos, formal specification)*

Your rep counting has a race condition you haven't thought about: the "finalize" autocorrelation pass runs asynchronously against the live hysteresis counter. On a slow device, the finalize pass may complete and emit a rep count that conflicts with the live count mid-set. You have two concurrent writers to the same rep state with no defined consistency model. Specify — formally, even if informally documented — which writer wins under which conditions, and enforce it with a single authoritative state machine, not two parallel ones that hope to agree.

**13. Guido van Rossum** *(Python, readability, the principle of least surprise)*

Your API for defining a custom exercise — if one exists — is almost certainly not obvious to a developer who wants to extend this app. The configuration surface for "add a new exercise" should be so readable that a sports physiotherapist who writes occasional scripts can define a movement pattern without understanding your internal signal fusion architecture. Readability is not aesthetic; it is the mechanism by which your app survives your own absence from the codebase.

**14. Brendan Eich** *(JavaScript, browser platform, ECMAScript)*

You're using MediaPipe WASM via a CDN script tag, which means your Content Security Policy is either absent or set to `unsafe-eval` because WASM instantiation requires `wasm-unsafe-eval`. You have a security surface on a fitness app that runs a live camera feed — an app where users have implicitly trusted you with their physical space. Tighten the CSP to `wasm-unsafe-eval` specifically, reject `unsafe-eval` globally, and add a `permissions-policy` header that explicitly scopes camera access. The platform gives you these tools; not using them is negligence.

**15. Jeff Dean** *(Google's large-scale ML infrastructure, MapReduce, Bigtable, TensorFlow)*

Your single 30MB model is doing full-body pose detection for every exercise. That is architecturally wasteful. A two-stage approach — a lightweight 2MB detector that identifies which body region is active for the current exercise, followed by a specialized 8-12MB model for that region — would reduce inference time by 40-60% and allow you to serve higher-accuracy models for the joints that actually matter for a given movement. Model selection should be dynamic based on the exercise context, not static.

**16. Fabrice Bellard** *(QEMU, FFmpeg, TinyCC — doing more with less, radical efficiency)*

Your camera pipeline goes: browser MediaStream → canvas drawImage → ImageBitmap → MediaPipe. That is two unnecessary copies of the frame data before inference. Use `VideoFrame` from the WebCodecs API directly — MediaPipe Tasks Vision supports it — and you eliminate the canvas intermediate copy entirely. On a mid-range Android device, that copy is 4-8ms per frame. At 30fps that is 120-240ms per second spent moving pixels you never needed to move.

**17. Vint Cerf** *(TCP/IP, internet architecture, protocol design)*

Your app is "no backend, no account" — which I respect as a privacy position — but you have not designed for the failure mode where a user's device is stolen or fails and they lose all workout history. Define a user-controlled sync protocol: encrypted export to a file, QR code for cross-device transfer, or optional WebRTC peer-to-peer sync with a paired device. The principle of end-to-end design means you think about both endpoints of the user's data journey, not just the happy path where nothing breaks.

**18. Dave Patterson** *(RISC architecture, computer memory systems, ML hardware)*

You are running WASM inference on a CPU without querying whether the device has a WebNN backend or a WebGPU compute shader path available. Chrome 113+ exposes WebNN; Safari exposes Metal via WebGPU. MediaPipe Tasks Vision can delegate to these paths if you configure the `delegate` option at model initialization. On an iPhone 14 with Neural Engine delegation, your inference time drops from ~33ms to ~8ms. That is not an optimization; it is using the hardware the user already paid for.

**19. Anders Hejlsberg** *(Turbo Pascal, Delphi, C#, TypeScript)*

Your TypeScript types for landmark coordinates are almost certainly `number[]` or `{x: number, y: number, z: number}[]` — generic number types that carry no information about coordinate space, normalization, or confidence. Define nominal types: `NormalizedLandmark`, `WorldLandmark`, `JointAngleDegrees`. A function that accepts `number` for an angle and receives a normalized coordinate between 0 and 1 will silently compute garbage. TypeScript's type system is strong enough to prevent this entire class of bug at zero runtime cost.

**20. Yukihiro Matsumoto** *("Matz," Ruby, principle of least surprise, developer happiness)*

A developer who wants to add a new exercise to WorkoutVision should experience delight, not archaeology. If they must read your autocorrelation implementation to understand why their new exercise counts reps incorrectly, you have made them pay for your architectural decisions. The exercise definition interface should be a small, joyful DSL — something like `define_exercise :overhead_press, primary_joint: :elbow, rom: (70..180), tempo: :controlled` — that hides every signal fusion detail behind a humane surface. Make the right thing feel natural.

## Synthesis: 10 Most Impactful Engineering Changes

**1. Resolve the dual-writer rep count race condition (Lamport + Hamilton)**
Collapse the live hysteresis counter and the finalize autocorrelation pass into a single authoritative state machine. Define explicitly which source wins — finalize always overrides, or live count is the floor with finalize as a ceiling correction. Implement a confidence gate: if landmark confidence drops below threshold mid-rep, freeze the state and surface a degraded-mode warning rather than counting on bad data. This is your most dangerous silent failure.

**2. Route MediaPipe inference to WebNN / WebGPU hardware delegation (Patterson + Carmack)**
At model initialization, query `navigator.ml` for WebNN availability and set `delegate: 'GPU'` or `delegate: 'NNAPI'` accordingly. Fall back to WASM CPU only when hardware delegation is unavailable. Simultaneously, downsample input frames to 320x240 for inference while maintaining full-resolution display. Combined, these two changes reduce per-frame inference time by 50-75% on modern devices — making 60fps inference viable without new hardware.

**3. Eliminate the frame copy pipeline via WebCodecs VideoFrame (Bellard + Carmack)**
Replace the `canvas.drawImage → ImageBitmap` path with direct `VideoFrame` input to MediaPipe Tasks Vision. This removes 4-8ms of memory copy overhead per frame. On constrained devices, this is the difference between dropping frames and maintaining cadence.

**4. Implement content-addressed WASM + model cache invalidation (Torvalds + Berners-Lee)**
Hash the model binary on first download; store the hash as the IndexedDB cache key. On app load, compare the expected hash (embedded in your build artifact) against the cached key. Stale cache is detected deterministically, not by version strings.

**5. Define a strongly-typed exercise protocol with formal pre/post conditions (Liskov + Hejlsberg + Stroustrup)**
Define `ExerciseProtocol` as a TypeScript interface with nominal types — `JointAngleDegrees`, `NormalizedRepCycle`, `ConfidenceScore`. All exercise implementations satisfy this interface; the rep counting engine consumes only the interface. New exercises require zero changes to counting logic.

**6. Isolate concurrent concerns into Web Workers with message-passing (Pike + Lamport)**
Pose inference, rep counting, form scoring, and barcode scanning run in separate Web Workers. The main thread handles only rendering and UI state. Workers communicate via `postMessage` with a strict, typed message schema — no shared mutable state.

**7. Replace the flat signal fusion weight map with a validated, typed DSL (Matsumoto + van Rossum + Knuth)**
Define exercise configurations as a small declarative structure: primary joint, ROM bounds, signal priorities, tempo classification. Run complexity analysis on the autocorrelation implementation: if it is O(n²), replace with FFT-based autocorrelation.

**8. Implement a two-stage model architecture with exercise-contextual model selection (Dean + Carmack)**
Replace the single 30MB full-body model with a lightweight 2MB activity classifier that identifies the active body region, followed by dynamically loaded 8-12MB specialized models per region group.

**9. Define workout data against open schema with encrypted portable export (Berners-Lee + Cerf)**
Map the IndexedDB data model to `schema.org/ExerciseAction` and export as JSON-LD. Add a one-tap "Export workout history" function. Add optional encrypted QR-code-based cross-device transfer.

**10. Harden the security posture for a camera-access application (Eich + Hamilton)**
Set `Content-Security-Policy: default-src 'self'; wasm-unsafe-eval`. Add `Permissions-Policy: camera=(self)`. A fitness app that runs a live camera feed inside the user's home has a higher implicit trust contract than a weather widget.

---

# COUNCIL 2: FRONTEND & UX DESIGN (20 Members)

## The Panel

**1. Jony Ive** *(Former Chief Design Officer, Apple)*

The bioluminescent glow is doing the work that substance should do. When every surface glows, nothing glows — you've created an aesthetic flatness disguised as depth. I'd ask what the glass-morphism cards actually *are* in the user's mental model; if they can't answer that in one word, the material is lying to them. Strip one layer of effect and earn the next one back.

**2. Dieter Rams** *(Braun — ten principles, "less but better")*

You have applied decoration where function was sufficient. The cyan glow on a stat card communicates nothing that the number itself does not already communicate — it is noise wearing the costume of signal. Good design is as little design as possible; I would remove every glow that does not correspond to a state change the user needs to act on.

**3. Don Norman** *(Author of The Design of Everyday Things)*

The bottom tab bar presents five icons and expects the user to build a correct mental model of the app's architecture from iconography alone. That is a mapping failure. A fitness novice opening this app does not know what distinguishes "Dashboard" from "History" from "Profile" at a glance — and in the live camera training mode, the cognitive cost of that uncertainty becomes a physical safety issue. Labels are not a failure of design confidence; they are feedback.

**4. Susan Kare** *(Original Macintosh icon designer)*

The muscle map is your most powerful visual asset and almost certainly your most ambiguous one. If a user taps the deltoid and nothing happens that they could have predicted, the icon — the entire illustrated body — has failed as a symbol. Icons must behave the way they look. Every tappable region on that muscle map needs a hover/press state so legible that a twelve-year-old could understand the interaction model without instruction.

**5. Sarah Drasner** *(VP of Developer Experience, Netlify)*

Spring animations are not a design system — they're a physics engine. Right now your transitions probably feel *good* without feeling *meaningful*. The animation on navigating from Dashboard to Live Camera should feel categorically different from navigating to History: one is moving forward into something active and high-stakes, the other is looking backward. Use easing and duration to encode the direction and emotional register of each transition.

**6. Vitaly Friedman** *(Smashing Magazine founder)*

A mobile-first PWA with a live camera mode, skeleton overlay, AI analysis, and manual logging is carrying interaction complexity that a bottom tab bar cannot support gracefully past three features. You need a progressive disclosure architecture: surface the one thing the user should do *right now* (probably: start a session), and let everything else recede behind one deliberate gesture.

**7. Refik Anadol** *(Data sculptor, machine learning aesthetics)*

The AI in this product is invisible, which is a missed opportunity of extraordinary scale. When the skeleton overlay renders on the live camera, the user should *feel* the machine seeing them — the inference process itself is beautiful and trust-building if visualised correctly. A subtle point-cloud materialisation on detection, a confidence-mapped colour wash on the skeleton joints, turns a technical output into an emotional experience.

**8. Bret Victor** *(Inventing on Principle — immediate feedback)*

Your manual logging screen is almost certainly a form. Forms are the opposite of what this product promises. A fitness app that asks a user to type "3 sets x 8 reps x 185 lbs" into text inputs after they've just physically exerted themselves is a UX betrayal. Every manual input should be a direct manipulation: a draggable rep counter, a sliding weight selector anchored to their previous session, a one-tap "same as last time."

**9. Paula Scher** *(Pentagram — typographic authority)*

Your typography is doing nothing. In a dark bioluminescent UI with cyan accents, the type is probably white or near-white at one or two weights — which means every number, every label, every heading is competing on equal visual footing. A 235 lb personal record and a "Last 7 days" label should not occupy the same typographic register. Give your key metrics a typeface treatment so distinct that the user can read their most important number from arm's length.

**10. Mike Monteiro** *(Mule Design — design ethics)*

If this app uses the camera continuously during training, the user needs to understand what is happening to that video stream at every moment — not in a privacy policy, in the interface itself. A persistent, non-dismissible indicator of camera state (recording / analysing / off) is not a legal courtesy, it is a basic act of respect.

**11. Yugo Nakamura** *(Interactive net artist — browser as material)*

The void background (#0a0a0f) is passive. You are calling this bioluminescent, but bioluminescence is *alive* — it responds to pressure, to proximity, to the organism's state. The background of a fitness app during an active session should be subtly, almost subliminally different from the background at rest. A very slow, very low-amplitude noise field that increases in intensity as session duration grows transforms the app from a static skin into something that feels like it's breathing alongside the user.

**12. Aarron Walter** *(Author of Designing for Emotion)*

The onboarding flow is the first and most important emotional contract you make with a new user. If it asks for weight, goals, and fitness level before it has given the user a single moment of delight or capability, you've started the relationship transactionally. Lead with one thing the app can do for them *immediately* — show the muscle map, let them tap it — before you ask for anything. Earn the data.

**13. Luke Wroblewski** *(Mobile-first pioneer, Google PM)*

During live training, the user's dominant hand is not available. The entire live camera training UI must be operable with the non-dominant thumb in the lower-left or lower-right zone exclusively — no buttons in the top 40% of the screen during an active session. If a user has to adjust their grip to hit a "pause" button while holding a dumbbell, someone is getting hurt and blaming your app.

**14. Tobias van Schneider** *(Designer, Spotify alumni)*

The bioluminescent aesthetic is coherent and premium, but it is emotionally cold. Fitness is sweat and effort and failure and small victories — all of which are warm, embodied, human things. One injection of warmth: the post-workout summary screen should feel categorically different from the rest of the app. Warmer colour temperature, slightly looser layout. The contrast makes the achievement feel real.

**15. Chris Coyier** *(CSS-Tricks founder, CodePen co-founder)*

Glass-morphism and backdrop-filter are still GPU-expensive on mid-range Android devices. If your beautiful card blur is causing dropped frames during the skeleton overlay render — which it will, because you're compositing two GPU-heavy layers — you need a reduced-motion and reduced-effects code path that degrades gracefully. Performance is a UX decision, not an engineering afterthought.

**16. Ellen Lupton** *(Graphic designer, author of Thinking with Type)*

Your grid is probably doing what grids do by default, which is align things without meaning them. A muscle map next to a stat card next to a progress ring is a collection of objects, not a layout with argument. The spatial relationship between those elements should tell a story: the muscle map is the body, the stats are what the body did, the ring is where the body is going.

**17. Adam Wathan** *(Tailwind CSS creator)*

Your design tokens — the specific cyan (#00f5d4), the card blur values, the glow spread radii — are either not systematised or not enforced. Define a scale of five glow intensities, name them semantically (glow-rest, glow-active, glow-alert, glow-success, glow-peak), and use nothing else. Visual coherence at this level is not aesthetic — it's communicative.

**18. Jen Simmons** *(Apple / Mozilla — CSS layout)*

You are building a PWA that will be installed on phones, tablets, and occasionally someone's desktop browser. Your layout is almost certainly flexbox columns that reflow awkwardly at tablet widths. CSS Grid with intrinsic sizing would let the muscle map and the stat panel compose themselves correctly at every viewport without media-query breakpoint hacking.

**19. Val Head** *(Animation consultant, author of Designing Interface Animation)*

You need a prefers-reduced-motion implementation that is not just "turn off animations." For a user who has vestibular sensitivity, the skeleton overlay tracking their body in real time is already a motion-rich experience. Offer an explicit "reduced effects" mode in settings that downgrades the skeleton to a static joint-point overlay, reduces glow to flat colour, and disables background animation.

**20. Rasmus Andersson** *(Designer of Inter typeface, former Figma/Spotify/Facebook designer)*

Use Inter, or a typeface with comparable optical compensation for small sizes on OLED screens. On dark backgrounds at high pixel density, poorly hinted or non-variable typefaces create chromatic fringing on the thin strokes of numerals. Type rendering on dark UI is not a typographer's concern; it is a data legibility concern.

## Synthesis: 10 Most Impactful UI/UX Changes

**1. Collapse manual logging to direct manipulation, eliminate all forms.** *(Victor, Norman, Wathan)* Draggable rep counters, sliding weight selectors, one-tap "repeat last session." The distance between physical exertion and digital record must approach zero.

**2. Redesign the live camera UI for one-handed, non-dominant thumb operation only.** *(Wroblewski, Norman, Monteiro)* No interactive elements above the 60% screen height line during an active session. Every critical control — pause, rep count, end session — lives in the bottom thumb arc.

**3. Make the AI visible during skeleton overlay rendering.** *(Anadol, Walter, Drasner)* A confidence-mapped colour wash on joint detection (high confidence = saturated cyan, low confidence = desaturated amber), with a brief point-cloud materialisation on initial body detection.

**4. Create a typographic hierarchy so distinct that key metrics read from arm's length.** *(Scher, Lupton, Andersson)* Personal records and today's primary metric in a display weight at 3x the body text size, rendered in Inter or equivalent with confirmed OLED dark-background compensation.

**5. Systematise the glow into five semantic states; use nothing outside the system.** *(Rams, Wathan, Ive)* glow-rest, glow-active, glow-alert, glow-success, glow-peak. When the glow carries meaning, it earns the right to exist; when it doesn't, it is noise.

**6. Animate the background as a living state indicator.** *(Nakamura, Drasner, Head)* A very low-amplitude perlin noise field that increases subtly as session duration and intensity increase. At rest: static void. At peak effort: barely perceptible but felt.

**7. Rewrite onboarding as capability demonstration before data collection.** *(Walter, Norman, Friedman)* Open with the muscle map. Let the user tap it, watch it respond, feel the interaction, before asking for a single data point.

**8. Build a post-workout summary screen in a categorically warmer register.** *(van Schneider, Lupton, Walter)* Shift colour temperature toward amber-white, loosen the grid slightly. The contrast between training UI (cold, focused) and summary UI (warm, expansive, reflective) makes the achievement emotionally legible.

**9. Implement a genuine reduced-effects mode, not just prefers-reduced-motion.** *(Head, Coyier, Monteiro)* An explicit settings toggle that replaces skeleton overlay with static joint points, flattens glow to solid colour, disables background animation.

**10. Enforce spatial narrative in the dashboard layout.** *(Lupton, Norman, Scher)* Muscle map on top as the body. Stats directly below as what the body did. Progress ring at bottom as where the body is going. Argument made in space.

---

# COUNCIL 3: APP, AESTHETIC & BRAND (20 Members)

## The Panel

**1. Mike Matas** *(Push Pop Press, Facebook visual design)*
The app is treating the camera like a sensor. Treat it like a mirror — one that shows you a version of yourself you have not seen before. When the pose detection is active, the user's silhouette should glow from within — cyan light traced along muscle groups as they engage — so that the user sees their own body as the source of the luminescence. The technology already knows where the body is. Make the body the hero of the visual system, not a wireframe to be overlaid.

**2. Tobias van Schneider** *(Spotify brand)*
Every app that wants to become cultural needs a sound identity. Peloton has its instructors' voices. Apple Fitness has haptics and chimes. WorkoutVision should have a sonic language — not music, but designed feedback tones: a low resonant pulse when you hit a perfect rep, a rising harmonic when you complete a set, a subsonic recognition tone when the AI first locks onto the body. Users should be able to hear someone across a gym using WorkoutVision and know it immediately.

**3. Hideo Kojima** *(Death Stranding, Metal Gear Solid)*
What this product currently lacks is *lore*. Every cultural product has a world behind the world. The bioluminescent aesthetic suggests a biological mythology: the idea that the body is a living system with latent energy, and that training is the practice of making that energy visible. Give the AI a personality that feels like it emerged from that world — not a coach, not an assistant, but something closer to a guide from a civilisation that understands the body better than we do.

**4. Shigeru Miyamoto** *(Mario, Zelda)*
The rep counter is the wrong primary number. What the user needs to feel is not "I did 8 reps" but "I am better than I was yesterday." The unit of progression should be something the app invents — a metric that belongs entirely to WorkoutVision's world — that compounds across sessions and is legible at a glance. Think of the coin counter in Mario: it does not measure how skilled you are, it measures how *much you played*. The moment a user tells a friend that number, unprompted, is the moment you have a cultural product.

**5. Virgil Abloh** *(Off-White, Louis Vuitton Men's)*
The three percent rule: you change just three percent of an existing form and it becomes something entirely new. WorkoutVision needs to make its users feel they are training with knowledge that others do not yet have access to. The app should feel like a drop — limited, specific, discovered, not advertised. The aesthetic should signal membership in a small group that trains with a different understanding of what the body is.

**6. Emily Weiss** *(Glossier)*
The moment the camera opens and the AI begins reading the body, that first second of recognition — the moment the skeleton lights up and the AI confirms "I see you" — should feel like being noticed by something that genuinely pays attention. That is the emotional hook. Not results. Not streaks. The feeling of being *accurately seen*, which is extremely rare and which nobody in the fitness category is delivering.

**7. Julie Zhuo** *(VP Design, Facebook)*
Right now this app has no consistent emotional arc across a session. There is no before-state, no during-state, no after-state that is deliberately designed. Map those three states explicitly. The after-state is where the app is most underdeveloped. Completion should produce something — a visual artifact, a synthesized moment — that the user wants to look at again tomorrow morning.

**8. Ryan Hoover** *(Product Hunt)*
The Day One sharing problem: what does someone say when they show this to a friend for the first time? The shareable moment needs to be designed into the product deliberately. The live pose overlay in action, rendered in the bioluminescent aesthetic, is already that moment — but it needs to be one tap away from sharing, always, without friction. The demo IS the product.

**9. Jessica Walsh** *(&Walsh)*
Emotion before function, always. The app opens to a dark loading screen — fine — but the very first thing it should communicate is feeling, not instruction. The visual language should be used rhetorically. Every screen transition should reinforce one emotional claim: *your body is extraordinary, and we are the only product that can show you that.*

**10. Yves Behar** *(fuseproject, Jawbone)*
The body is the interface and the product has not fully reckoned with that. Consider camera placement rituals, specific framings the app asks you to achieve, a kind of setup ceremony that makes the beginning of a workout feel intentional rather than accidental.

**11. Jenova Chen** *(Journey, Flow)*
*Journey* had no score, no leaderboard — and yet players cried at the end. The form score should not be a number. It should be a felt experience: as form improves, the visual environment responds; the glow intensifies, the void deepens, the body becomes more luminous. The user should feel the improvement before they read it.

**12. Jonathan Blow** *(Braid, The Witness)*
The rep counter solves the wrong problem. Counting is trivially easy and users know their own count. What they cannot see — what genuinely requires machine intelligence — is the quality of movement over time: whether the left side is compensating for the right, whether range of motion is improving across six weeks. If WorkoutVision surfaces *that*, it becomes irreplaceable.

**13. Aza Raskin** *(Inventor of infinite scroll)*
The features most likely to make this app compulsive are also the features most likely to make users feel bad. Design the feedback so that the primary signal is always "here is what you did well" and the secondary signal is "here is the one thing to improve." Never reverse that order. The apps that cause users to quit are those that front-load failure.

**14. Paula Scher** *(Pentagram)*
Typography is doing no work. Commission or license a typeface that carries the biological-luminescent worldview: something between organic and mechanical, with the sense that it was grown rather than drawn.

**15. Dieter Rams** *(Braun)*
The glow effects, the glass morphism, the overlays — they are all competing for attention simultaneously. Identify the single most important thing the user needs to see in any given moment and make every other element subordinate to it. During a set, that is the form score. Between sets, that is the recovery state.

**16. Pharrell Williams** *(Creative director, brand collaborator)*
Culture moves at frequency, not at message. The bioluminescent aesthetic has a frequency — quiet, nocturnal, intelligent, slightly alien. That is genuinely rare in fitness. Protect that frequency aggressively. The moment the app adds bright colors for a "motivation boost," the frequency is lost. Scarcity of frequency is the rarest and most valuable brand asset.

**17. Ev Williams** *(Medium, Twitter)*
The app needs a native output format that is *worth sharing because it reveals something about who the user is*. The form score rendered as a visual artifact — something that looks like a biological scan, specific to that session, that day, that body — could be that format.

**18. Neri Oxman** *(Architect, media artist)*
The glow patterns that appear on the body during pose detection should follow the actual anatomical logic of what the AI is reading. Muscle fiber direction. Joint load distribution. Fascia lines. If the visual grammar is grounded in biological reality, users will feel that the app understands the body in a way that goes beyond counting.

**19. Hiroshi Lockheimer** *(SVP Google, Android/Chrome)*
The ambient state problem. Great products are present when you are not actively using them. WorkoutVision currently has no ambient state. The recovery data the AI infers should surface in ambient form: a lock screen showing the user's luminescence level, a subtle notification that says "your body is ready."

**20. Cassette Playa (Carri Mundane)** *(London streetwear, biopunk)*
The visual language should evolve with use — earlier sessions should look rawer, more chaotic; later sessions, as form improves, should look more crystalline, more resolved. The app's aesthetic should document the transformation the user is undergoing.

## Synthesis: 10 Most Impactful Product/Aesthetic Changes

**1. Make the body the source of the light.** The user's silhouette should glow from within, with anatomically grounded luminescence that traces muscle engagement. The demo IS the product. *(Matas + Oxman + Mundane)*

**2. Design a proprietary unit of progression that compounds across sessions.** Abandon reps as the primary number. Invent a metric that integrates form quality, consistency, and improvement over time into a single number that grows with the user. *(Miyamoto + Zhuo + Blow)*

**3. Build a sonic identity.** Proprietary feedback tones: a low resonant pulse for a quality rep, a rising harmonic for set completion. As distinctive as the Mario coin sound. *(van Schneider)*

**4. Surface biomechanical insight no human coach can deliver in real time.** Asymmetry detection, fatigue pattern analysis, ROM trending across weeks. *(Blow + Raskin)*

**5. Design the three emotional states of every session deliberately.** Before (anticipation, ceremony), during (presence, environmental response), after (beautiful artifact). *(Zhuo + Chen + Williams)*

**6. Create a shareable visual artifact specific to that session and that body.** Something that looks like a biological scan. Beautiful enough to share. The format communicates "I train with something different." *(Williams + Weiss + Mundane)*

**7. Protect the nocturnal-intelligent-alien frequency.** Resist every impulse to add bright colors or loud sounds. Scarcity of frequency is the rarest brand asset. *(Williams + Rams + Abloh)*

**8. Apply restraint to the visual hierarchy.** During a set: one thing dominates. When everything glows, nothing glows. *(Rams + Walsh)*

**9. Design an ambient presence between sessions.** Lock screen integration. A subtle notification: "your body is ready." The product should feel like it is paying quiet attention. *(Lockheimer + Weiss)*

**10. Build the lore and let the visual language evolve with mastery.** Give the AI a cosmological identity. Early sessions raw and chaotic, later sessions crystalline and resolved. *(Kojima + Mundane + Chen)*

---

# COUNCIL 4: SPORTS SCIENCE (20 Members)

## The Panel

**Dr. Andy Galpin** *(UC Santa Barbara, muscle physiology)*
The app counts reps but measures nothing about *what is happening inside the muscle*. Fiber type recruitment, lactate threshold proximity, and phosphocreatine depletion can all be inferred indirectly from movement velocity. Without velocity tracking derived from landmark displacement over time (MediaPipe gives you position at 30fps; you already have the data), you are scoring the shape of a rep but not its neuromuscular content. Bar speed collapse across a set is the single most actionable indicator of real fatigue onset.

**Dr. Brad Schoenfeld** *(CUNY Lehman, hypertrophy)*
The binary form score ignores the most important distinction in hypertrophy research: are you achieving *mechanical tension through a full range of motion with a controlled eccentric*? The app needs to specifically score *eccentric phase duration* and *terminal range depth* as weighted sub-scores, not fold them into a global angle average.

**Dr. Stuart McGill** *(Waterloo, spine biomechanics)*
The injury adaptation logic is dangerous. Telling a user with "lower back" injury to avoid deadlifts is not a sports science recommendation — it is a liability waiver dressed up as advice. The *specific mechanism* of injury (flexion intolerance vs. extension intolerance vs. lateral shear) dictates the exercise prescription. The intake questionnaire needs a three-question pain provocation screen.

**Dr. Kelly Starrett** *(The Ready State, mobility)*
Pose detection gives you 33 landmarks but the app is reading positions, not *tissue restriction patterns*. Ankle dorsiflexion deficit shows up in squat depth data — but the app sees knee caving, flags "knee alignment" as the form error, and misses the upstream cause. The app needs a basic movement screen at onboarding to build a restriction profile.

**Dr. Mike Israetel** *(Renaissance Periodization)*
The progressive overload tracking has no concept of *mesocycle structure*. MEV/MAV/MRV framework: each muscle group has a minimum effective volume, a maximum adaptive volume ceiling, and a recovery ceiling that change week by week. The app needs a four-to-six week volume ramp followed by a deload algorithm per muscle group.

**Louie Simmons** *(Westside Barbell, conjugate periodization)*
An app that runs someone on the same squat pattern for months is not building strength; it is building a very well-grooved single-pattern mover who will plateau and injure themselves when the groove breaks. The exercise pool needs rotation logic built into its suggestion algorithm.

**Mark Rippetoe** *(Starting Strength)*
The squat form model is almost certainly wrong. Forward lean is not a form error — bar-over-mid-foot mechanics require it in proportion to femur length and hip anatomy. Without anthropometric normalization — limb lengths, torso-to-femur ratio — the form score has no biomechanical validity. Landmark-to-landmark ratios are already derivable from MediaPipe data at session start.

**Vladimir Zatsiorsky** *(Penn State, biomechanics)*
The velocity-force relationship is the missing foundation. An app that measures bar displacement per frame and divides by time interval already has instantaneous velocity. Plotting that velocity against estimated load gives a real-time force-velocity profile that tells you whether the athlete is developing a balanced neuromuscular profile.

**Frans Bosch** *(Netherlands, motor learning)*
The app is scoring movement against idealized templates, which reflects a *coordinative variability* blind spot. Inter-repetition variability is not noise — it is the system exploring its solution space. The scoring model should distinguish *harmful variability* (progressive form breakdown) from *adaptive variability* (rep-to-rep exploration within an acceptable envelope).

**Dr. Dan Baker** *(Australian S&C, VBT)*
If the app computes mean concentric velocity from landmark displacement, it can issue a real-time "set termination" signal *before* form breakdown — which is the actual injury prevention mechanism, not the post-hoc form score. A 20% velocity loss threshold correlates with neuromuscular fatigue independent of external load.

**Dr. Tim Gabbett** *(Chronic:acute workload research)*
The chronic:acute workload ratio is completely absent. Acute workload (last 7 days) divided by chronic workload (rolling 28-day average) in the 0.8-1.3 range is associated with injury protection. The injury risk flag should be quantitative — "your ACWR for posterior chain is 1.7 this week, reduce volume by 20%."

**Dr. Keith Barr** *(UC Davis, connective tissue)*
The muscle map shows skeletal muscle loading but ignores connective tissue. Tendons and ligaments adapt on a 36-48 hour synthesis cycle, significantly slower than muscle. The app needs a parallel "connective tissue load" tracker flagging high-velocity exercises on connective tissue that has not received progressive loading.

**Dr. Eric Helms** *(AUT, evidence-based bodybuilding)*
The nutrition module operates on macro targets but has no connection to training stimulus. Protein distribution across meals matters as much as daily total. Calorie targets do not adjust for training day vs. rest day. Nutrition and training data must be cross-referenced, not siloed.

**Mel Siff** *(Supertraining)*
The tempo scoring is missing the isometric phase entirely. The rep counter and form scorer need to track *all four phases* — eccentric, isometric-bottom, concentric, isometric-top — and score them independently, since a user who rushes the reversal is defeating most of the mechanical tension benefit.

**Bret Contreras** *(Glute research)*
The hip hinge and squat assessments do not distinguish between hip-dominant and quad-dominant patterns. The muscle map should show activation intensity gradients, not binary "worked/not worked" shading.

**Greg Nuckols** *(Stronger by Science)*
The form score has no uncertainty quantification. Every biomechanics measure from 2D pose estimation carries substantial error. The app should display score ranges ("Form: 68-79") and flag low-confidence assessments explicitly.

**Dr. Stacy Sims** *(Female physiology)*
The entire system is designed around a male physiology default. Women in the luteal phase have elevated core temperature, increased protein catabolism, and reduced carbohydrate oxidation efficiency. Menstrual cycle phase input should gate both training suggestions and macro recommendations.

**Michael Boyle** *(Functional strength, MFSS)*
The app assesses bilateral exercises but 90% of its users have asymmetries that bilateral exercises mask. The app should run a single-leg squat assessment at onboarding and flag asymmetry indices above 10-15%.

**Charlie Francis** *(Sprint periodization)*
CNS fatigue is invisible to this app. A set of five at 90% 1RM and a set of fifteen at 60% 1RM look identical from a volume-load calculation, but their CNS demands diverge by a factor of three to four. The intensity classification system needs to distinguish CNS-intensive from CNS-sparing sessions.

**Yuri Verkhoshansky** *(Soviet block periodization)*
The periodization logic is monotonic. Block periodization organizes training into sequential accumulation, transmutation, and realization blocks. The periodization engine must allow block-mode programming as an alternative to concurrent-mode.

## Synthesis: 10 Most Impactful Sports Science Features

**1. Velocity-Based Autoregulation (VBT) from existing landmark data.** Compute mean concentric velocity per rep from MediaPipe landmark displacement / time interval. Implement the 20% velocity loss set-termination signal. Uses data the app already captures. Affects every user on every session.

**2. Anthropometric normalization of form scoring.** Derive limb-length ratios from the 33 landmarks at session start. Normalize joint angle targets to individual anatomy. A form score without anthropometric context has no biomechanical validity.

**3. Mesocycle volume ramp with per-muscle-group MEV/MAV/MRV tracking.** Four-to-six-week accumulation then deload structure per muscle group. The single most common gap in recreational training programs.

**4. Chronic:Acute Workload Ratio (ACWR) injury risk flag.** 7-day acute vs. 28-day rolling chronic volume per muscle group. Flag ACWR > 1.3 with quantified reduction recommendation.

**5. Concentric/eccentric phase separation with eccentric duration scoring.** Use landmark velocity direction to detect phase transitions. Score eccentric duration independently — where both hypertrophy signal and injury risk are concentrated.

**6. Onboarding movement screen with restriction profiling.** Three to five screen movements at first session. Build a restriction profile that gates all subsequent form flags upstream to their probable cause.

**7. Pain provocation intake screen for injury modification.** Replace binary injury flags with a three-question screen. The current binary system is both scientifically invalid and a liability exposure.

**8. Block periodization mode with CNS load classification.** Classify each session as CNS-intensive or CNS-sparing. Track weekly CNS-intensive accumulation. Offer block templates as alternative to concurrent programming.

**9. Menstrual cycle phase integration for female users.** Adjust intensity recommendations and protein targets by phase. Addresses a systematically underserved user segment.

**10. Connective tissue load tracker with rate-of-loading flags.** Track accumulated connective tissue load on a 48-hour synthesis cycle separate from the muscle map.

---

# COUNCIL 5: COMPUTER VISION (20 Members)

## The Panel

**1. Deva Ramanan** *(Carnegie Mellon; human pose estimation)*
Your signal selection heuristic is brittle because it assumes the periodic signal dominates noise. For exercises with asymmetric phases (deadlifts, where descent is slower than ascent), autocorrelation underestimates count because the period estimator conflates the asymmetric waveform with a longer pseudo-period. You need a phase-aware repetition counter using short-time Fourier transform (STFT) with asymmetric window weighting, as in RepNet (Dwibedi et al., CVPR 2020).

**2. Cordelia Schmid** *(INRIA/Google; action recognition, dense trajectories)*
The architecture has no temporal context window — each frame is processed independently. Dense optical flow trajectories (approximated via landmark velocity fields) would give motion direction and magnitude that 2D joint angle cannot encode. For bench press front-view, trajectory vectors on wrist landmarks moving along the Z-inferred axis would give a non-zero periodic signal where your current angle projection gives flatline.

**3. Kaiming He** *(Meta AI; ResNet, Mask R-CNN)*
Your form scoring is a lookup table against angle thresholds — this is a classification problem with no learned decision boundary. A small, on-device residual network (ResNet-8 or MobileNet-V3-Small, ~300KB) trained on annotated good/bad form examples would produce calibrated probability outputs rather than binary threshold crossings.

**4. Jitendra Malik** *(UC Berkeley; father of modern computational vision)*
The 2D-only projection assumption is the fundamental architectural mistake. MediaPipe's Z values are noisy in absolute terms, but their *relative* consistency is sufficient for computing approximate 3D joint angles if you apply a learned correction model — VideoPose3D (Pavllo et al., CVPR 2019). The depth-axis exercise failures become tractable the moment you stop projecting everything onto a 2D plane.

**5. Yann LeCun** *(Meta/NYU; deep learning, energy-based models)*
The rep counting and form scoring pipelines are separate modules that never share representation. A joint energy-based model trained on synchronized (video, rep count, form label) triplets would learn a shared embedding where counting and quality assessment are geometrically related. You're discarding that correlation by design.

**6. Valentin Bazarevsky** *(Google; lead engineer on MediaPipe Pose, BlazePose)*
You're running the full 33-landmark model and then using only 8 joint angles, discarding 25 landmarks including foot orientation, hand position, and facial orientation. The foot landmarks give you stance width for squat assessment. You built a 900-parameter input space and are querying 8 dimensions of it.

**7. Christian Szegedy** *(Google Brain; Inception, batch normalization)*
Your Gaussian smoothing with σ = fps x 0.12 is a fixed-bandwidth filter. Battle ropes oscillating at 3-5Hz sampled at 10fps will alias regardless of your Gaussian kernel because you're below Nyquist for that frequency range. You need adaptive bandwidth selection: estimate instantaneous signal frequency in a sliding window and set σ = 1/(4 x estimated_freq).

**8. Alexei Efros** *(UC Berkeley; self-supervised learning)*
Your form scoring assumes a universal platonic ideal, but optimal form is individual. Record the user's first N reps, build a user-specific joint angle distribution, and flag deviations from that personal baseline rather than from a global threshold. Anomaly detection, not classification. Requires no labeled training data.

**9. Roozbeh Mottaghi** *(Allen AI; 3D scene understanding)*
The system has no model of the 3D environment — it doesn't know if the camera is at chest height, on the floor, or held by a partner. You need a camera pose estimation step — even 5-6 canonical views — before applying any angle threshold.

**10. Angjoo Kanazawa** *(UC Berkeley; HMR, 3D human mesh recovery)*
The 33-landmark skeleton has no model of body shape. A 170cm person with long femurs has a mechanically different knee angle at parallel than a 190cm person with short femurs. HMR recovers SMPL body shape parameters. A lightweight SMPL fitting step on top of MediaPipe landmarks would take ~15ms on GPU.

**11. Andrea Vedaldi** *(Oxford/Meta)*
The exercise classification is implicit. A 32-class exercise variant classifier running on your skeleton sequence would take under 2MB in quantized INT8 and would serve the correct threshold config automatically.

**12. Shaoqing Ren** *(Microsoft/SenseTime; Faster R-CNN)*
The visibility filtering at threshold 0.5 creates discontinuous signal dropouts. Kalman filtering on each landmark's (x, y, visibility) tuple: treat visibility as an observation reliability weight rather than a binary gate.

**13. Yaser Sheikh** *(CMU/Meta Reality Labs; OpenPose)*
In a gym environment with a free-standing mirror, the reflected person is detected as a second skeleton and corrupts the signal. Even a simple foreground/background separation using optical flow magnitude (the exerciser is the person with maximal periodic motion energy) would make single-person assumption robust.

**14. Vladlen Koltun** *(Intel/Apple; depth estimation, fast inference)*
Your signal processing pipeline runs in JavaScript on the main thread, which introduces variable latency that corrupts your fps-normalized smoothing kernel. Move to a Web Worker, use SharedArrayBuffer, and use timestamps rather than frame indices for all time-domain computations.

**15. Ross Girshick** *(Meta AI; R-CNN family)*
The architecture processes every frame at full model resolution even when the person hasn't moved significantly. Implement a motion-gated inference scheduler: compute frame-to-frame pixel difference in 64x64 downsampled grayscale; if delta is below threshold, skip full inference. Cut average compute by 35-40%.

**16. Ishan Misra** *(Meta AI; self-supervised video learning)*
Your rep counting treats each session independently with no cross-session learning. A lightweight online learning model that accumulates user-specific statistics across sessions (~5KB in localStorage) would let the confidence threshold and period estimator adapt to each user.

**17. Christoph Feichtenhofer** *(Meta AI; SlowFast networks)*
The single 10fps analysis stream misses that form cues and rep timing operate at different temporal scales. Form errors need ~30fps to catch at their worst point. Rep timing operates at 0.5-3Hz. A two-stream approach maps onto SlowFast's architecture.

**18. Bangpeng Yao** *(Stanford/Google; action-object interaction)*
The system ignores equipment entirely. A YOLOv8-Nano model for fitness equipment is under 3MB and runs at 60fps on mobile GPU. A kettlebell goblet squat has a different valid knee-travel range than a barbell back squat. The single cheapest classification step with the highest threshold-accuracy payoff.

**19. Lourdes Agapito** *(UCL; non-rigid structure from motion)*
Your detrending removes the fatigue signal — the systematic downward trend in ROM amplitude across a set is biomechanically meaningful. Separate your detrending into artifact removal (high-pass > 0.05Hz) and amplitude-trend preservation as a fatigue score.

**20. Trevor Darrell** *(UC Berkeley; domain adaptation, vision-language models)*
The form scoring has no explanation layer. A vision-language model (distilled 50M-parameter CLIP variant) could generate natural-language explanations: "knee tracked inside the foot line at bottom position, suggesting hip external rotator weakness."

## Synthesis: 10 Most Impactful Computer Vision Improvements

**1. Lift 2D skeleton to approximate 3D using a pose-lifting network.** Martinez et al.'s simple baseline (~4MB quantized) runs at 30fps on mobile GPU. Without this, front-view depth-axis exercises are architecturally broken. Implement first.

**2. Replace fixed autocorrelation with temporal self-similarity matrix (RepNet approach).** Handles phase-asymmetric reps, variable cadence, and partial reps natively. Run on landmark sequence rather than raw video — reduces compute by 10x.

**3. Camera viewpoint classification before threshold application.** 5-6 class classifier on landmark geometry, under 100KB in INT8. Every angle threshold is viewpoint-dependent.

**4. Kalman filtering on landmark tracks replacing binary visibility thresholding.** Eliminates null-interpolation signal artifacts. Zero additional model weight.

**5. Adaptive smoothing bandwidth based on instantaneous frequency estimation.** Fixes battle ropes aliasing and all high-cadence exercises. Replaces a hardcoded constant with a 5-line adaptive formula.

**6. Fatigue signal extraction as separate output channel from detrending.** The intra-set ROM decline is a first-order injury risk predictor at zero compute cost.

**7. Equipment type detection using YOLOv8-Nano.** ~3MB model, 60fps. Conditions threshold config on detected equipment. Can be run at 1fps and cached.

**8. User-personalized form baseline using anomaly detection.** First N reps build a per-landmark angle distribution. Flag by Mahalanobis distance from personal baseline. ~2KB user profile.

**9. Two-stream temporal architecture for form vs. counting at different rates.** 30fps form-analysis stream + 10fps counting stream. Addresses temporal resolution mismatch.

**10. Move all signal processing to Web Worker with timestamp-based computation.** Eliminates GC-pause-induced smoothing kernel corruption. Prerequisites for accurate benchmarking.

---

# CROSS-COUNCIL CONVERGENCE: THE 15 MOVES THAT APPEARED IN 3+ COUNCILS

*When independent experts from unrelated disciplines converge on the same recommendation, that recommendation is load-bearing.*

| # | Recommendation | Councils | Why it's convergent |
|---|---|---|---|
| 1 | **3D pose lifting (2D→3D)** | CV, Dev, Sports | Fixes the root cause of the largest failure class. Every downstream system becomes more accurate. |
| 2 | **Velocity-based training (VBT) from existing landmark data** | Sports, CV, Dev | The data already exists (position at 30fps). Computing velocity is division. The insight it unlocks (fatigue detection, autoregulation, force-velocity profiling) transforms the product category. |
| 3 | **Anthropometric normalization** | Sports, CV, Design | Without body-proportional thresholds, every form score is biomechanically invalid. Derivable from existing landmarks at session start. |
| 4 | **Make the AI visible / body as light source** | Design, Aesthetic, CV | Confidence-mapped skeleton, anatomical glow, point-cloud materialisation. The moment the user *sees* the AI seeing them is the emotional hook and the shareable moment. |
| 5 | **Proprietary progression metric** | Aesthetic, Sports, Design | Reps are commodity. A compounding score integrating form, consistency, and improvement is the number users tell friends. |
| 6 | **Concentric/eccentric phase detection** | Sports, CV, Dev | Unlocks eccentric scoring, isometric holds, tempo tracking, VBT, fatigue signal — five features from one signal processing change. |
| 7 | **Semantic glow system (5 states)** | Design, Aesthetic, Dev | Replaces decorative glow with communicative glow. When everything glows, nothing glows. |
| 8 | **Web Worker isolation for signal processing** | Dev, CV | Eliminates GC-pause corruption, enables timestamp-based computation, makes all other signal improvements reliable. |
| 9 | **Kalman filtering on landmarks** | CV, Dev, Sports | Eliminates null-interpolation artifacts, smooths temporal signal, reduces counting errors — no additional model weight. |
| 10 | **Onboarding movement screen / restriction profile** | Sports, Design, Aesthetic | Three to five movements at first session that contextualise every future form flag. Also the "capability demonstration before data collection" that Design demands. |
| 11 | **Sound identity** | Aesthetic, Design | Feedback tones as distinctive as Mario coin. Fastest path from feature to cultural identity. |
| 12 | **Post-workout shareable artifact** | Aesthetic, Design | Beautiful, body-specific, unreplicable visual that users share unprompted. The "I train with something different" signal. |
| 13 | **One-handed thumb-zone live UI** | Design, Sports, Dev | Physical safety issue before it is a UX issue. No buttons above 60% screen height during active session. |
| 14 | **Direct manipulation manual logging** | Design, Aesthetic | Draggable counters, sliding selectors, one-tap "same as last time." Zero forms. |
| 15 | **Chronic:Acute Workload Ratio** | Sports, Dev | Quantitative injury prevention from volume data already being logged. |

---

# THE VERDICT: WHAT MAKES THIS APP REVOLUTIONARY

Five councils, 100 minds, one conclusion stated five different ways:

**Dev Engineering says:** The architecture is sound but the signal processing runs on the wrong thread, the rep counter has a race condition, and the model is doing 3x more work than necessary. Fix the plumbing and the app becomes fast enough to be real-time on mid-range hardware.

**Frontend Design says:** The bioluminescent aesthetic is genuinely distinctive but it communicates nothing because it's applied uniformly. Make the glow respond to state and the app becomes alive. Make the live UI thumb-operable and it becomes safe.

**App & Aesthetic says:** The tech is the demo. The demo is the product. The shareable moment is the body glowing from within. Build a world behind the world, give the AI a personality, invent a number that grows with the user, and the app becomes cultural.

**Sports Science says:** You have the data to compute velocity, detect fatigue, separate phases, and normalize to individual anatomy — and you're using it to count reps. That is like having a particle accelerator and using it as a doorstop. VBT alone transforms the product category.

**Computer Vision says:** The 2D-only assumption is the root cause of everything. Lift to 3D, add Kalman filtering, detect the camera viewpoint, and every downstream system improves without changing a single line of downstream code.

**The single sentence all five councils would sign:**

> *Stop counting reps — the user can count. Start showing people what no mirror, no coach, and no other app can show them: the truth about how their body moves, rendered in light, on the device they already own.*

---

*End of report. 100 minds. One product. Zero excuses.*

# Skeleton overlay bug — full architecture for external review

## The problem

The green skeleton (pose overlay) is NOT visible during video analysis on the deployed PWA at https://david-dabert.github.io/workout-vision/. The skeleton drawing code executes (no errors in console), the analysis produces correct rep counts and biomechanics data, but the user never sees the green skeleton overlaid on their video during the analysis phase.

The skeleton DOES work correctly in the replay phase (VideoReplay.jsx). The bug is isolated to the analysis phase in VideoUpload.jsx.

## What we want

During video analysis, the user should see:
1. Their video playing frame-by-frame as the AI analyzes it
2. A bright green (#00FF88) skeleton overlaid on their body with red (#FF3355) joint dots
3. A live rep counter (top-left)
4. A progress bar (bottom)

Like this: video frame visible + skeleton drawn on a transparent canvas on top.

## Current architecture (v7-overlay, the latest attempt)

### File: `src/components/VideoUpload.jsx`

**DOM structure during analysis (lines 686-726):**
```jsx
<div className="analysis-card"
  style={analyzing
    ? { display: 'block', padding: 8 }
    : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }
  }
>
  <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
    {/* The video element — shows the frame natively via seeking */}
    <video ref={videoRef} className="analysis-video" muted playsInline preload="auto"
      style={{ width: '100%', display: 'block' }} />

    {/* Transparent overlay canvas — should draw ONLY the green skeleton */}
    <canvas ref={overlayRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} />

    {/* Overlaid UI: rep counter and progress bar (zIndex: 10) */}
  </div>
</div>
```

**The analysis-card visibility logic:**
- When `analyzing` is false: the card is positioned off-screen (1x1px, opacity 0, overflow hidden). This is because iOS Safari refuses to seek on `display:none` video elements — so we can't use `display: none`.
- When `analyzing` is true: `display: block, padding: 8`.

**The analysis loop (lines 248-329):**
```
for each frame:
  1. video.currentTime = time          // seek the visible <video> element
  2. wait for 'seeked' event
  3. await waitForFrame()              // iOS fix: wait for actual frame decode
  4. offCtx.drawImage(video, ...)      // draw video to OFFSCREEN canvas (not displayed)
  5. detectPoseImage(landmarker, offscreen)  // MediaPipe reads the offscreen canvas
  6. extract landmarks, run rep counter
  7. setLiveReps(updateResult.reps)    // React state update
  8. Draw skeleton on overlay canvas:
     - overlay = overlayRef.current
     - rect = video.getBoundingClientRect()
     - ow = rect.width * devicePixelRatio
     - oh = rect.height * devicePixelRatio
     - overlay.width = ow; overlay.height = oh  (only if changed)
     - oCtx.clearRect(0, 0, ow, oh)
     - drawPose(oCtx, landmarks, ow, oh, 1.0, null)
  9. setProgress(pct)                  // React state update
  10. await new Promise(r => requestAnimationFrame(r))  // yield to paint
  11. settle(true)                     // resolve promise, proceed to next frame
```

**Key detail about step 8:** `drawPose` expects **normalized** landmarks where `lm.x` is 0-1 and it multiplies by `width` and `height` internally. MediaPipe PoseLandmarker returns normalized landmarks. So passing `(oCtx, landmarks, ow, oh)` should work — it maps normalized coords to canvas pixel coords.

### File: `src/lib/poseAnalysis.js`

**drawPose function (lines 406-453):**
```javascript
export function drawPose(ctx, landmarks, width, height, alpha = 1.0, formFeedback = null) {
  if (!landmarks || landmarks.length === 0) return;
  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],  // shoulders, arms
    [11, 23], [12, 24], [23, 24],                        // torso
    [23, 25], [25, 27], [24, 26], [26, 28],              // legs
    [27, 29], [29, 31], [28, 30], [30, 32],              // feet
  ];

  ctx.globalAlpha = alpha;

  // Pass 1: black shadow outline (lineWidth + 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  for (const [i, j] of connections) {
    if (visibility > 0.3 for both landmarks) {
      draw line from lm[i].x * width to lm[j].x * width
    }
  }

  // Pass 2: colored skeleton segments
  // When formFeedback is null → getSegmentColor returns '#00FF88' (green)
  // When formFeedback has failures → red (#FF3355) or yellow (#FFCC00)
  for (const [i, j] of connections) {
    ctx.strokeStyle = getSegmentColor(i, j, formFeedback);  // '#00FF88' when null
    draw line
  }

  // Pass 3: red joint dots
  ctx.fillStyle = '#FF3355';
  for each landmark with visibility > 0.3:
    draw circle at lm.x * width, lm.y * height

  ctx.globalAlpha = 1.0;
}
```

**NOTE:** `drawPose` does NOT include head/face landmarks (0-10). It only draws body landmarks 11-32. The connections array skips landmarks 0-10 entirely. This means no head circle is drawn.

### File: `src/lib/poseAnalysis.js` — MediaPipe setup

**PoseLandmarker configuration (lines 105-127):**
```javascript
const landmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate: 'GPU' or 'CPU' },
  runningMode: 'VIDEO',
  numPoses: 3,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
```

**detectPoseImage (lines 230-238):**
```javascript
export function detectPoseImage(landmarker, source) {
  const ts = performance.now();
  return landmarker.detectForVideo(source, ts);
}
```

Uses `detectForVideo` with `performance.now()` as timestamp. The `source` is the offscreen canvas (which has the video frame drawn on it).

### CSS for analysis elements (src/index.css, lines 1096-1105)

```css
.analysis-card { padding: 10px; }
.analysis-video { width: 100%; display: block; }
```

## Previous attempts that failed

### Attempt 1: drawImage + drawPose on same canvas
Drew the video frame onto the visible canvas (`ctx.drawImage(video, ...)`), then drew the skeleton on top of it. The skeleton was drawn to the canvas buffer but the browser never painted it to screen before the next frame overwrote it.

### Attempt 2: requestAnimationFrame yield + zIndex
Added `await new Promise(r => requestAnimationFrame(r))` after drawing, and `zIndex: 2` to the canvas. Still didn't work.

### Attempt 3: Overlay canvas (current, v7-overlay)
Separated into: video element shows frame natively, transparent overlay canvas draws only the skeleton. Offscreen canvas feeds MediaPipe. Still not working.

## Hypotheses for what might be wrong

1. **The overlay canvas has zero display dimensions.** The canvas CSS is `width: 100%, height: 100%` of its parent div. But the parent div's height depends on the video element. If the video element hasn't laid out yet when the first frame draws, `getBoundingClientRect()` might return zeros. The canvas buffer would be 0x0.

2. **The analysis-card container is not actually visible.** The `analyzing` state is set to `true` at line 470, but the video loading happens inside `analyzeVideo` which is called from `startAnalysis`. The `analysisPhase` is 'model' then 'loading' then 'analyzing'. The overlay UI only renders when `analysisPhase === 'analyzing'`. But the canvas itself is always in the DOM (not conditionally rendered).

3. **React state updates (`setProgress`, `setLiveReps`) cause re-renders that reset the canvas.** If React re-renders and recreates the canvas DOM element, its pixel buffer resets to transparent. This would happen if the `overlayRef` canvas is conditionally rendered or if a parent component unmounts/remounts.

4. **The canvas overlay has no height because the video element has no intrinsic height yet.** The video's `src` is set, `loadeddata` fires, but the video might not have painted its first frame. The `<video>` element with `width: 100%` and no explicit height relies on the video's aspect ratio for its natural height. If the video hasn't decoded a frame yet, the element might be 0px tall.

5. **MediaPipe's `detectForVideo` with `performance.now()` as timestamp might not be getting fresh timestamps.** If two calls happen with timestamps too close together, MediaPipe might return cached/empty results. But this is unlikely since we await between frames.

6. **The landmark coordinates might be relative to the offscreen canvas, not the video's native resolution.** MediaPipe returns normalized 0-1 coordinates regardless of input size, so this should be fine. But worth verifying.

7. **The `video.getBoundingClientRect()` at analysis time might return {width: 0, height: 0}.** The analysis-card is hidden (1x1px opacity 0) before analysis starts. When `analyzing` becomes true, React re-renders and sets `display: block`. But `getBoundingClientRect()` is called inside the `onSeeked` callback, which fires asynchronously. By that time, the layout should have updated. But maybe not on the first frame.

## Questions for the reviewer

1. Is the overlay canvas approach fundamentally sound, or is there a simpler way to achieve this?

2. Is there a timing issue where the canvas gets its dimensions from `getBoundingClientRect()` before the layout has actually updated?

3. Could the `requestAnimationFrame` yield actually be insufficient — i.e., the browser schedules the paint but React's state update (`setProgress`) triggers a re-render that clears the canvas before it paints?

4. Should we use a `useEffect` to size the overlay canvas when the video's dimensions are known, rather than sizing it on every frame inside the analysis loop?

5. Is there a conflict between the canvas 2D context and MediaPipe's WebGL delegate? MediaPipe uses WebGL internally — could it be stealing the GPU context?

6. The video element is hidden (1x1px, opacity 0) when not analyzing. When analyzing starts, it becomes visible. Is there a race condition where the first few seeks happen before the video is layout-visible?

7. On mobile Safari specifically: does `getBoundingClientRect()` return correct values for a video element that was just made visible via style change?

## How to reproduce

1. Go to https://david-dabert.github.io/workout-vision/
2. Tap "Analyze Video"
3. Select a workout video (any gym video with a person exercising)
4. Tap "Analyze"
5. Watch the analysis progress — you should see the video frame + green skeleton overlay. Currently you see either a black box or just the video with no skeleton.

## File map

```
src/
├── components/
│   ├── VideoUpload.jsx     ← Analysis loop, overlay canvas, DOM structure (THE BUG IS HERE)
│   └── VideoReplay.jsx     ← Replay mode (skeleton WORKS here, not broken)
├── lib/
│   ├── poseAnalysis.js     ← drawPose(), detectPoseImage(), MediaPipe setup
│   ├── exercises.js        ← Exercise definitions, form checks
│   ├── repCounter.js       ← Rep detection (full-cycle triplet)
│   ├── biomechanics.js     ← Velocity, TUT, ROM, fatigue analysis
│   ├── coach.js            ← Report generation
│   └── shareCard.js        ← Share card with skeleton icon
└── index.css               ← Styles including .analysis-card, .analysis-video
```

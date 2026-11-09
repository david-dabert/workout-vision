# Browser Difference Benchmark: Chromium vs WebKit

## Commands

```bash
# Start local dev server
npx vite --port 5173

# Extract per-frame world landmarks and timestamps for 5 demo clips (Chromium & WebKit)
node scripts/benchmarks/dump_browser_landmarks.mjs

# Compute divergence metrics
python3 scripts/benchmarks/browser_diff.py
```

## Results

| Clip                 | Chromium Frames | WebKit Frames | Timestamps Identical | Frames Diff > 1e-6 | First Diff Frame | Median Dist (m) | Max Dist (m) |
|:---------------------|----------------:|--------------:|:--------------------:|-------------------:|-----------------:|----------------:|-------------:|
| dip-13               |             317 |           317 |         Yes          |                317 |                0 |        0.029556 |     0.541438 |
| ez-curl-10           |             478 |           478 |         Yes          |                478 |                0 |        0.040862 |     0.659223 |
| bodyweight-squat-9   |             415 |           415 |         Yes          |                414 |                0 |        0.034278 |     0.566228 |
| lat-pulldown-6       |             275 |           275 |         Yes          |                271 |                0 |        0.091033 |     0.724998 |
| bicep-curl-5         |             117 |           117 |         Yes          |                117 |                0 |        0.024856 |     0.230359 |

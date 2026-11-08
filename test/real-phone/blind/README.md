# Testers' Blind Count Sets (`test/real-phone/blind/`)

Established under Phase 6 of David's order of 6 November 2026 (`PLAN.md`).

## Protocol (R1 / R2)

When a tester records or analyses an exercise video in the app, the blind count flow (`src/components/experience/BlindAsk.jsx`, `src/lib/blind.js`) asks:
*"Combien de répétitions avez-vous faites ?"*
before the app reveals its measured count. This prevents anchoring.

The answer given by the tester is the ground truth label under David's rules (R1 / R2).

## File Schema

Each blind count file in this directory (`.json` or `.json.gz`) complies with the following schema:

```json
{
  "version": 1,
  "videoSha256": "4a5c...64-hex",
  "lift": "squat",
  "testerCount": 10,
  "appCount": 10,
  "appRefused": false,
  "timestamp": "2026-11-08T12:00:00.000Z",
  "sessionId": "anon-session-id"
}
```

Optional fields when landmarks are retained from the session:
- `worldLandmarks`: array of 3D landmarks per frame
- `timestamps`: array of millisecond timestamps per frame
- `imageLandmarks`: array of 2D screen landmarks per frame

## Integrity & Gating

- **Integrity**: Every set in this folder is locked with its SHA-256 hash in `test/real-phone/labels.lock`. No existing line in `labels.lock` may be modified or removed without David's explicit ruling.
- **Scoreboard & Gate**: Evaluated via `npm run scoreboard:blind`.
  CI fails if any blind count set regresses or becomes catastrophic (off by 3 or more).

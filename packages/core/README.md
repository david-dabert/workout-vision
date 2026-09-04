# @workoutvision/core

Core pose analysis and form scoring engine.

## Usage

```javascript
import { EXERCISES, RepCounter, analyzeSet } from '@workoutvision/core';

// Get exercise definition
const squat = EXERCISES.squat;

// Create rep counter
const counter = new RepCounter('squat');

// Analyze a set of landmarks
const results = analyzeSet(landmarks, 'squat');
```

## Status

This package is in early extraction phase. The re-exports currently point to the monorepo source. A future build step will bundle them independently.

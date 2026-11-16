# 059. One data store on the phone, versioned, that keeps each set's body points
Status: ready
Executor: careful (Antigravity; Claude reviews before merge)
Phase: 1 (no screen changes; it protects data a later counter can recount)
Claim: every saved set keeps its body points, compressed, in one versioned store, so a better counter can recount old sets and a schema change never loses a set.
Reference: review panel of 16 November 2026, architecture lens: about 20 localforage stores opened from many files (`storage.js:10-15`, `coachStorage.js`, `contribute.js`); kiné patient data in plain `localStorage` (`kine/store.js`); `SCHEMA_VERSION = 1`; saved sets keep no landmarks (FLAWS #12).
Eval: a migration test from v1 to v2 keeps every set; a set saved today is recounted by today's core from its stored points to the same count; kiné data leaves `localStorage`; storage size per set printed (fflate, already a dependency).
Scope: `storage.js` and its callers, `kine/store.js`, tests. No screen, no counting file.
Stop: if a migration would drop any set, stop.
Needs from David: nothing.

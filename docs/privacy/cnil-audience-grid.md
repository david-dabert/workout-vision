# Usage counts per phone, against the CNIL's audience-measurement exemption

David, 16 November 2026: "Yes to the tracking, build it."
This file holds each condition of the exemption beside the line of code that meets it.
The conditions are taken from the CNIL's guidance on audience measurement as search results summarise it; they are to be checked at the source before anyone relies on this file:
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience
- the CNIL's self-assessment grid of July 2025, https://cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf

| Condition | How the app meets it | Where |
|---|---|---|
| Purpose limited to measuring the site's own audience | Events name screens and steps of the app only; read only on the worker's dashboard, behind STATS_TOKEN | `feedback-worker/usage-schema.js` (USAGE_EVENTS), `feedback-worker/usage.js` (handleDashboard) |
| Tracker life of 13 months at most, not extended by visits | `wv_aid` keeps the day it was made and is replaced after 395 days; a visit never changes that day | `src/lib/events.js` (AID_LIFE_DAYS, phoneId) |
| Data kept 25 months at most | Rows per phone deleted after 761 days by the worker's job | `feedback-worker/usage.js` (COHORT_KEEP_DAYS, purgeCohorts), `worker.js` (scheduled) |
| No cross-site tracking, no combination with other processing | The id is made on this site, sent only to this site's worker, never joined to the feedback table or any other data | `src/lib/events.js` (post), `feedback-worker/usage.js` (addCohort) |
| No sharing with third parties | The dashboard is behind STATS_TOKEN; David alone holds it until he names another recipient, who must then be named in the notice | `feedback-worker/usage.js` (authorised) |
| IP address not kept | No IP column; the rate limit's salted hash of the IP is deleted within three minutes | `feedback-worker/usage.js` (rateKey, purgeRateKeys) |
| People are told and can object | The notice « Mesure d'audience » names the id, its life, the retention and the server; turning it off deletes the id; Global Privacy Control and Do Not Track stop everything | `src/components/experience/usage-notice-copy.js`, `UsageNotice.jsx`, `src/lib/events.js` (setCountingOff, browserRefuses) |
| Stored id cannot be traced back | The worker stores an HMAC-SHA256 of the id keyed with the AID_PEPPER secret, cut to 64 bits; without the secret nothing is stored per phone | `feedback-worker/usage.js` (storedAid) |

Outside the exemption, and not built: names, any marketing use, replay of a visit, a device fingerprint, and the kiné path tied to the id.
The kiné path is counted only in daily totals (`AGGREGATE_ONLY`): a phone tied to a rehabilitation path would be health data (GDPR art. 9), which needs explicit consent.

Not verified: the conditions above against the CNIL's own text; Cloudflare's data processing agreement (a US processor).

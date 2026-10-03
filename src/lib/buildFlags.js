// Features a build offers only when it is asked to (WP0.3, WP0.4 of docs/SPEC-production.md). Vite replaces each
// import.meta.env value with the string the build was given, so a production build without the flag carries the
// feature switched off. deploy.yml leaves both unset; ci.yml sets them for the builds whose tests exercise them.
//
// VITE_LIVE=1: the Film screen offers live counting ("En direct"). Off in production until WP6.1-WP6.3 pass on
// David's iPhone (Phase 6; WP6.5 lifts it with D12).
// VITE_CONTRIBUTE=1: "Aider à améliorer le comptage" asks, collects and sends. Off in production until Phase 2 gives
// it a notice and a recorded consent (WP0.4). Off, the sets already waiting stay on the phone and can be erased.

/** True when this build offers live counting. */
export const liveBuild = () => import.meta.env.VITE_LIVE === '1';
/** True when this build asks for, collects and sends contributions. */
export const contributeBuild = () => import.meta.env.VITE_CONTRIBUTE === '1';

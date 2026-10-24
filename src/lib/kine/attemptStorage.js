// Where the patient's attempt video is kept while the AI commentary is asked for (glimpse.js, glimpse-proxy/), and
// whether a build may upload it.
// David, 24 October 2026: "switch the patient video upload off in production until private storage is proven on CI"
// (state map of 21 October 2026, defect 1: the video went into the Blob store with public access).
// ATTEMPT_ACCESS is the Vercel Blob access the upload asks for. It becomes 'private' only in the change that stores the
// attempts privately and proves it with a test on CI; until then no production build offers or performs the upload.
// The proxy holds the same rule for itself (glimpse-proxy/lib/guard.js). No import.meta here: vite.config.js reads it.
export const ATTEMPT_ACCESS = 'public';

/** Whether a build may upload an attempt: a production build never does while the store is public. */
export const uploadAllowed = (production, access = ATTEMPT_ACCESS) => !production || access === 'private';

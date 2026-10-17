// POST /api/upload: a token for the phone to put one attempt's video into the store's attempts folder (lib/handlers.js).
import { handlers } from './_handlers.js';

export const OPTIONS = request => handlers.preflight(request);
export const POST = request => handlers.upload(request);

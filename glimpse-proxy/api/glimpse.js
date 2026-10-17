// POST /api/glimpse: Elorian's commentary on one attempt's video, then the video deleted (lib/handlers.js).
import { handlers } from './_handlers.js';

export const OPTIONS = request => handlers.preflight(request);
export const POST = request => handlers.glimpse(request);

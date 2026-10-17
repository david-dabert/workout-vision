// GET /api/sweep: run daily by Vercel's cron (vercel.json); deletes any attempt older than 30 minutes (lib/handlers.js).
import { handlers } from './_handlers.js';

export const GET = request => handlers.sweep(request);

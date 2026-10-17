// The routes bound to Vercel's environment and the Blob store (lib/handlers.js). One instance's rate limiter is shared
// by its routes.
import { del, list } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { makeHandlers } from '../lib/handlers.js';

export const handlers = makeHandlers({ env: process.env, blob: { del, list, handleUpload } });

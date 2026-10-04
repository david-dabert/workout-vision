// Workout Vision Worker: anonymous usage counts, and the read-only aggregates of the old feedback table
// Deploy: npx wrangler deploy (README.md)
// POST /event: anonymous usage counts (usage.js). POST /ingest (feedback) was removed on 3 October 2026 (WP0.4): 404.
// GET /stats, GET /dashboard (usage) and GET /feedback (feedback aggregates): STATS_TOKEN, in the Authorization header
// only; POST /dashboard takes it from the dashboard's form. A job every minute deletes the rate-limit hashes (scheduled).
import { handleEvent, handleStats, handleDashboard, authorised, purgeRateKeys } from './usage.js';

// POST /ingest was removed on 3 October 2026 (WP0.4, docs/SPEC-production.md): it took free text and a hash of the IP
// salted with a constant written in this public repository, with no notice and no consent. It now answers 404 like any
// unknown path. The feedback table stays in schema.sql and in any deployed database: exporting then dropping it is
// David's decision D24 (R5), not this code's. GET /feedback still reads its aggregates, behind the token.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  // Every minute (wrangler.toml, crons): the usage rate limit's IP hashes older than the last minute are deleted, so
  // none outlives three minutes even when no event follows to delete it (review finding N4).
  async scheduled(controller, env, ctx) {
    const done = purgeRateKeys(env, controller?.scheduledTime ?? Date.now());
    if (ctx?.waitUntil) ctx.waitUntil(done);
    await done;
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Anonymous usage counts (usage.js)
    if (request.method === 'POST' && url.pathname === '/event') return handleEvent(request, env, corsHeaders());
    if (request.method === 'GET' && url.pathname === '/stats') return handleStats(request, env);
    if ((request.method === 'GET' || request.method === 'POST') && url.pathname === '/dashboard') return handleDashboard(request, env);

    // Feedback aggregates (read-only). Behind the token since 3 October: it was open to anyone before.
    if (request.method === 'GET' && url.pathname === '/feedback') {
      if (!(await authorised(request, env))) return new Response('Unauthorized', { status: 401 });
      const stats = await env.DB.prepare(
        `SELECT kind, COUNT(*) as count,
         detected, corrected,
         AVG(confidence) as avg_confidence
         FROM feedback
         GROUP BY kind, detected, corrected
         ORDER BY count DESC
         LIMIT 100`
      ).all();

      return new Response(JSON.stringify(stats.results, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};

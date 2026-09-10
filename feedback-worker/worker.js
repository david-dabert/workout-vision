// Workout Vision Feedback Ingest Worker
// Deploy: npx wrangler deploy
// Dashboard: GET /dashboard

const SCHEMA_VERSION = 1;
const MAX_PAYLOAD = 4096;
const BANNED_FIELDS = ['landmarks', 'video', 'frames', 'imageData', 'blob'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Dashboard (read-only)
    if (request.method === 'GET' && url.pathname === '/dashboard') {
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Ingest
    if (request.method === 'POST' && url.pathname === '/ingest') {
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_PAYLOAD) {
        return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      // Reject payloads containing banned fields (privacy)
      for (const field of BANNED_FIELDS) {
        if (field in body) {
          return new Response(JSON.stringify({ error: `Field '${field}' not allowed` }), { status: 422 });
        }
      }

      // Validate schema
      if (body.v !== SCHEMA_VERSION) {
        return new Response(JSON.stringify({ error: 'Schema version mismatch' }), { status: 422 });
      }

      const validKinds = ['correction', 'crash', 'feedback', 'rating'];
      if (!validKinds.includes(body.kind)) {
        return new Response(JSON.stringify({ error: 'Invalid kind' }), { status: 422 });
      }

      // Insert
      await env.DB.prepare(
        `INSERT INTO feedback (kind, app_version, device_class, detected, corrected, confidence, rep_count, rep_expected, message, diag, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        body.kind,
        body.appVersion || null,
        body.deviceClass || null,
        body.detected || null,
        body.corrected || null,
        body.confidence || null,
        body.repCount || null,
        body.repExpected || null,
        body.message || null,
        body.diag ? JSON.stringify(body.diag) : null
      ).run();

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};

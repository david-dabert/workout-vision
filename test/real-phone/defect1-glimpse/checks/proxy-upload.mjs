// What POST /api/upload answers, with the proxy's own handlers (glimpse-proxy/lib/handlers.js) and a stand-in store.
// Arguments: the folders holding each revision's copy (local-checks.sh).
const env = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_abc123_secret', ELORIAN_API_KEY: 'k', CRON_SECRET: 'c' };
const post = () => new Request('https://proxy.example/api/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', origin: 'https://david-dabert.github.io', 'x-real-ip': '1.2.3.4' },
  body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: 'attempts/a.mp4' } }),
});
for (const dir of process.argv.slice(2)) {
  const { makeHandlers } = await import(`${dir}/glimpse-proxy/lib/handlers.js`);
  for (const opts of [{}, { access: 'private' }]) {
    let tokens = 0;
    const blob = {
      del: async () => {},
      list: async () => ({ blobs: [] }),
      handleUpload: async ({ onBeforeGenerateToken }) => { tokens++; return { type: 'blob.generate-client-token', options: await onBeforeGenerateToken('attempts/a.mp4') }; },
    };
    const res = await makeHandlers({ env, blob, now: () => 0, ...opts }).upload(post());
    const body = await res.text();
    console.log(`proxy ${dir.split('/').pop()} access ${opts.access ?? '(default)'}: status ${res.status}, tokens given ${tokens}, body ${body.slice(0, 40)}`);
  }
}

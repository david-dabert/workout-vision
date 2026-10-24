// glimpse.js (the app's side of the AI commentary) in a development and a production build, with the proxy named.
// Arguments: the folders holding each revision's copy, import.meta.env replaced by globalThis.__env (local-checks.sh).
for (const dir of process.argv.slice(2)) {
  for (const PROD of [false, true]) {
    globalThis.__env = { VITE_GLIMPSE_URL: 'https://glimpse.example.app', PROD };
    const m = await import(`${dir}/src/lib/kine/glimpse.js?prod=${PROD}`);
    let uploads = 0, calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ commentary: { summary: 's' } })); };
    const uploader = async () => { uploads++; return { url: 'https://s.public.blob.vercel-storage.com/attempts/x.mov' }; };
    let outcome;
    try {
      await m.askGlimpse({ name: 'a.mov', type: '', size: 10 }, { id: 'a', text: {} }, { base: 'https://glimpse.example.app', uploader });
      outcome = 'commentary returned';
    } catch (e) {
      outcome = `refused (${e.message}, why ${e.why})`;
    }
    console.log(`app ${dir.split('/').pop()} PROD=${PROD}: glimpseOn ${m.glimpseOn()}, askGlimpse ${outcome}, uploads ${uploads}, proxy calls ${calls}`);
  }
}

# A page open across a deploy (2 October 2026)

David's report said "The PDF could not be prepared" at 23:00, ten minutes after PR #57 was published.
The page had been open since before the deploy. The new service worker took control and deleted the previous
version's cache; the site no longer served the previous files either. The page's own report-pdf chunk was gone.

Reproduction: `node test/real-phone/deploy-race/deploy-race.mjs <build A> <build B>` serves build A, loads it
with its worker, swaps the site to build B, lets the new worker take over, and fetches A's report-pdf chunk from
the open page. Builds differ by one value in report-pdf.js; PW_CHROMIUM set.

| Worker | Controller changed | A's report-pdf chunk |
|---|---|---|
| as merged (3f55fcf) | yes | 404 |
| keeping the previous version's cache | yes | 200 |

The fix keeps one previous version, for one deploy (public/sw.js, src/lib/__tests__/sw-versions.test.js).
It protects from the deploy after this one onward: the first deploy of the fix still drops what came before it.

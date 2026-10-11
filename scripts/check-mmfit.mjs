import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const harness = fs.readFileSync('test/real-phone/harness.js', 'utf8');
const block = harness.slice(harness.indexOf('const originalError'), harness.indexOf("const log = document"));
const calls = [];
const sandbox = { console: { error: (...args) => calls.push(['error', ...args]), info: (...args) => calls.push(['info', ...args]) } };
vm.runInNewContext(block, sandbox);
const message = 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.';
sandbox.console.error(message);
sandbox.console.error('actual failure');
sandbox.console.error(message, 'extra error context');
sandbox.console.error('Prefix ' + message);
assert.deepEqual(calls, [['info', message], ['error', 'actual failure'], ['error', message, 'extra error context'], ['error', 'Prefix ' + message]]);
console.log('PASS: only the exact single-argument XNNPACK startup line becomes info; other errors remain errors.');
const dir = 'test/real-phone/mmfit';
if (process.argv.includes('--complete')) {
  const inventory = JSON.parse(fs.readFileSync(dir + '/inventory.json'));
  const results = JSON.parse(fs.readFileSync(dir + '/results.json'));
  assert.deepEqual(results.rows.map(r => r.id), inventory.map(s => s.id));
  const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(results.coreHash, sha('src/lib/counting/core.ts'));
  assert.equal(results.harnessHash, sha('test/real-phone/harness.js'));
  for (const row of results.rows) {
    const set = inventory.find(s => s.id === row.id);
    assert.equal(row.expected, set.expected);
    assert.equal(row.lift, set.lift);
    assert.equal(sha(set.labelFile), set.labelHash);
    assert.equal(row.admitted, row.sampleCount > 0 && row.visibleSamples * 10 >= row.sampleCount * 9);
    assert.equal(row.score, row.count !== null && row.count === row.expected && !row.consoleErrors.length && !row.failedRequests.length && !(row.attemptFailures?.length) ? 'PASS' : 'FAIL');
    assert.ok(row.landmarks, 'No harness landmarks: ' + row.id);
    assert.equal(sha(row.landmarks.path), row.landmarks.sha256);
  }
  console.log(JSON.stringify({ sets: results.rows.length, pass: results.rows.filter(r => r.score === 'PASS').length, fail: results.rows.filter(r => r.score === 'FAIL').length, admitted: results.rows.filter(r => r.admitted).length, excluded: results.rows.filter(r => !r.admitted).length, consoleErrors: results.rows.reduce((n, r) => n + r.consoleErrors.length, 0), failedRequests: results.rows.reduce((n, r) => n + r.failedRequests.length, 0), xnnpackInfo: results.rows.reduce((n, r) => n + r.xnnpackInfo, 0) }));
  console.log('PASS: every labelled set appears exactly once; admission, scores, saved landmark hashes, and unchanged core/harness hashes verified.');
}

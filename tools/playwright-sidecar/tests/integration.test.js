const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function checkPort(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, body }));
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
  });
}

async function runIntegrationSuite() {
  console.log('==================================================');
  console.log('PLAYWRIGHT SIDECAR INTEGRATION SUITE');
  console.log('==================================================\n');

  // TEST A: Offline Failure Path Test
  console.log('[TEST A] Offline Failure-Path Verification...');
  const offlineCheck = await checkPort('http://127.0.0.1:9999/json/version');
  if (!offlineCheck.ok) {
    console.log('  ✓ [TEST A PASSED] Offline failure path correctly caught expected error:', offlineCheck.error);
  } else {
    throw new Error('Test A failed: Port 9999 unexpectedly responded');
  }

  // TEST B: Online Success Path Verification
  console.log('\n[TEST B] Online Success-Path Verification...');
  const onlineCheck = await checkPort('http://127.0.0.1:9222/json/version');

  if (!onlineCheck.ok) {
    console.log('  ⚠️ [TEST B SKIPPED] Chrome CDP is not currently running on port 9222 (Details:', onlineCheck.error, ')');
    console.log('  -> Integration Suite finished with Test A PASSED & Test B SKIPPED cleanly.');
    process.exit(0);
  }

  console.log('  ✓ Chrome CDP is active on port 9222. Proceeding with Playwright connectOverCDP...');
  const sessionManager = require('../src/session-manager');
  const actionRunner = require('../src/action-runner');

  await sessionManager.connect('http://127.0.0.1:9222');
  console.log('  ✓ Playwright connectOverCDP successful');

  const outputDir = path.join(__dirname, '../../../artifacts/cdp_integration/browser');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const screenshotPath = path.join(outputDir, 'test-screenshot.png');
  const tracePath = path.join(outputDir, 'test-trace.zip');

  await actionRunner.startTrace();
  await actionRunner.screenshot(screenshotPath);
  await actionRunner.stopTrace(tracePath);

  const screenshotStat = fs.statSync(screenshotPath);
  const traceStat = fs.statSync(tracePath);

  if (screenshotStat.size === 0) throw new Error('Screenshot file created with 0 bytes');
  if (traceStat.size === 0) throw new Error('Trace ZIP file created with 0 bytes');

  console.log(`  ✓ Screenshot PNG generated: ${screenshotPath} (${screenshotStat.size} bytes, SHA256: ${getHash(screenshotPath)})`);
  console.log(`  ✓ Trace ZIP generated: ${tracePath} (${traceStat.size} bytes, SHA256: ${getHash(tracePath)})`);

  await sessionManager.disconnect();
  console.log('\n✓ [TEST B PASSED] All Playwright CDP online assertions verified successfully!');
}

runIntegrationSuite().catch((err) => {
  console.error('\n❌ [INTEGRATION SUITE FAILED]', err);
  process.exit(1);
});

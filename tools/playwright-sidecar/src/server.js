const express = require('express');
const sessionManager = require('./session-manager');
const actionRunner = require('./action-runner');

const app = express();
const PORT = process.env.PLAYWRIGHT_SIDECAR_PORT || 9223;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-cdp-sidecar', port: PORT });
});

app.post('/connect', async (req, res) => {
  try {
    const { cdpUrl } = req.body || {};
    const result = await sessionManager.connect(cdpUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/pages', async (req, res) => {
  try {
    const pages = await sessionManager.getPages();
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/navigate', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });
    const result = await actionRunner.navigate(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/click', async (req, res) => {
  try {
    const { selector } = req.body;
    if (!selector) return res.status(400).json({ error: 'Missing selector' });
    const result = await actionRunner.click(selector);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/fill', async (req, res) => {
  try {
    const { selector, value } = req.body;
    if (!selector || value === undefined) return res.status(400).json({ error: 'Missing selector or value' });
    const result = await actionRunner.fill(selector, value);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/upload', async (req, res) => {
  try {
    const { selector, filePaths } = req.body;
    if (!selector || !filePaths) return res.status(400).json({ error: 'Missing selector or filePaths' });
    const result = await actionRunner.upload(selector, filePaths);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/screenshot', async (req, res) => {
  try {
    const { outputPath } = req.body;
    if (!outputPath) return res.status(400).json({ error: 'Missing outputPath' });
    const result = await actionRunner.screenshot(outputPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/trace/start', async (req, res) => {
  try {
    const result = await actionRunner.startTrace();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/trace/stop', async (req, res) => {
  try {
    const { outputPath } = req.body;
    if (!outputPath) return res.status(400).json({ error: 'Missing outputPath' });
    const result = await actionRunner.stopTrace(outputPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/cancel', (req, res) => {
  res.json({ success: true, message: 'Sidecar action cancelled' });
});

app.post('/disconnect', async (req, res) => {
  try {
    const result = await sessionManager.disconnect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Playwright CDP sidecar listening on port ${PORT}`);
});

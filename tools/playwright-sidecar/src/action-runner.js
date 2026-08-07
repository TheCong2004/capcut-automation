const sessionManager = require('./session-manager');
const fs = require('fs');
const path = require('path');

class ActionRunner {
  getPage() {
    if (!sessionManager.activePage) {
      throw new Error('No active browser page session. Call /connect first.');
    }
    return sessionManager.activePage;
  }

  async navigate(url) {
    const page = this.getPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return {
      status: response ? response.status() : 200,
      url: page.url(),
      title: await page.title(),
    };
  }

  async click(selector) {
    const page = this.getPage();
    await page.click(selector, { timeout: 10000 });
    return { success: true, clicked: selector };
  }

  async fill(selector, value) {
    const page = this.getPage();
    await page.fill(selector, value, { timeout: 10000 });
    return { success: true, filled: selector, value };
  }

  async upload(selector, filePaths) {
    const page = this.getPage();
    await page.setInputFiles(selector, filePaths);
    return { success: true, uploaded: filePaths };
  }

  async screenshot(outputPath) {
    const page = this.getPage();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await page.screenshot({ path: outputPath, fullPage: false });
    const stat = fs.statSync(outputPath);
    if (stat.size === 0) {
      throw new Error('Screenshot file created with 0 bytes');
    }
    return {
      success: true,
      path: outputPath,
      sizeBytes: stat.size,
      mimeType: 'image/png',
    };
  }

  async startTrace() {
    if (!sessionManager.context) {
      throw new Error('No active browser context');
    }
    await sessionManager.context.tracing.start({ screenshots: true, snapshots: true });
    sessionManager.isTracing = true;
    return { success: true, tracing: true };
  }

  async stopTrace(outputPath) {
    if (!sessionManager.context || !sessionManager.isTracing) {
      throw new Error('Tracing was not active');
    }
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await sessionManager.context.tracing.stop({ path: outputPath });
    sessionManager.isTracing = false;
    const stat = fs.statSync(outputPath);
    if (stat.size === 0) {
      throw new Error('Trace ZIP created with 0 bytes');
    }
    return {
      success: true,
      path: outputPath,
      sizeBytes: stat.size,
      mimeType: 'application/zip',
    };
  }
}

module.exports = new ActionRunner();

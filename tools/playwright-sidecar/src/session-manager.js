const { chromium } = require('playwright');
const fs = require('fs');

class SessionManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.activePage = null;
    this.isTracing = false;
  }

  async connect(cdpUrl = 'http://localhost:9222') {
    try {
      this.browser = await chromium.connectOverCDP(cdpUrl);
      const contexts = this.browser.contexts();
      this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();
      const pages = this.context.pages();
      this.activePage = pages.length > 0 ? pages[0] : await this.context.newPage();
      return { success: true, connectedUrl: cdpUrl };
    } catch (err) {
      // Fallback: launch chromium if CDP endpoint not active
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext();
      this.activePage = await this.context.newPage();
      return { success: true, launched: true, message: err.message };
    }
  }

  async getPages() {
    if (!this.context) return [];
    const pages = this.context.pages();
    const result = [];
    for (let i = 0; i < pages.length; i++) {
      result.push({
        index: i,
        url: pages[i].url(),
        title: await pages[i].title().catch(() => ''),
      });
    }
    return result;
  }

  async disconnect() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.activePage = null;
    }
    return { success: true };
  }
}

module.exports = new SessionManager();

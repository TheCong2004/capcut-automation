import React, { useState, useEffect } from 'react';
import { cdpSessionManager, AutomationHealth, CdpPageInfo } from '../services/cdpAutomationManager';
import { Globe, RefreshCw, Power, ExternalLink, Camera, FileCode, CheckCircle2, AlertTriangle, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

export const BrowserCdpView: React.FC = () => {
  const [health, setHealth] = useState<AutomationHealth>({
    connected: false,
    cdpEndpoint: 'http://127.0.0.1:9222',
    activeTabsCount: 0,
    lastChecked: 'Just now',
  });
  const [pages, setPages] = useState<CdpPageInfo[]>([]);
  const [activeUrl, setActiveUrl] = useState<string>('https://tiktok.com/studio/trends');
  const [loading, setLoading] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(
    'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=80'
  );
  const [tracePath, setTracePath] = useState<string>('artifacts/traces/playwright_trace_active.zip');
  const [logs, setLogs] = useState<string[]>([
    '[14:40:01] CDP Session Manager initialized.',
    '[14:40:02] Target endpoint: http://127.0.0.1:9222',
    '[14:40:05] Listed 2 active browser tabs.',
    '[14:40:08] Attached to TikTok Studio / Trends (https://tiktok.com/studio/trends)',
  ]);

  const refreshCdp = async () => {
    setLoading(true);
    try {
      const h = await cdpSessionManager.healthCheck();
      setHealth(h);
      const pList = await cdpSessionManager.listPages();
      setPages(pList);
      if (pList.length > 0) {
        setActiveUrl(pList[0].url);
      }
      toast.success(h.connected ? 'CDP Connection Active (:9222)' : 'CDP Disconnected (Playwright Fallback)');
    } catch (e: any) {
      toast.error('CDP Health Check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCdp();
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    const ok = await cdpSessionManager.connect();
    await refreshCdp();
    setLoading(false);
    if (ok) toast.success('Connected to Chrome DevTools Protocol!');
  };

  const handleDisconnect = async () => {
    await cdpSessionManager.disconnect();
    await refreshCdp();
    toast('Disconnected from CDP session', { icon: 'ℹ️' });
  };

  const handleTakeScreenshot = async () => {
    const path = await cdpSessionManager.takeScreenshot();
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Screenshot saved to ${path}`]);
    toast.success(`Chụp màn hình CDP thành công: ${path}`);
  };

  return (
    <div
      style={{ backgroundColor: '#1a1e28', border: '1px solid rgba(255, 255, 255, 0.08)' }}
      className="rounded-2xl p-5 shadow-md select-none text-slate-100 font-sans h-full overflow-y-auto space-y-5"
    >
      {/* Header */}
      <div style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="font-bold text-base text-white">Browser CDP Manager — Playwright & CDP Browser Engine</h2>
            <p className="text-xs text-slate-300">Quản lý kết nối Chrome DevTools Protocol (:9222) & Tự động hóa Browser Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleConnect}
            className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-3 py-1 rounded-lg transition-colors font-bold"
          >
            <Power className="w-3.5 h-3.5" /> Connect (:9222)
          </button>

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 px-3 py-1 rounded-lg transition-colors"
          >
            Disconnect
          </button>

          <button
            onClick={refreshCdp}
            disabled={loading}
            className="p-1.5 text-slate-300 hover:text-amber-300 bg-[#232836] rounded-lg transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connection Status & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
        <div style={{ backgroundColor: '#12151e' }} className="p-3.5 rounded-xl border border-slate-700/40">
          <span className="text-slate-400 text-[11px]">Connection Status</span>
          <div className="flex items-center gap-1.5 mt-1 font-bold text-sm">
            {health.connected ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> CONNECTED
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> STANDBY (Fallback)
              </span>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: '#12151e' }} className="p-3.5 rounded-xl border border-slate-700/40">
          <span className="text-slate-400 text-[11px]">CDP Endpoint</span>
          <div className="font-bold text-sm text-white mt-1 truncate" title={health.cdpEndpoint}>
            {health.cdpEndpoint}
          </div>
        </div>

        <div style={{ backgroundColor: '#12151e' }} className="p-3.5 rounded-xl border border-slate-700/40">
          <span className="text-slate-400 text-[11px]">Browser Version</span>
          <div className="font-bold text-sm text-amber-300 mt-1 truncate">
            {health.browserVersion || 'Chromium Headless'}
          </div>
        </div>

        <div style={{ backgroundColor: '#12151e' }} className="p-3.5 rounded-xl border border-slate-700/40">
          <span className="text-slate-400 text-[11px]">Active Tabs</span>
          <div className="font-bold text-sm text-purple-300 mt-1">
            {health.activeTabsCount} Open Tabs
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Active Pages & Actions, Right = Live Preview & Automation Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Active Tabs & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div style={{ backgroundColor: '#12151e' }} className="p-4 rounded-xl border border-slate-700/40 space-y-3 font-mono text-xs">
            <h3 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
              <Monitor className="w-4 h-4" /> Danh sách Tabs/Pages đang Mở
            </h3>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {pages.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setActiveUrl(p.url)}
                  style={{
                    backgroundColor: activeUrl === p.url ? 'rgba(251, 191, 36, 0.15)' : '#1e2332',
                    border: activeUrl === p.url ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  className="p-2.5 rounded-xl cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between font-bold text-slate-100 text-xs">
                    <span className="truncate">{p.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5" title={p.url}>
                    {p.url}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#12151e' }} className="p-4 rounded-xl border border-slate-700/40 space-y-2 font-mono text-xs">
            <h3 className="font-bold text-sm text-white">Browser Automation Controls</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleTakeScreenshot}
                className="flex items-center justify-center gap-1.5 bg-[#232836] hover:bg-[#2d3448] text-white py-2 rounded-xl font-bold transition-colors"
              >
                <Camera className="w-4 h-4 text-emerald-400" /> Chụp Màn hình
              </button>

              <button
                onClick={() => {
                  toast.success(`Trace file ready at ${tracePath}`);
                }}
                className="flex items-center justify-center gap-1.5 bg-[#232836] hover:bg-[#2d3448] text-white py-2 rounded-xl font-bold transition-colors"
              >
                <FileCode className="w-4 h-4 text-blue-400" /> Playwright Trace
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Screenshot & Automation Logs (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Live Preview Box */}
          <div style={{ backgroundColor: '#12151e' }} className="p-4 rounded-xl border border-slate-700/40 space-y-2">
            <div className="flex items-center justify-between font-mono text-xs text-slate-300">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" /> CDP Live Browser View
              </span>
              <span className="text-amber-300 truncate max-w-[300px]">{activeUrl}</span>
            </div>

            <div className="relative rounded-xl overflow-hidden h-[180px] bg-black border border-slate-800">
              {screenshotUrl ? (
                <img src={screenshotUrl} alt="CDP Screenshot" className="w-full h-full object-cover" />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                  No Live Screenshot Available
                </div>
              )}
            </div>
          </div>

          {/* Automation Logs */}
          <div style={{ backgroundColor: '#090b10' }} className="p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1 h-[140px] overflow-y-auto">
            <div className="text-amber-300 font-bold mb-1">▶ Browser Automation Execution Trace Logs</div>
            {logs.map((l, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-relaxed">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

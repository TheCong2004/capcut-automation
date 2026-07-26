import { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, Cpu, Loader2, ServerOff } from "lucide-react";

export function PageOmniRoute() {
  const [key, setKey] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const omniUrl = "http://localhost:20128";

  const checkConnection = async () => {
    setChecking(true);
    try {
      await fetch(omniUrl, { method: "HEAD", mode: "no-cors" });
      setIsReady(true);
    } catch {
      setIsReady(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, [key]);

  return (
    <div className="flex h-[calc(100vh-56px)] w-full flex-col bg-[#0f1015]">
      {/* Sub-header bar */}
      <div className="flex h-12 w-full shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#14151c] px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">OmniRoute AI Router</h2>
            <p className="text-[11px] text-slate-400">Router 290+ Nhà cung cấp LLM · MCP Server (104 tools) · A2A Protocol</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setKey((k) => k + 1);
              checkConnection();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Tải lại giao diện OmniRoute"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            <span>Tải lại</span>
          </button>
          <a
            href={omniUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Mở trình duyệt</span>
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 w-full overflow-hidden bg-[#0f1015]">
        {isReady ? (
          <iframe
            key={key}
            src={omniUrl}
            className="h-full w-full border-none"
            title="OmniRoute AI Router"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-300">
            <div className="rounded-2xl border border-indigo-500/20 bg-[#161822] p-8 max-w-md space-y-4 shadow-2xl">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {checking ? <Loader2 className="h-7 w-7 animate-spin" /> : <ServerOff className="h-7 w-7" />}
                </div>
              </div>
              <h3 className="text-lg font-bold text-white">Đang khởi động OmniRoute AI Router...</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hệ thống đang tự động tải gói phụ thuộc và khởi tạo server OmniRoute trên cổng :20128.
              </p>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => {
                    setKey((k) => k + 1);
                    checkConnection();
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition flex items-center gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
                  Kiểm tra lại kết nối
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

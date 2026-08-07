import React, { useState, useEffect, useCallback } from "react";
import { InkOSFrame } from "./InkOSFrame";
import { RefreshCw, ExternalLink, BookOpen, Loader2, ServerOff } from "lucide-react";

const INKOS_URL =
  import.meta.env.VITE_INKOS_URL ?? "http://127.0.0.1:4567";

type InkOSStatus = "checking" | "ready" | "offline";

export const PageInkOS: React.FC = () => {
  const [status, setStatus] = useState<InkOSStatus>("checking");
  const [key, setKey] = useState(0);

  const checkConnection = useCallback(async () => {
    setStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    try {
      await fetch(INKOS_URL, {
        method: "GET",
        mode: "no-cors",
        signal: controller.signal,
      });
      setStatus("ready");
    } catch {
      setStatus("offline");
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    fetch(INKOS_URL, {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
    })
      .then(() => {
        if (isMounted) setStatus("ready");
      })
      .catch(() => {
        if (isMounted) setStatus("offline");
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [key]);

  return (
    <div className="flex h-[calc(100vh-56px)] w-full flex-col bg-[#0f1015]">
      {/* Sub-header bar */}
      <div className="flex h-12 w-full shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#14151c] px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              InkOS Story Studio
            </h2>
            <p className="text-[11px] text-slate-400">
              Story Creation AI Agent · Web Workbench for Fiction & Scripts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setKey((k) => k + 1);
              checkConnection();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Tải lại giao diện InkOS"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                status === "checking" ? "animate-spin" : ""
              }`}
            />
            <span>Tải lại</span>
          </button>
          <a
            href={INKOS_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Mở trình duyệt</span>
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 w-full overflow-hidden bg-[#0f1015]">
        {status === "ready" && <InkOSFrame key={key} />}

        {status === "checking" && (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-300">
            <div className="rounded-2xl border border-purple-500/20 bg-[#161822] p-8 max-w-md space-y-4 shadow-2xl">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white">
                Đang kết nối tới InkOS Studio...
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Đang kiểm tra dịch vụ InkOS Story Studio tại {INKOS_URL}
              </p>
            </div>
          </div>
        )}

        {status === "offline" && (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-300">
            <div className="rounded-2xl border border-purple-500/20 bg-[#161822] p-8 max-w-md space-y-4 shadow-2xl">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <ServerOff className="h-7 w-7" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white">
                InkOS is not running
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chưa phát hiện InkOS Story Studio đang chạy tại địa chỉ{" "}
                <code className="text-purple-300 font-mono">{INKOS_URL}</code>.
                <br />
                Vui lòng khởi động InkOS Studio bằng lệnh bên dưới.
              </p>
              <div className="rounded-lg bg-slate-900 p-3 text-left font-mono text-[11px] text-purple-300 border border-slate-800">
                pnpm --filter @actalk/inkos-studio dev
              </div>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => {
                    setKey((k) => k + 1);
                    checkConnection();
                  }}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      status === "checking" ? "animate-spin" : ""
                    }`}
                  />
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

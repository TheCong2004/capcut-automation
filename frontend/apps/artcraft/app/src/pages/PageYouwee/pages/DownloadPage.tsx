import {
  CheckCircle2,
  Clipboard,
  Download,
  Link2,
  Server,
  Settings,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { isTauri } from "@/lib/tauri";
import { useDownload } from "@/pages/PageYouwee/contexts/download-context";
import type { Quality } from "@/pages/PageYouwee/lib/types";

type Mode = "video" | "audio" | "playlist";
type BackendStatus = "checking" | "connected" | "error";

const apiRows = [
  ["/dl/video", "api/v1/dl/video"],
  ["/dl/audio", "api/v1/dl/audio"],
  ["/ai/sub", "api/v1/whisper"],
  ["/meta/info", "api/v1/metadata"],
];

function getYouTubeVideoId(value: string) {
  try {
    const parsedUrl = new URL(value.trim());
    const host = parsedUrl.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsedUrl.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      const [, route, videoId] = parsedUrl.pathname.split("/");
      if (route === "shorts" || route === "embed" || route === "live") {
        return videoId || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function DownloadPage() {
  const { enqueueExternalUrl, isDownloading, startDownload } = useDownload();
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [mode, setMode] = useState<Mode>("video");
  const [quality, setQuality] = useState<Quality>("best");
  const [log, setLog] = useState("");
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const videoId = useMemo(() => getYouTubeVideoId(url), [url]);
  const thumbnailUrl =
    videoId && !thumbnailFailed ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

  const checkBackend = async () => {
    setBackendStatus("checking");
    try {
      const health = await invoke<{ connected: boolean; version: string }>(
        "youwee_backend_health",
      );
      if (!health.connected) {
        throw new Error("Backend reported disconnected");
      }
      setBackendStatus("connected");
      setLog((current) => `${current}\n[BE] Connected — Youwee ${health.version}`.trim());
    } catch (error) {
      setBackendStatus("error");
      setLog(
        (current) =>
          `${current}\n[BE error] ${error instanceof Error ? error.message : String(error)}`.trim(),
      );
    }
  };

  useEffect(() => {
    if (!isTauri) {
      setBackendStatus("error");
      setLog((current) => `${current}\n[BE] Running in Web Browser mode`.trim());
      return;
    }
    void checkBackend();
  }, []);

  const onDownload = async () => {
    setLog(`[download] Queueing ${mode} download...\nURL: ${url}\nQuality: ${quality}`);
    try {
      const result = await enqueueExternalUrl(url, {
        mediaType: mode === "audio" ? "audio" : "video",
        quality: mode === "audio" ? "audio" : quality,
        downloadPlaylist: mode === "playlist",
      });
      if (!result.added && !result.itemId) {
        setLog((current) => `${current}\n[error] URL could not be added to the queue.`);
        return;
      }
      setLog((current) => `${current}\n[download] Backend accepted the request.`);
      await startDownload();
    } catch (error) {
      setLog(
        (current) =>
          `${current}\n[error] ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const clearForm = () => {
    setUrl("");
    setLog("");
  };

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`rounded px-4 py-2 text-[13px] font-medium transition-colors ${
        mode === value
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-primary">Youwee</span>
          <span className="rounded border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            yt-dlp GUI
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden items-center gap-2 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                backendStatus === "connected"
                  ? "bg-primary shadow-[0_0_7px_hsl(var(--primary))]"
                  : backendStatus === "checking"
                    ? "animate-pulse bg-amber-400"
                    : "bg-destructive"
              }`}
            />
            BE Status:{" "}
            {backendStatus === "connected"
              ? "Connected"
              : backendStatus === "checking"
                ? "Checking"
                : "Disconnected"}
          </span>
          <button
            type="button"
            onClick={() => void checkBackend()}
            className="rounded border border-border bg-card px-3 py-1.5 hover:bg-muted hover:text-foreground"
          >
            Check BE
          </button>
          <Server className="h-4 w-4" />
          <Settings className="h-4 w-4" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 p-5 lg:p-6">
            <section className="rounded-lg border border-border bg-card p-4">
              <label htmlFor="download-url" className="mb-2 block text-xs font-medium text-muted-foreground">
                Video URL
              </label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="download-url"
                  type="text"
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setThumbnailFailed(false);
                  }}
                  className="min-w-0 flex-1 bg-transparent py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <button
                  type="button"
                  aria-label="Paste URL"
                  onClick={() =>
                    navigator.clipboard
                      ?.readText()
                      .then((value) => {
                        setUrl(value);
                        setThumbnailFailed(false);
                      })
                      .catch(() => {})
                  }
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Clipboard className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Mode
                  </span>
                  <div className="flex rounded-md border border-border bg-background p-1">
                    {modeButton("video", "Video")}
                    {modeButton("audio", "Audio only")}
                    {modeButton("playlist", "Playlist")}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-muted-foreground">
                    <span className="mb-1.5 block">Quality</span>
                    <select
                      value={quality}
                      onChange={(event) => setQuality(event.target.value as Quality)}
                      className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
                    >
                      <option value="best">Best (Auto)</option>
                      <option value="1080">1080p</option>
                      <option value="720">720p</option>
                      <option value="480">480p</option>
                      <option value="audio">Audio (MP3)</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={clearForm}
                    className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa
                  </button>
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={!url.trim() || isDownloading}
                    className="flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    {isDownloading ? "Đang tải…" : "Tải xuống"}
                  </button>
                </div>
              </div>
            </section>

            {videoId && (
              <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card sm:flex-row">
                <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted sm:w-64">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="YouTube video preview"
                      onError={() => setThumbnailFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Thumbnail unavailable
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-1 font-mono text-[10px] text-white">
                    YouTube
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Video preview
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-foreground">
                      Ready to download
                    </h2>
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{url}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Video ID: <span className="text-primary">{videoId}</span>
                  </p>
                </div>
              </section>
            )}

            <section className="flex min-h-48 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-black">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Engine Output
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLog("")}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <pre className="min-h-36 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-neutral-400">
                {log || "[yt-dlp] Ready — paste a URL and choose your download options."}
              </pre>
            </section>
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card xl:flex">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <div>
              <h2 className="text-sm font-semibold">API Catalog</h2>
              <p className="text-[10px] text-muted-foreground">Available engine routes</p>
            </div>
            <button type="button" aria-label="Close API catalog" className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 border-b border-border p-3">
            {["All", "Download", "AI", "Whisper"].map((filter, index) => (
              <span
                key={filter}
                className={`rounded border px-2 py-1 font-mono text-[10px] ${
                  index === 0
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {filter}
              </span>
            ))}
          </div>
          <div className="p-3">
            <div className="mb-2 grid grid-cols-[90px_1fr] px-2 font-mono text-[10px] text-muted-foreground">
              <span>Command</span>
              <span>HTTP Path</span>
            </div>
            {apiRows.map(([command, path]) => (
              <div
                key={command}
                className="grid grid-cols-[90px_1fr] border-t border-border px-2 py-2.5 font-mono text-[10px] hover:bg-muted/50"
              >
                <span className="text-primary">{command}</span>
                <span className="truncate text-muted-foreground">{path}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-border p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Engine 1.8.0 stable
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-card px-4 font-mono text-[10px] text-muted-foreground">
        <span className="truncate">BE: Youwee logic → HTTP sidecar + staged resources</span>
        <span className="ml-4 shrink-0">v2.4.1 | Engine: 1.8.0</span>
      </footer>
    </div>
  );
}

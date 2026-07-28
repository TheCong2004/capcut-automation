import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
/** Single BE entry — xem capcutBeClient (delegate → mate, tương lai /v1). */
import * as api from "./capcutBeClient";

export interface CapCutMateState {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  online: boolean | null;
  checking: boolean;
  refreshOnline: () => Promise<void>;
  draftUrl: string | null;
  tipUrl: string | null;
  width: number;
  height: number;
  setCanvasSize: (w: number, h: number) => void;
  busy: boolean;
  createProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  setDraftUrl: (url: string | null) => void;
  /** Last known total duration of timeline (µs), updated by material adds */
  timelineEndUs: number;
  setTimelineEndUs: (us: number) => void;
  ensureDraft: () => string;
  /** Folder draft CapCut local (API /v1/local/*) */
  localProject: string;
  setLocalProject: (path: string) => void;
}

const CapCutMateContext = createContext<CapCutMateState | null>(null);

const DRAFT_STORAGE = "capcut-mate-draft-url";
const LOCAL_PROJECT_STORAGE = "capcut-local-project-path";

export function CapCutMateProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState(api.getCapCutMateBaseUrl);
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [draftUrl, setDraftUrlState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DRAFT_STORAGE);
    } catch {
      return null;
    }
  });
  const [localProject, setLocalProjectState] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_PROJECT_STORAGE) || "";
    } catch {
      return "";
    }
  });
  const [tipUrl, setTipUrl] = useState<string | null>(null);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [busy, setBusy] = useState(false);
  const [timelineEndUs, setTimelineEndUs] = useState(5 * api.US);

  const setLocalProject = useCallback((path: string) => {
    setLocalProjectState(path);
    try {
      if (path) localStorage.setItem(LOCAL_PROJECT_STORAGE, path);
      else localStorage.removeItem(LOCAL_PROJECT_STORAGE);
    } catch {
      /* ignore */
    }
  }, []);

  const setBaseUrl = useCallback((url: string) => {
    api.setCapCutMateBaseUrl(url);
    setBaseUrlState(api.getCapCutMateBaseUrl());
  }, []);

  const setDraftUrl = useCallback((url: string | null) => {
    setDraftUrlState(url);
    try {
      if (url) localStorage.setItem(DRAFT_STORAGE, url);
      else localStorage.removeItem(DRAFT_STORAGE);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshOnline = useCallback(async () => {
    setChecking(true);
    try {
      // Probe 1 phát (caller/loop tự lo lịch); pingBackend không throw nhưng
      // bọc phòng xa để không bao giờ ném ra ngoài làm sập app.
      const ok = await api.pingBackend({ retries: 0 });
      setOnline(ok);
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }, []);

  // Poll trạng thái BE: lúc offline retry NHANH với backoff (tới khi online)
  // để bắt được thời điểm BE vừa lên; khi đã online thì giãn ra 30s.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const FAST_BACKOFF_MS = [300, 900, 2000, 5000];
    const ONLINE_POLL_MS = 30_000;
    let offlineAttempt = 0;

    const tick = async () => {
      if (cancelled) return;
      setChecking(true);
      let ok = false;
      try {
        ok = await api.pingBackend({ retries: 0 });
      } catch {
        ok = false;
      } finally {
        if (!cancelled) setChecking(false);
      }
      if (cancelled) return;
      setOnline(ok);

      let delay: number;
      if (ok) {
        offlineAttempt = 0;
        delay = ONLINE_POLL_MS;
      } else {
        delay =
          FAST_BACKOFF_MS[Math.min(offlineAttempt, FAST_BACKOFF_MS.length - 1)];
        offlineAttempt += 1;
      }
      timer = window.setTimeout(() => void tick(), delay);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [baseUrl]);

  const createProject = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.createDraft(width, height);
      setDraftUrl(res.draft_url);
      setTipUrl(res.tip_url ?? null);
      setTimelineEndUs(0);
      toast.success("Đã tạo draft");
      setOnline(true);
    } catch (e) {
      setOnline(false);
      toast.error(e instanceof Error ? e.message : "Tạo draft thất bại");
    } finally {
      setBusy(false);
    }
  }, [width, height, setDraftUrl]);

  const saveProject = useCallback(async () => {
    if (!draftUrl) {
      toast.error("Chưa có draft để lưu");
      return;
    }
    setBusy(true);
    try {
      const res = await api.saveDraft(draftUrl);
      setDraftUrl(res.draft_url || draftUrl);
      toast.success("Đã lưu draft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu draft thất bại");
    } finally {
      setBusy(false);
    }
  }, [draftUrl, setDraftUrl]);

  const ensureDraft = useCallback(() => {
    return api.requireDraftUrl(draftUrl || localProject || null);
  }, [draftUrl, localProject]);

  const setCanvasSize = useCallback((w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  }, []);

  const value = useMemo(
    () => ({
      baseUrl,
      setBaseUrl,
      online,
      checking,
      refreshOnline,
      draftUrl,
      tipUrl,
      width,
      height,
      setCanvasSize,
      busy,
      createProject,
      saveProject,
      setDraftUrl,
      timelineEndUs,
      setTimelineEndUs,
      ensureDraft,
      localProject,
      setLocalProject,
    }),
    [
      baseUrl,
      setBaseUrl,
      online,
      checking,
      refreshOnline,
      draftUrl,
      tipUrl,
      width,
      height,
      setCanvasSize,
      busy,
      createProject,
      saveProject,
      setDraftUrl,
      timelineEndUs,
      ensureDraft,
      localProject,
      setLocalProject,
    ],
  );

  return (
    <CapCutMateContext.Provider value={value}>
      {children}
    </CapCutMateContext.Provider>
  );
}

export function useCapCutMate(): CapCutMateState {
  const ctx = useContext(CapCutMateContext);
  if (!ctx) {
    throw new Error("useCapCutMate must be used within CapCutMateProvider");
  }
  return ctx;
}

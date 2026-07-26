import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateRight,
  faBars,
  faCheck,
  faChevronRight,
  faFileExport,
  faFolderOpen,
  faHardDrive,
  faPlus,
  faTrash,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../api/CapCutMateContext";
import * as local from "../api/capcutLocalClient";
import type { LocalProjectItem } from "../api/capcutLocalClient";
import {
  formatDurationUs,
  localProjectCoverUrl,
} from "../api/capcutLocalClient";

const MIN_WIDTH = 220;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 300;
const COLLAPSED_WIDTH = 40;
const STORAGE_KEY = "capcut-all-projects-width";
const DRAFTS_DIR_KEY = "capcut-custom-drafts-dir";

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH;
}

function loadCustomDir(): string {
  try {
    return localStorage.getItem(DRAFTS_DIR_KEY) || "";
  } catch {
    return "";
  }
}

function projectPath(p: LocalProjectItem): string {
  return (p.project || p.path || "").trim();
}

function displayName(p: LocalProjectItem): string {
  return (p.name || p.folder || "—").trim() || "—";
}

/**
 * Rail phải — quét project CapCut/JianYing thật qua BE `/v1/local/projects`.
 * Click = set Draft local (path folder) cho các panel Apply.
 */
export function AllProjectPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [backup, setBackup] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(loadWidth);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  const [projects, setProjects] = useState<LocalProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customDir, setCustomDir] = useState(loadCustomDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const activePath = mate.localProject.trim();

  const refresh = useCallback(
    async (opts?: { drafts_dir?: string; silent?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const dir = (opts?.drafts_dir ?? customDir).trim();
        const res = await local.localProjects({
          names: true,
          ...(dir ? { drafts_dir: dir } : {}),
          ...(search.trim() ? { query: search.trim() } : {}),
        });
        const list = res.projects ?? [];
        setProjects(list);
        if (list.length > 0 && !mate.localProject) {
          const firstPath = (list[0].project || list[0].path || "").replace(/[/\\]draft_content\.json$/i, "");
          if (firstPath) {
            mate.setLocalProject(firstPath);
            setSelectedIds(new Set([firstPath]));
          }
        }
        if (!opts?.silent) {
          toast.success(
            list.length
              ? `Tìm thấy ${list.length} dự án`
              : "Không có project (mở CapCut lưu 1 lần, hoặc chọn folder)",
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Quét project thất bại";
        setError(msg);
        setProjects([]);
        if (!opts?.silent) toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [customDir, search, mate],
  );

  // Auto-scan khi mở panel / BE online
  useEffect(() => {
    if (collapsed) return;
    void refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ mount / expand
  }, [collapsed, mate.online]);

  useEffect(() => {
    if (collapsed) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width, collapsed]);

  const filtered = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const blob = `${p?.name || ""} ${p?.folder || ""} ${p?.project || ""} ${p?.root || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [projects, search]);

  const selectProject = (p: LocalProjectItem) => {
    const path = projectPath(p);
    if (!path) {
      toast.error("Project thiếu path");
      return;
    }
    // Ưu tiên folder project (BE field `project`)
    const folder = (p.project || path).replace(/[/\\]draft_content\.json$/i, "");
    mate.setLocalProject(folder);
    setSelectedIds(new Set([folder]));
    toast.success(`Đã chọn draft local: ${displayName(p)}`);
  };

  const toggleMulti = (p: LocalProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const path = (p.project || projectPath(p)).replace(
      /[/\\]draft_content\.json$/i,
      "",
    );
    if (!path) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        const remaining = [...next][0] || "";
        mate.setLocalProject(remaining);
      } else {
        next.add(path);
        mate.setLocalProject(path);
      }
      return next;
    });
  };

  const useSelectedAsLocal = () => {
    const first = [...selectedIds][0] || activePath;
    if (!first) {
      toast.error("Chọn ít nhất 1 dự án");
      return;
    }
    mate.setLocalProject(first);
    toast.success("Đã set Draft local từ lựa chọn");
  };

  const deleteProjects = async (paths: string[]) => {
    const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
    if (!unique.length) {
      toast.error("Chọn project cần xóa (tick checkbox)");
      return;
    }
    const preview = unique
      .slice(0, 5)
      .map((p) => `• ${p}`)
      .join("\n");
    const more =
      unique.length > 5 ? `\n… và ${unique.length - 5} project nữa` : "";
    const ok = window.confirm(
      `XÓA VĨNH VIỄN ${unique.length} project trên đĩa?\n\n${preview}${more}\n\nKhông hoàn tác được. CapCut đang mở project này có thể lỗi — nên đóng CapCut trước.`,
    );
    if (!ok) return;
    const ok2 = window.confirm(
      "Xác nhận lần 2: Xóa folder draft (có draft_content.json)?",
    );
    if (!ok2) return;

    setLoading(true);
    let okCount = 0;
    const errors: string[] = [];
    for (const path of unique) {
      try {
        await local.localDeleteProject(path, true);
        okCount += 1;
        if (activePath === path || activePath.startsWith(path)) {
          mate.setLocalProject("");
        }
      } catch (e) {
        errors.push(
          `${path}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    setSelectedIds(new Set());
    await refresh({ silent: true });
    setLoading(false);
    if (okCount) toast.success(`Đã xóa ${okCount} project`);
    if (errors.length) toast.error(errors[0]);
  };

  const promptCustomDir = () => {
    const next = window.prompt(
      "Path folder chứa các draft CapCut (com.lveditor.draft hoặc folder cha):",
      customDir ||
        "%LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft",
    );
    if (next == null) return;
    const cleaned = next.trim();
    setCustomDir(cleaned);
    try {
      if (cleaned) localStorage.setItem(DRAFTS_DIR_KEY, cleaned);
      else localStorage.removeItem(DRAFTS_DIR_KEY);
    } catch {
      /* ignore */
    }
    void refresh({ drafts_dir: cleaned });
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return;
      e.preventDefault();
      setDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [collapsed, width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const delta = dragStartX.current - e.clientX;
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, dragStartWidth.current + delta),
      );
      setWidth(next);
    },
    [dragging],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onDoubleClick = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  if (collapsed) {
    return (
      <aside
        className="relative flex shrink-0 flex-col items-center border-l border-white/8 bg-[#121317] py-3"
        style={{ width: COLLAPSED_WIDTH }}
      >
        <ResizeHandle
          collapsed
          onPointerDown={(e) => {
            e.preventDefault();
          }}
          onPointerMove={() => undefined}
          onPointerUp={() => undefined}
          onDoubleClick={onDoubleClick}
          onClick={() => setCollapsed(false)}
        />
        <button
          type="button"
          title="Mở rộng danh sách dự án"
          onClick={() => setCollapsed(false)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/5 hover:text-white/80"
        >
          <FontAwesomeIcon icon={faChevronRight} className="rotate-180" />
        </button>
        <span
          className="mt-3 origin-center rotate-90 whitespace-nowrap text-[10px] tracking-wide text-white/35"
          style={{ writingMode: "vertical-rl" }}
        >
          All Projects
        </span>
        {projects.length > 0 && (
          <span className="mt-2 rounded bg-emerald-500/20 px-1 text-[9px] text-emerald-300">
            {projects.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      className={twMerge(
        "relative flex shrink-0 flex-col border-l border-white/8 bg-[#121317]",
        dragging && "select-none",
      )}
      style={{ width }}
    >
      <ResizeHandle
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        dragging={dragging}
      />

      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/5 hover:text-white/70"
          title="Thu gọn panel"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-white/90">
            Tất cả dự án
          </span>
          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/45">
            {loading ? "…" : `${filtered.length} dự án`}
          </span>
        </div>
        <IconBtn
          icon={faTrash}
          title="Xóa project đã chọn trên đĩa"
          onClick={() =>
            void deleteProjects(
              selectedIds.size
                ? [...selectedIds]
                : activePath
                  ? [activePath]
                  : [],
            )
          }
        />
        <IconBtn
          icon={faFolderOpen}
          title="Chọn folder CapCut (drafts_dir)"
          onClick={promptCustomDir}
        />
        <IconBtn
          icon={faPlus}
          title="Dùng project đã chọn làm Draft local"
          onClick={useSelectedAsLocal}
        />
        <IconBtn
          icon={faArrowRotateRight}
          title="Quét lại (BE /local/projects)"
          onClick={() => void refresh()}
        />
      </div>

      <div className="px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void refresh();
          }}
          placeholder="Tìm dự án… (Enter = quét BE)"
          className="w-full rounded-lg border border-white/10 bg-[#1e2026] px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
        />
        {customDir ? (
          <p className="mt-1 truncate font-mono text-[9px] text-sky-300/60" title={customDir}>
            dir: {customDir}
          </p>
        ) : (
          <p className="mt-1 text-[9px] text-white/30">
            Mặc định: CapCut / JianYing / mate output
          </p>
        )}
      </div>

      {activePath ? (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
          <FontAwesomeIcon
            icon={faHardDrive}
            className="mt-0.5 text-[11px] text-emerald-400"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium text-emerald-200/90">
              Draft local đang dùng
            </div>
            <div className="truncate font-mono text-[10px] text-emerald-100/70" title={activePath}>
              {activePath}
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-6 text-center text-[12px] text-white/40">
            Đang quét project…
          </p>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <p className="text-[13px] font-semibold text-rose-300/90">
              Không quét được
            </p>
            <p className="mt-2 max-w-[240px] text-[11px] leading-relaxed text-white/45">
              {error}
            </p>
            <p className="mt-2 text-[10px] text-white/35">
              BE phải chạy trên máy có CapCut (cùng máy user).
            </p>
            <div className="mt-4 w-full max-w-[220px] space-y-2">
              <ActionBtn label="Thử lại" onClick={() => void refresh()} />
              <ActionBtn label="Chọn folder…" onClick={promptCustomDir} />
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <p className="text-[13px] font-semibold text-white/80">
              Không thấy dự án CapCut
            </p>
            <p className="mt-2 max-w-[240px] text-[11px] leading-relaxed text-white/40">
              Mở CapCut Desktop, tạo/lưu project một lần. BE quét:
              <br />
              <span className="break-all text-white/30">
                %LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft
              </span>
            </p>
            <div className="mt-5 flex w-full max-w-[220px] flex-col gap-2">
              <ActionBtn
                label="Tìm folder CapCut"
                onClick={promptCustomDir}
              />
              <ActionBtn
                label="Làm mới danh sách"
                onClick={() => void refresh()}
              />
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          filtered.map((p) => {
            const path = (p.project || projectPath(p)).replace(
              /[/\\]draft_content\.json$/i,
              "",
            );
            const isActive =
              activePath.length > 0 &&
              (activePath === path ||
                activePath.replace(/[/\\]+$/, "") === path.replace(/[/\\]+$/, ""));
            const isMulti = selectedIds.has(path);
            const coverSrc =
              p.has_cover || p.cover_path
                ? localProjectCoverUrl(path)
                : null;
            const isEmpty = p.empty === true || (p.duration_us ?? 0) === 0;
            const durLabel = formatDurationUs(p.duration_us);
            const mediaHint = p.media
              ? [
                  p.media.videos ? `${p.media.videos}v` : null,
                  p.media.audios ? `${p.media.audios}a` : null,
                  p.media.images ? `${p.media.images}i` : null,
                  p.media.segments ? `${p.media.segments}seg` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "";
            return (
              <button
                key={path || p.folder}
                type="button"
                onClick={() => selectProject(p)}
                className={twMerge(
                  "flex w-full items-center gap-2 border-b border-white/5 px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/30"
                    : "hover:bg-white/5",
                )}
              >
                <span
                  role="checkbox"
                  aria-checked={isMulti}
                  tabIndex={0}
                  onClick={(e) => toggleMulti(p, e)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggleMulti(p, e as unknown as React.MouseEvent);
                    }
                  }}
                  className={twMerge(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px]",
                    isMulti
                      ? "border-sky-400 bg-sky-500 text-white"
                      : "border-white/25 text-transparent",
                  )}
                >
                  <FontAwesomeIcon icon={faCheck} />
                </span>
                {/* Thumbnail cover — CapCut draft_cover.jpg; mate trống = placeholder */}
                <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-[#1e2026] ring-1 ring-white/10">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-[#2a2d35] to-[#16171b]">
                      <FontAwesomeIcon
                        icon={faFolderOpen}
                        className="text-[12px] text-white/25"
                      />
                      <span className="text-[8px] font-medium uppercase tracking-wide text-white/30">
                        {isEmpty ? "empty" : "no cover"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium text-white/90">
                      {displayName(p)}
                    </span>
                    {isActive && (
                      <span className="shrink-0 rounded bg-emerald-500/25 px-1 text-[8px] font-bold uppercase text-emerald-200">
                        active
                      </span>
                    )}
                    {isEmpty && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[8px] font-bold uppercase text-amber-200/80">
                        trống
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-white/40">
                    <span
                      className={twMerge(
                        "font-mono",
                        isEmpty ? "text-amber-200/70" : "text-white/55",
                      )}
                    >
                      {durLabel || "—"}
                    </span>
                    {mediaHint ? (
                      <span className="text-white/35">{mediaHint}</span>
                    ) : null}
                    {p.root && (
                      <span className="text-white/30" title={path}>
                        {p.root === "mate-output"
                          ? "mate (server)"
                          : p.root}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <div className="border-t border-white/8 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white/70">
              Đã chọn
            </span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/45">
              {selectedIds.size || (activePath ? 1 : 0)} dự án
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/45">Sao lưu</span>
            <button
              type="button"
              role="switch"
              aria-checked={backup}
              onClick={() => {
                setBackup((v) => !v);
                toast(
                  backup
                    ? "Tắt flag sao lưu (Apply vẫn không auto-bak UI)"
                    : "Bật flag sao lưu — dùng trước batch Apply (local restore/.bak)",
                );
              }}
              className={twMerge(
                "relative h-5 w-9 rounded-full transition-colors",
                backup ? "bg-sky-400" : "bg-white/15",
              )}
            >
              <span
                className={twMerge(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  backup && "translate-x-4",
                )}
              />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70"
              title="Dùng lựa chọn"
              onClick={useSelectedAsLocal}
            >
              <FontAwesomeIcon icon={faFileExport} className="text-[11px]" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 text-white/30">
          <FontAwesomeIcon icon={faBars} className="text-[11px]" />
          <FontAwesomeIcon icon={faFolderOpen} className="text-[11px]" />
          <span className="ml-auto text-[10px] text-white/25">
            {loading ? "scanning…" : `${Math.round(width)}px`}
          </span>
        </div>
      </div>
    </aside>
  );
}

function ResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onClick,
  dragging,
  collapsed,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onClick?: () => void;
  dragging?: boolean;
  collapsed?: boolean;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize All Projects panel"
      title="Drag to resize · Double-click to collapse"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      className={twMerge(
        "absolute top-0 bottom-0 left-0 z-20 w-1.5 -translate-x-1/2 cursor-col-resize touch-none",
        "hover:bg-sky-400/40",
        dragging && "bg-sky-400/50",
        collapsed && "w-2 translate-x-0 left-0",
      )}
    >
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}

function IconBtn({
  icon,
  title,
  onClick,
}: {
  icon: typeof faTrash;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 hover:bg-white/5 hover:text-white/75"
    >
      <FontAwesomeIcon icon={icon} className="text-[11px]" />
    </button>
  );
}

function ActionBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-white/10 bg-[#1e2026] px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-[#252830] hover:text-white/90"
    >
      {label}
    </button>
  );
}

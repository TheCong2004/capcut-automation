import {
  Activity,
  ArrowLeft,
  Check,
  CircleDashed,
  Clock3,
  Film,
  FolderPlus,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:30000/openmontage";

type StageStatus =
  | "pending"
  | "in_progress"
  | "awaiting_human"
  | "completed"
  | "failed";

interface StageSummary {
  name: string;
  status: StageStatus;
}

interface ProjectSummary {
  project_id: string;
  title: string;
  pipeline_type: string;
  poster: string | null;
  live: boolean;
  last_activity: number;
  active_stage: string | null;
  awaiting_human: boolean;
  stage_states: StageSummary[];
  completed_count: number;
  render_count: number;
  scene_count: number;
}

interface PipelineOption {
  value: string;
  label: string;
}

interface ProjectState extends ProjectSummary {
  pipeline: {
    pipeline_type: string;
    known: boolean;
    stages: Array<{ name: string; gated: boolean; produces: string[] }>;
  };
  stages: Array<
    StageSummary & {
      gated?: boolean;
      stalled?: boolean;
      stalled_minutes?: number;
      error?: string;
    }
  >;
  created_at?: string;
  style_playbook?: string;
  media: {
    renders: Array<{ path: string; mtime?: number; size?: number }>;
    snapshots: Array<{ path: string }>;
    music: Array<{ path: string }>;
  };
  events: Array<Record<string, unknown>>;
  cost?: { total_spent_usd?: number };
}

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatTime(epoch?: number) {
  if (!epoch) return "Chưa hoạt động";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(epoch * 1000));
}

function humanize(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ");
}

function thumbnailURL(projectId: string, path: string) {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/thumb/${encodeURIComponent(projectId)}/${safePath}?w=640`;
}

function mediaURL(projectId: string, path: string) {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/media/${encodeURIComponent(projectId)}/${safePath}`;
}

const statusStyle: Record<StageStatus, string> = {
  pending: "border-white/10 bg-white/[0.03] text-white/40",
  in_progress: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  awaiting_human: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
};

const statusLabel: Record<StageStatus, string> = {
  pending: "Chờ xử lý",
  in_progress: "Đang thực hiện",
  awaiting_human: "Chờ phê duyệt",
  completed: "Hoàn thành",
  failed: "Thất bại",
};

function CreateProjectDialog({
  pipelines,
  onClose,
  onCreated,
}: {
  pipelines: PipelineOption[];
  onClose: () => void;
  onCreated: (project: ProjectSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pipeline, setPipeline] = useState(
    pipelines[0]?.value ?? "animated-explainer",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const created = await requestJSON<ProjectSummary>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          title,
          pipeline_type: pipeline,
        }),
      });
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo dự án");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#18191c] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Tạo dự án mới</h2>
            <p className="mt-1 text-sm text-white/45">
              Khởi tạo workspace và pipeline OpenMontage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/75">
              Tên dự án
            </span>
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => {
                const value = event.target.value;
                setTitle(value);
                setProjectId(slugify(value));
              }}
              placeholder="Ví dụ: Video giới thiệu Artcraft"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-blue-500/70"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/75">
              Mã dự án
            </span>
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={projectId}
              onChange={(event) => setProjectId(slugify(event.target.value))}
              placeholder="video-gioi-thieu-artcraft"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-500/70"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/75">
              Quy trình sản xuất
            </span>
            <select
              value={pipeline}
              onChange={(event) => setPipeline(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#202124] px-4 py-3 text-white outline-none focus:border-blue-500/70"
            >
              {pipelines.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/70 hover:bg-white/5"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || !title || !projectId}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FolderPlus size={16} />
            )}
            Tạo dự án
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: ProjectSummary;
  onOpen: () => void;
}) {
  const total = project.stage_states.length;
  const progress = total ? (project.completed_count / total) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#18191c] text-left transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-xl"
    >
      <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-blue-500/15 via-violet-500/10 to-transparent">
        {project.poster ? (
          <img
            src={thumbnailURL(project.project_id, project.poster)}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film size={38} className="text-white/15" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {project.live && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">
              <Activity size={11} /> ĐANG CHẠY
            </span>
          )}
          {project.awaiting_human && (
            <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-semibold text-black">
              CHỜ DUYỆT
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3">
          <h3 className="truncate text-base font-semibold text-white">
            {project.title}
          </h3>
          <p className="mt-1 truncate font-mono text-xs text-white/35">
            {project.project_id}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between text-xs">
          <span className="capitalize text-blue-300">
            {humanize(project.pipeline_type)}
          </span>
          <span className="text-white/40">
            {project.completed_count}/{total} giai đoạn
          </span>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-white/35">
          <span className="flex items-center gap-1.5">
            <Clock3 size={13} /> {formatTime(project.last_activity)}
          </span>
          <span>{project.render_count} bản dựng</span>
        </div>
      </div>
    </button>
  );
}

function ProjectBoard({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<ProjectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await requestJSON<ProjectState>(
        `/api/project/${encodeURIComponent(projectId)}/state`,
      );
      setState(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải dự án");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
    const events = new EventSource(
      `${API_BASE}/api/project/${encodeURIComponent(projectId)}/events`,
    );
    events.onmessage = (message) => {
      const payload = JSON.parse(message.data);
      if (payload.type === "change") void refresh();
    };
    return () => events.close();
  }, [projectId, refresh]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-white/50">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!state || error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
        <p className="text-red-300">{error || "Không tìm thấy dự án"}</p>
        <button onClick={onBack} className="text-blue-400">
          Quay lại thư viện
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#111214] text-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#111214]/95 px-7 py-5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/10 p-2.5 text-white/60 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{state.title}</h1>
            <p className="mt-1 text-xs capitalize text-white/40">
              {humanize(state.pipeline.pipeline_type)} · {state.project_id}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-white/10 p-2.5 text-white/60 hover:bg-white/5 hover:text-white"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="mx-auto max-w-7xl space-y-7 p-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Giai đoạn", `${state.stages.filter((s) => s.status === "completed").length}/${state.stages.length}`],
            ["Cảnh", String(state.scene_count ?? 0)],
            ["Bản dựng", String(state.media.renders.length)],
            [
              "Chi phí",
              state.cost?.total_spent_usd != null
                ? `$${state.cost.total_spent_usd.toFixed(2)}`
                : "$0.00",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#18191c] p-5"
            >
              <p className="text-xs uppercase tracking-wider text-white/35">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#18191c]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-semibold">Tiến độ pipeline</h2>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {state.stages.map((stage, index) => (
              <div
                key={stage.name}
                className={`rounded-xl border p-4 ${statusStyle[stage.status]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20 text-xs font-semibold">
                      {stage.status === "completed" ? (
                        <Check size={16} />
                      ) : stage.status === "in_progress" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {humanize(stage.name)}
                      </p>
                      <p className="mt-1 text-xs opacity-60">
                        {statusLabel[stage.status]}
                      </p>
                    </div>
                  </div>
                  {stage.gated && (
                    <span className="rounded bg-white/10 px-2 py-1 text-[10px]">
                      DUYỆT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#18191c]">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <h2 className="font-semibold">Bản dựng</h2>
            <span className="text-xs text-white/35">
              {state.media.renders.length} tệp
            </span>
          </div>
          {state.media.renders.length ? (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {state.media.renders.map((render) => (
                <a
                  key={render.path}
                  href={mediaURL(projectId, render.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/20"
                >
                  <div className="relative aspect-video">
                    <img
                      src={thumbnailURL(projectId, render.path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                      <Play size={28} fill="white" />
                    </div>
                  </div>
                  <p className="truncate px-4 py-3 text-sm text-white/65">
                    {render.path.split("/").at(-1)}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-14 text-white/30">
              <CircleDashed size={30} />
              <p className="mt-3 text-sm">Chưa có bản dựng</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export const PageOpenMontage = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const loadLibrary = useCallback(async () => {
    try {
      const [projectData, pipelineData] = await Promise.all([
        requestJSON<ProjectSummary[]>("/api/projects"),
        requestJSON<PipelineOption[]>("/api/pipelines"),
      ]);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setPipelines(Array.isArray(pipelineData) ? pipelineData : []);
      setConnected(true);
    } catch {
      setProjects([]);
      setPipelines([]);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
    const events = new EventSource(`${API_BASE}/api/library/events`);
    events.onopen = () => {
      void loadLibrary();
    };
    events.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data);
        if (payload?.type === "change") void loadLibrary();
      } catch {
        /* ignore parse error */
      }
    };
    return () => events.close();
  }, [loadLibrary]);

  const safeProjects = Array.isArray(projects) ? projects : [];

  const completedProjects = useMemo(
    () =>
      safeProjects.filter(
        (project) =>
          project?.stage_states?.length > 0 &&
          project?.completed_count === project?.stage_states?.length,
      ).length,
    [safeProjects],
  );

  if (selectedProject) {
    return (
      <ProjectBoard
        projectId={selectedProject}
        onBack={() => {
          setSelectedProject(null);
          void loadLibrary();
        }}
      />
    );
  }

  return (
    <div className="relative h-full overflow-y-auto bg-[#111214] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111214]/95 px-7 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/15">
              <Sparkles size={21} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">OpenMontage</h1>
              <p className="mt-1 text-sm text-white/40">
                Không gian sản xuất video bằng AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs sm:flex ${
                connected
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
              />
              {connected ? "Backend đã kết nối" : "Mất kết nối"}
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              disabled={!connected}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
            >
              <FolderPlus size={17} />
              Tạo dự án
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-7">
        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          {[
            ["Tổng dự án", safeProjects.length],
            ["Đang hoạt động", safeProjects.filter((item) => item?.live).length],
            ["Đã hoàn thành", completedProjects],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#18191c] p-5"
            >
              <p className="text-xs uppercase tracking-wider text-white/35">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-semibold">Thư viện dự án</h2>
          <button
            type="button"
            onClick={() => void loadLibrary()}
            className="rounded-lg p-2 text-white/45 hover:bg-white/5 hover:text-white"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24 text-white/40">
            <Loader2 className="animate-spin" />
          </div>
        ) : !connected ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-16 text-center">
            <p className="font-medium text-red-300">
              Không thể kết nối backend OpenMontage (cổng 30000)
            </p>
            <p className="mt-2 text-sm text-white/40">
              Hãy chạy lại Artcraft bằng windows_capcut_dev.ps1.
            </p>
          </div>
        ) : safeProjects.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {safeProjects.map((project) => (
              <ProjectCard
                key={project.project_id}
                project={project}
                onOpen={() => setSelectedProject(project.project_id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
              <Film size={26} />
            </div>
            <h3 className="mt-5 font-semibold">Chưa có dự án</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/40">
              Tạo dự án đầu tiên, chọn pipeline phù hợp rồi bắt đầu quy trình sản
              xuất video.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium hover:bg-blue-500"
            >
              <FolderPlus size={17} /> Tạo dự án đầu tiên
            </button>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateProjectDialog
          pipelines={pipelines}
          onClose={() => setShowCreate(false)}
          onCreated={(project) => {
            setShowCreate(false);
            setProjects((current) => [project, ...current]);
            setSelectedProject(project.project_id);
          }}
        />
      )}
    </div>
  );
};

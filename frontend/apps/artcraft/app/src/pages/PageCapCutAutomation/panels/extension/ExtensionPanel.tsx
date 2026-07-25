import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPuzzlePiece,
  faSearch,
} from "@fortawesome/pro-solid-svg-icons";
import { twMerge } from "tailwind-merge";
import toast from "react-hot-toast";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as local from "../../api/capcutLocalClient";
import { requireLocalProject } from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { PanelStatusAside } from "../../shared/PanelStatusAside";
import { ResizableSplit } from "../../shared/ResizableSplit";

type ExtAction =
  | "doctor"
  | "lint"
  | "lint-fix"
  | "port-matrix"
  | "describe"
  | "enums"
  | "diagnose"
  | "register"
  | "prune"
  | "decrypt";

const EXTENSIONS: {
  id: string;
  name: string;
  desc: string;
  installed: boolean;
  action: ExtAction;
  needsProject: boolean;
}[] = [
  {
    id: "doctor",
    name: "Env Doctor",
    desc: "Kiểm tra môi trường BE local (Python, path, codec…)",
    installed: true,
    action: "doctor",
    needsProject: false,
  },
  {
    id: "lint",
    name: "Draft Lint",
    desc: "Quét lỗi phụ đề / path media trên draft local",
    installed: true,
    action: "lint",
    needsProject: true,
  },
  {
    id: "lint-fix",
    name: "Lint Fix",
    desc: "Tự sửa một số issue lint an toàn",
    installed: true,
    action: "lint-fix",
    needsProject: true,
  },
  {
    id: "diagnose",
    name: "Diagnose",
    desc: "Chẩn đoán cấu trúc draft",
    installed: true,
    action: "diagnose",
    needsProject: true,
  },
  {
    id: "port-matrix",
    name: "Port Matrix",
    desc: "Xem ma trận API local đã port",
    installed: true,
    action: "port-matrix",
    needsProject: false,
  },
  {
    id: "describe",
    name: "API Describe",
    desc: "Mô tả surface /v1/local/*",
    installed: true,
    action: "describe",
    needsProject: false,
  },
  {
    id: "enums",
    name: "Enums / Resources",
    desc: "Liệt kê filter/effect/transition names",
    installed: true,
    action: "enums",
    needsProject: false,
  },
  {
    id: "register",
    name: "Register draft",
    desc: "Đăng ký / chuẩn hóa meta draft",
    installed: false,
    action: "register",
    needsProject: true,
  },
  {
    id: "prune",
    name: "Prune materials",
    desc: "Gỡ material không dùng",
    installed: false,
    action: "prune",
    needsProject: true,
  },
  {
    id: "decrypt",
    name: "Detect encryption",
    desc: "Phát hiện draft JianYing mã hóa (không giải mã)",
    installed: false,
    action: "decrypt",
    needsProject: true,
  },
];

export function ExtensionPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [installed, setInstalled] = useState(
    () => new Set(EXTENSIONS.filter((e) => e.installed).map((e) => e.id)),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [log, setLog] = useState("");

  const filtered = EXTENSIONS.filter(
    (e) =>
      !search.trim() ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.desc.toLowerCase().includes(search.toLowerCase()),
  );

  const runExt = async (ext: (typeof EXTENSIONS)[0]) => {
    if (!installed.has(ext.id)) {
      setInstalled((prev) => new Set(prev).add(ext.id));
      toast.success(`Đã bật “${ext.name}”`);
      return;
    }
    setBusyId(ext.id);
    try {
      let res: unknown;
      const project = ext.needsProject
        ? requireLocalProject(mate.localProject)
        : "";
      switch (ext.action) {
        case "doctor":
          res = await local.localDoctor();
          break;
        case "lint":
          res = await local.localLint(project);
          break;
        case "lint-fix":
          res = await local.localLintFix(project);
          break;
        case "diagnose":
          res = await local.localDiagnose(project);
          break;
        case "port-matrix":
          res = await local.localPortMatrix();
          break;
        case "describe":
          res = await local.localDescribe();
          break;
        case "enums":
          res = await local.localEnums({ limit: 40 });
          break;
        case "register":
          res = await local.localRegister(project, true);
          break;
        case "prune":
          res = await local.localPrune(project);
          break;
        case "decrypt":
          res = await local.localDecrypt(project);
          break;
        default:
          res = { ok: false };
      }
      setLog(JSON.stringify(res, null, 2));
      toast.success(`${ext.name} OK`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLog(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1a1b1f]">
      <PanelGuide
        what="Công cụ bảo trì draft: doctor env, lint phụ đề, diagnose, enums, prune…"
        how="① Bật tiện ích nếu chưa · ② Chạy → xem log JSON bên dưới."
        need="Tool có «cần project» → lưu path ở Draft local trước."
        tone={mate.localProject.trim() ? "default" : "warn"}
      />
      <ResizableSplit
        storageKey="capcut-split-extension"
        defaultWidth={300}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-white/8 px-5 py-3">
        <h2 className="text-[15px] font-semibold text-white/90">Tiện ích</h2>
        <p className="mt-0.5 text-[12px] text-white/40">
          API local tooling — không phải marketplace plugin
        </p>
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#252830] px-3 py-2">
          <FontAwesomeIcon
            icon={faSearch}
            className="text-[12px] text-white/35"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tiện ích…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          {filtered.map((ext) => {
            const isOn = installed.has(ext.id);
            const busy = busyId === ext.id;
            return (
              <div
                key={ext.id}
                className="flex flex-col rounded-xl border border-white/8 bg-[#16171b] p-4"
              >
                <div className="mb-2 flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/50">
                    <FontAwesomeIcon icon={faPuzzlePiece} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-white/90">
                      {ext.name}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-white/45">
                      {ext.desc}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-white/30">
                      {ext.action}
                      {ext.needsProject ? " · cần project" : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runExt(ext)}
                  className={twMerge(
                    "mt-auto rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50",
                    isOn
                      ? "bg-sky-500/90 text-white hover:bg-sky-500"
                      : "border border-white/12 bg-[#252830] text-white/70 hover:bg-[#2a2d35]",
                  )}
                >
                  {busy ? "…" : isOn ? "Chạy" : "Bật"}
                </button>
              </div>
            );
          })}
        </div>

        {log && (
          <pre className="mx-auto mt-4 max-h-48 max-w-3xl overflow-auto rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[10px] text-emerald-200/75">
            {log}
          </pre>
        )}
      </div>
          </div>
        }
        right={
          <PanelStatusAside tip="Tiện ích gọi /v1/local tooling (doctor, lint…)." />
        }
      />
    </div>
  );
}

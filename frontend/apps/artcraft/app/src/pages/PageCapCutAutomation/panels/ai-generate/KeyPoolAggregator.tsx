import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faKey,
  faCopy,
  faCheck,
  faRotateRight,
  faEye,
  faEyeSlash,
  faPlus,
  faTrash,
  faLayerGroup,
  faShieldHalved,
  faCircleCheck,
} from "@fortawesome/pro-solid-svg-icons";
import toast from "react-hot-toast";

export interface PooledKey {
  id: string;
  platform: string;
  key: string;
  label?: string;
  enabled: boolean;
  createdAt: number;
}

const PLATFORMS = [
  { id: "auto", label: "Tự động nhận diện (Auto-detect)" },
  { id: "google", label: "Google AI Studio (Gemini)" },
  { id: "groq", label: "Groq Cloud" },
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "mistral", label: "Mistral AI" },
  { id: "cerebras", label: "Cerebras" },
  { id: "sambanova", label: "SambaNova" },
  { id: "nvidia", label: "NVIDIA NIM" },
  { id: "custom", label: "Khác / FreeLLM" },
];

const STORAGE_KEYS_LIST = "ai_unified_key_pool_list";
const STORAGE_MASTER_KEY = "ai_unified_master_key";

function detectPlatform(key: string): string {
  const k = key.trim();
  if (k.startsWith("AIzaSy")) return "google";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-proj-") || k.startsWith("sk-")) return "openai";
  if (k.startsWith("csk-")) return "cerebras";
  if (k.startsWith("sn_")) return "sambanova";
  if (k.startsWith("nvapi-")) return "nvidia";
  return "custom";
}

function maskKey(key: string): string {
  if (!key) return "••••••••";
  if (key.startsWith("sk-unified-")) {
    return key.slice(0, 14) + "••••••••" + key.slice(-4);
  }
  if (key.length <= 10) return key.slice(0, 3) + "••••" + key.slice(-2);
  return key.slice(0, 6) + "••••••••" + key.slice(-4);
}

function generateUnifiedMasterKey(): string {
  const randomStr = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
  return `sk-unified-pool-${randomStr}`;
}

export function KeyPoolAggregator({
  onKeyUpdated,
}: {
  onKeyUpdated?: (masterKey: string) => void;
}) {
  const [keys, setKeys] = useState<PooledKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS_LIST);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [masterKey, setMasterKey] = useState<string>(() => {
    try {
      let saved = localStorage.getItem(STORAGE_MASTER_KEY);
      if (!saved) {
        saved = generateUnifiedMasterKey();
        localStorage.setItem(STORAGE_MASTER_KEY, saved);
      }
      return saved;
    } catch {
      return generateUnifiedMasterKey();
    }
  });

  const [rawKeyInput, setRawKeyInput] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("auto");
  const [keyLabel, setKeyLabel] = useState("");
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [autoApply, setAutoApply] = useState(true);

  // Sync to local storage & notify parent
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS_LIST, JSON.stringify(keys));
    } catch {
      /* ignore */
    }
  }, [keys]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MASTER_KEY, masterKey);
      if (onKeyUpdated) onKeyUpdated(masterKey);
    } catch {
      /* ignore */
    }
  }, [masterKey, onKeyUpdated]);

  const activeKeysCount = useMemo(
    () => keys.filter((k) => k.enabled).length,
    [keys]
  );

  const handleRegenerateMasterKey = () => {
    const newKey = generateUnifiedMasterKey();
    setMasterKey(newKey);
    toast.success("Đã sinh Key hợp nhất mới (Unified Master Key)");
  };

  const handleCopyMasterKey = () => {
    navigator.clipboard.writeText(masterKey);
    setCopiedMaster(true);
    toast.success("Đã sao chép Key hợp nhất vào bộ nhớ tạm!");
    setTimeout(() => setCopiedMaster(false), 2000);
  };

  const handleAddKeys = () => {
    if (!rawKeyInput.trim()) {
      toast.error("Vui lòng nhập ít nhất 1 API Key");
      return;
    }

    const lines = rawKeyInput
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      toast.error("Không tìm thấy Key hợp lệ trong nội dung nhập");
      return;
    }

    const newEntries: PooledKey[] = [];
    for (let i = 0; i < lines.length; i++) {
      const k = lines[i];
      if (keys.some((item) => item.key === k)) continue;

      const plat =
        selectedPlatform === "auto" ? detectPlatform(k) : selectedPlatform;
      const labelText =
        keyLabel.trim() || `${plat.toUpperCase()} Key ${keys.length + i + 1}`;

      newEntries.push({
        id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        platform: plat,
        key: k,
        label: labelText,
        enabled: true,
        createdAt: Date.now(),
      });
    }

    if (newEntries.length === 0) {
      toast("Các key này đã tồn tại trong Pool", { icon: "ℹ️" });
      return;
    }

    setKeys((prev) => [...newEntries, ...prev]);
    setRawKeyInput("");
    setKeyLabel("");
    toast.success(`Đã gom ${newEntries.length} API Keys về 1 Key Hợp Nhất!`);
  };

  const handleToggleKey = (id: string) => {
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k))
    );
  };

  const handleDeleteKey = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("Đã xoá key khỏi pool");
  };

  const handleClearAll = () => {
    if (window.confirm("Bạn có chắc muốn xóa tất cả API keys trong pool?")) {
      setKeys([]);
      toast.success("Đã xóa sạch Key pool");
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#1a1b1f] px-6 py-5 text-white">
      {/* Header Banner */}
      <div className="mb-6 rounded-xl border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-[#182338] to-[#1a1b1f] p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
            <FontAwesomeIcon icon={faLayerGroup} className="text-lg" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Gom Nhiều API Keys Thành 1 Key Hợp Nhất (Unified Key Pooling)
            </h2>
            <p className="mt-0.5 text-[12px] text-white/65">
              Nhập/dán tất cả các API Keys của bạn (Google Gemini, Groq, OpenAI, OpenRouter...). Hệ thống tự động gom thành 1 Master Key duy nhất cho UI AI Tạo.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Master Unified API Key Card */}
      <div className="mb-6 rounded-xl border border-white/12 bg-[#21232b] p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faKey} className="text-sky-400" />
            <h3 className="text-sm font-semibold text-white">
              1 Key Hợp Nhất Duy Nhất (Unified Master Key)
            </h3>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                activeKeysCount > 0
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  activeKeysCount > 0 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              {activeKeysCount > 0
                ? `Đang gom ${activeKeysCount} keys hoạt động`
                : "Chưa có key nào trong Pool"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRegenerateMasterKey}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#2b2e38] px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-[#343845] hover:text-white"
          >
            <FontAwesomeIcon icon={faRotateRight} className="text-[10px]" />
            Sinh Key Mới
          </button>
        </div>

        <div className="mt-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-[#141519] px-3 py-2 font-mono text-[13px] text-sky-200">
              <span className="truncate select-all">
                {showMasterKey ? masterKey : maskKey(masterKey)}
              </span>
              <button
                type="button"
                onClick={() => setShowMasterKey(!showMasterKey)}
                className="ml-2 text-white/40 hover:text-white/80"
                title={showMasterKey ? "Ẩn Key" : "Hiện Key"}
              >
                <FontAwesomeIcon icon={showMasterKey ? faEyeSlash : faEye} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopyMasterKey}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-sky-500"
            >
              <FontAwesomeIcon icon={copiedMaster ? faCheck : faCopy} />
              {copiedMaster ? "Đã chép" : "Sao chép Key"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/50">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-emerald-400">
                <FontAwesomeIcon icon={faCircleCheck} className="text-[11px]" />
                Trạng thái: Tự động gom & Điều phối Key
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sky-300 select-none">
              <input
                type="checkbox"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-sky-500"
              />
              Tự động áp dụng cho UI AI Tạo hiện tại
            </label>
          </div>
        </div>
      </div>

      {/* 2. Bulk Add Keys Section */}
      <div className="mb-6 rounded-xl border border-white/10 bg-[#21232b] p-5 shadow-md">
        <h3 className="mb-3 text-sm font-semibold text-white/90">
          Nhập Danh Sách API Keys Cần Gom
        </h3>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-[11px] font-medium text-white/60">
                Nền tảng / Provider
              </label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#17181c] px-3 py-2 text-[12px] text-white/85 outline-none focus:border-sky-400/50"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-[11px] font-medium text-white/60">
                Nhãn / Ghi chú (Tùy chọn)
              </label>
              <input
                type="text"
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                placeholder="Ví dụ: Team Gemini Key 1"
                className="w-full rounded-lg border border-white/10 bg-[#17181c] px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/60">
              Dán danh sách API Keys (Mỗi Key 1 dòng hoặc cách nhau bởi dấu phẩy)
            </label>
            <textarea
              value={rawKeyInput}
              onChange={(e) => setRawKeyInput(e.target.value)}
              rows={4}
              placeholder={`Dán tất cả các Key của bạn tại đây:
AIzaSyB... (Google Gemini Key 1)
AIzaSyC... (Google Gemini Key 2)
gsk_xyz... (Groq Key)
sk-proj-... (OpenAI Key)`}
              className="w-full resize-none rounded-lg border border-white/10 bg-[#141519] px-3 py-2.5 font-mono text-[12px] text-white outline-none placeholder:text-white/25 focus:border-sky-400/50"
            />
          </div>

          <button
            type="button"
            onClick={handleAddKeys}
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md hover:brightness-110"
          >
            <FontAwesomeIcon icon={faPlus} />
            Gom & Thêm Danh Sách Key Về 1 Key Duy Nhất
          </button>
        </div>
      </div>

      {/* 3. Managed Keys List */}
      <div className="rounded-xl border border-white/10 bg-[#21232b] p-5 shadow-md">
        <div className="mb-3 flex items-center justify-between border-b border-white/8 pb-3">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Danh Sách Keys Trong Pool ({keys.length})
            </h3>
          </div>
          {keys.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] text-rose-400 hover:underline"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {keys.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-white/40">
            Chưa có key nào được thêm vào Pool. Hãy nhập danh sách API Keys ở trên để gom thành 1 Key duy nhất.
          </div>
        ) : (
          <div className="space-y-2.5">
            {keys.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#17181d] px-3.5 py-2.5 transition-colors hover:border-white/15"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      item.enabled ? "bg-emerald-400" : "bg-white/20"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 uppercase">
                        {item.platform}
                      </span>
                      <span className="text-[12px] font-medium text-white/90">
                        {item.label}
                      </span>
                    </div>
                    <code className="mt-0.5 block font-mono text-[11px] text-white/50">
                      {maskKey(item.key)}
                    </code>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-white/60 select-none">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => handleToggleKey(item.id)}
                      className="h-3.5 w-3.5 rounded accent-sky-500"
                    />
                    {item.enabled ? "Bật" : "Tắt"}
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeleteKey(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded text-white/35 hover:bg-rose-500/20 hover:text-rose-400"
                    title="Xóa Key"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

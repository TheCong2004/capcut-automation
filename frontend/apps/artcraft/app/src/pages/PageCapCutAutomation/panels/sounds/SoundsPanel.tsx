import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  SoundItem,
  SoundsCategoryId,
  SoundsPlacementRule,
} from "../../types";
import { SoundsLibrary } from "./SoundsLibrary";
import { SoundsSidebar } from "./SoundsSidebar";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import { loadSfxCatalog } from "../../api/beCatalog";
import {
  dbToLinear,
  listSegmentIds,
  requireLocalProject,
  secToUs,
} from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

export function SoundsPanel() {
  const mate = useCapCutMate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SoundsCategoryId>("sound-effects");
  const [library, setLibrary] = useState<SoundItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<SoundItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volumeDb, setVolumeDb] = useState(0);
  const [fadeInSec, setFadeInSec] = useState(0);
  const [fadeOutSec, setFadeOutSec] = useState(0);
  const [placement, setPlacement] =
    useState<SoundsPlacementRule>("start-of-each-clip");
  const [offsetSec, setOffsetSec] = useState(0);
  const [durationSec, setDurationSec] = useState(2);
  /** URL (mate draft) hoặc path file (local draft) */
  const [audioSource, setAudioSource] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLib(true);
      setLoadError(null);
      try {
        const sfx = await loadSfxCatalog();
        if (cancelled) return;
        setLibrary(
          sfx.map((s) => ({
            id: s.id,
            name: s.name,
            category: "sound-effects" as const,
            durationLabel: "—",
            durationSec: 2,
            thumb: s.thumb,
          })),
        );
        if (!sfx.length) setLoadError("BE /enums sfx trống — dùng URL/path Apply");
      } catch (e) {
        if (!cancelled) {
          setLibrary([]);
          setLoadError(e instanceof Error ? e.message : "Lỗi load sfx");
        }
      } finally {
        if (!cancelled) setLoadingLib(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => {
      const safeLib = Array.isArray(library) ? library : [];
      return {
        all: safeLib.length,
        music: safeLib.filter((s) => s.category === "music").length,
        "sound-effects": safeLib.filter((s) => s.category === "sound-effects")
          .length,
        "my-audio": safeLib.filter((s) => s.category === "my-audio").length,
      };
    },
    [library],
  );

  const filtered = useMemo(() => {
    const safeLib = Array.isArray(library) ? library : [];
    const q = search.trim().toLowerCase();
    return safeLib.filter((item) => {
      if (item.category !== category) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, category, library]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePlay = (id: string) => {
    setPlayingId((cur) => {
      if (cur === id) return null;
      // BE không stream preview audio — không giả là play được
      toast("BE không stream preview. Dán URL/path rồi Apply để ghi draft.");
      return id;
    });
  };

  const pickAudio = () => {
    const v = window.prompt(
      "URL http(s) (mate) hoặc path file trên máy (local draft):",
      audioSource || "https://",
    );
    if (v == null) return;
    setAudioSource(v.trim());
    if (v.trim()) toast.success("Đã set nguồn audio — bấm Apply");
  };

  const addItem = (item: SoundItem) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === item.id)) {
        toast("Already in Selected Sounds");
        return prev;
      }
      return [...prev, item];
    });
  };

  const handleApply = async () => {
    const src = audioSource.trim();
    if (!src) {
      toast.error(
        "Nhập URL audio (http…) cho draft mate, hoặc path file cho draft local",
      );
      return;
    }
    setApplying(true);
    try {
      const vol = dbToLinear(volumeDb);
      const isHttp = /^https?:\/\//i.test(src);
      const offsetUs = secToUs(offsetSec);
      const durUs = secToUs(
        selected[0]?.durationSec || durationSec || 2,
      );

      if (isHttp) {
        const draftUrl = mate.ensureDraft();
        let start = offsetUs;
        if (placement === "entire-timeline") {
          start = 0;
        } else if (placement === "end-of-each-clip") {
          start = Math.max(0, mate.timelineEndUs - durUs + offsetUs);
        } else {
          start = mate.timelineEndUs + offsetUs;
        }
        const end = start + durUs;
        const infos: Array<Record<string, unknown>> = [];
        const count = Math.max(1, selected.length || 1);
        for (let i = 0; i < count; i++) {
          const s = start + (placement === "start-of-each-clip" ? i * 0 : 0);
          infos.push({
            audio_url: src,
            start: s,
            end: s + durUs,
            volume: vol,
          });
        }
        await api.addAudios(draftUrl, infos);
        mate.setTimelineEndUs(Math.max(mate.timelineEndUs, end));
        toast.success(`Đã thêm audio qua mate add_audios (${infos.length})`);
      } else {
        const project = requireLocalProject(mate.localProject);
        await local.localAddAudio(project, src, {
          start_us: offsetUs,
          duration_us: durUs,
          volume: vol,
        });
        // fade on first audio segment if requested
        if (fadeInSec > 0 || fadeOutSec > 0) {
          const aids = await listSegmentIds(project, "audio");
          if (aids[0]) {
            await local.localAudioFade(project, aids[0], {
              fade_in_us: secToUs(fadeInSec),
              fade_out_us: secToUs(fadeOutSec),
            });
          }
        }
        toast.success("Đã thêm audio local (/add-audio)");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thêm âm thanh thất bại");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PanelGuide
        what="Thêm nhạc / SFX vào timeline (mate bằng URL, hoặc local bằng path file)."
        how="① Dán URL http hoặc path .mp3 · ② volume / fade / placement · ③ Apply."
        need="URL → draft mate (Tạo draft). Path file → Draft local (Lưu path)."
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#15161a] px-3 py-2">
        <label className="text-[11px] text-white/45">URL / path audio</label>
        <input
          value={audioSource}
          onChange={(e) => setAudioSource(e.target.value)}
          placeholder="https://…/bgm.mp3  hoặc  D:\music\sfx.wav"
          className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#252830] px-3 py-1.5 font-mono text-[12px] text-white outline-none focus:border-sky-400/40"
        />
        <span className="text-[10px] text-white/35">
          http → mate draft · path → local draft
        </span>
      </div>
      <ResizableSplit
        storageKey="capcut-split-sounds"
        left={
          <SoundsLibrary
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            sounds={filtered}
            counts={counts}
            favoriteIds={favoriteIds}
            playingId={playingId}
            onToggleFavorite={toggleFavorite}
            onTogglePlay={togglePlay}
            onAdd={addItem}
            onPickAudio={pickAudio}
            emptyHint={
              loadError ||
              (loadingLib
                ? "Đang tải sfx…"
                : "SFX từ BE enums — Music/My audio: dán URL/path rồi Apply")
            }
          />
        }
        right={
          <SoundsSidebar
            selected={selected}
            onRemove={(id) =>
              setSelected((prev) => prev.filter((s) => s.id !== id))
            }
            onClear={() => setSelected([])}
            volumeDb={volumeDb}
            onVolumeDbChange={setVolumeDb}
            fadeInSec={fadeInSec}
            fadeOutSec={fadeOutSec}
            onFadeInChange={setFadeInSec}
            onFadeOutChange={setFadeOutSec}
            placement={placement}
            onPlacementChange={setPlacement}
            offsetSec={offsetSec}
            durationSec={durationSec}
            onOffsetChange={setOffsetSec}
            onDurationChange={setDurationSec}
            onApply={() => void handleApply()}
          />
        }
      />
      {applying && (
        <div className="border-t border-white/6 px-3 py-1 text-center text-[11px] text-blue-300/80">
          Đang thêm audio…
        </div>
      )}
    </div>
  );
}

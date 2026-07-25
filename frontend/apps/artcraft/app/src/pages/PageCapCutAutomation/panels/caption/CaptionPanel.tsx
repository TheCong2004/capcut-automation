import { useState } from "react";
import toast from "react-hot-toast";
import type { CaptionSourceTab } from "../../types";
import { CaptionDropZone } from "./CaptionDropZone";
import { CaptionEngineBar } from "./CaptionEngineBar";
import { CaptionSidebar } from "./CaptionSidebar";
import { CaptionTransport } from "./CaptionTransport";
import { useCapCutMate } from "../../api/CapCutMateContext";
import * as api from "../../api/capcutBeClient";
import * as local from "../../api/capcutLocalClient";
import { requireLocalProject } from "../../api/localApplyHelpers";
import { PanelGuide } from "../../shared/PanelGuide";
import { ResizableSplit } from "../../shared/ResizableSplit";

/** Simple SRT parser → caption rows for add_captions */
function parseSrt(text: string): Array<{
  start: number;
  end: number;
  text: string;
}> {
  const blocks = text.replace(/\r/g, "").trim().split(/\n\n+/);
  const out: Array<{ start: number; end: number; text: string }> = [];

  const toUs = (ts: string): number => {
    const m = ts.trim().match(/(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})/);
    if (!m) return 0;
    const h = Number(m[1] ?? 0);
    const min = Number(m[2]);
    const s = Number(m[3]);
    const ms = Number(m[4].padEnd(3, "0").slice(0, 3));
    return ((h * 3600 + min * 60 + s) * 1000 + ms) * 1000;
  };

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [a, b] = timeLine.split("-->").map((s) => s.trim());
    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    if (!textLines.length) continue;
    out.push({
      start: toUs(a),
      end: toUs(b),
      text: textLines.join("\n"),
    });
  }
  return out;
}

export function CaptionPanel() {
  const mate = useCapCutMate();
  const [sourceTab, setSourceTab] =
    useState<CaptionSourceTab>("external-file");
  const [charsPerLine, setCharsPerLine] = useState(30);
  const [maxLines, setMaxLines] = useState(1);
  const [srtText, setSrtText] = useState("");
  const [plainText, setPlainText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setSrtText(text);
      setFileName(file.name);
      setPlainText("");
      toast.success(`Đã tải ${file.name}`);
    } catch {
      toast.error("Không đọc được file");
    }
  };

  const clearFile = () => {
    setFileName(null);
    setSrtText("");
  };

  const buildCaptions = (): Array<Record<string, unknown>> => {
    if (srtText.trim()) {
      const parsed = parseSrt(srtText);
      if (parsed.length) return parsed;
      // SRT không parse được → mỗi dòng non-empty là 1 cue 3s
      const lines = srtText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length) {
        const dur = 3 * api.US;
        return lines.map((text, i) => ({
          start: i * dur,
          end: (i + 1) * dur,
          text,
        }));
      }
    }
    const lines = plainText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const dur = 3 * api.US;
    return lines.map((text, i) => ({
      start: i * dur,
      end: (i + 1) * dur,
      text,
    }));
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      // Ưu tiên draft local nếu đã chọn project CapCut
      if (mate.localProject.trim() && srtText.trim()) {
        const project = requireLocalProject(mate.localProject);
        await local.localImportSrt(project, {
          srt: srtText.trim(),
          font_size: 15,
        });
        toast.success("Đã import SRT vào draft local (BE /import-srt)");
        return;
      }

      const draftUrl = mate.ensureDraft();
      const captions = buildCaptions();
      if (!captions.length) {
        toast.error("Dán SRT hoặc mỗi dòng một phụ đề trước");
        return;
      }
      await api.addCaptions(draftUrl, captions, {
        font_size: 15,
        text_color: "#ffffff",
        alignment: 1,
      });
      const last = captions[captions.length - 1];
      const end = Number(last.end) || 0;
      if (end > mate.timelineEndUs) mate.setTimelineEndUs(end);
      toast.success(`Đã thêm ${captions.length} phụ đề qua BE mate`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thêm phụ đề thất bại");
    } finally {
      setApplying(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (mate.localProject.trim()) {
        const project = requireLocalProject(mate.localProject);
        const res = await local.localExportSrt(project);
        const srt = res.srt || "";
        if (srt) {
          setSrtText(srt);
          // download file
          const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "captions_export.srt";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Đã export SRT từ draft local");
        } else {
          toast.error("Draft local không có phụ đề để export");
        }
        return;
      }
      // Mate: export nội dung ô SRT hiện có
      if (srtText.trim()) {
        const blob = new Blob([srtText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "captions.srt";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Đã tải SRT từ editor (mate không có export-srt)");
        return;
      }
      toast.error("Cần Draft local (export-srt) hoặc nội dung SRT trong ô");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export thất bại");
    } finally {
      setExporting(false);
    }
  };

  const handleGenerate = async () => {
    // BE không ASR — nếu local: chạy caption ops; mate: hướng dẫn
    try {
      if (mate.localProject.trim()) {
        const project = requireLocalProject(mate.localProject);
        await local.localCaption(project, {
          max_chars_per_line: charsPerLine,
          max_lines: maxLines,
        });
        toast.success("Đã gọi local/caption (không phải ASR)");
        return;
      }
      toast(
        "BE không có ASR — dán SRT rồi «Áp dụng vào draft». Hoặc chọn Draft local.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Caption API lỗi");
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PanelGuide
        what="Thêm phụ đề lên draft mate: dán SRT hoặc mỗi dòng một câu (tự chia 3s)."
        how="① Tạo draft · ② dán SRT / text · ③ chỉnh style bên phải · ④ Áp dụng → add_captions."
        need={
          mate.draftUrl
            ? "Đã có draft mate. BE không có ASR — phải có sẵn text/SRT."
            : "Draft mate — «Tạo draft» trên thanh trên."
        }
        tone={mate.draftUrl ? "default" : "warn"}
      />

      <ResizableSplit
        storageKey="capcut-split-caption"
        defaultWidth={320}
        left={
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <CaptionDropZone
              sourceTab={sourceTab}
              onSourceTabChange={setSourceTab}
              onFile={(f) => void handleFile(f)}
              fileName={fileName}
              onClearFile={clearFile}
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-white/50">
                  Nội dung SRT
                </label>
                <textarea
                  value={srtText}
                  onChange={(e) => {
                    setSrtText(e.target.value);
                    if (!e.target.value.trim()) setFileName(null);
                  }}
                  rows={8}
                  spellCheck={false}
                  placeholder={
                    "1\n00:00:00,000 --> 00:00:03,000\nXin chào CapCut Mate\n\n2\n00:00:03,000 --> 00:00:06,000\nDòng hai"
                  }
                  className="w-full resize-y rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-white/90 placeholder:text-white/25 outline-none focus:border-violet-400/40"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-white/50">
                  Hoặc mỗi dòng 1 phụ đề{" "}
                  <span className="font-normal text-white/30">
                    (mỗi dòng 3 giây — dùng khi không có SRT)
                  </span>
                </label>
                <textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  rows={3}
                  placeholder={"Dòng một\nDòng hai"}
                  className="w-full resize-y rounded-lg border border-white/10 bg-[#252830] px-3 py-2.5 text-[13px] text-white/90 placeholder:text-white/25 outline-none focus:border-violet-400/40"
                />
              </div>
            </div>

            <CaptionEngineBar onGenerate={() => void handleGenerate()} />
          </div>
        }
        right={
          <CaptionSidebar
            charsPerLine={charsPerLine}
            maxLines={maxLines}
            onCharsPerLineChange={setCharsPerLine}
            onMaxLinesChange={setMaxLines}
            onApply={() => void handleApply()}
            onExport={() => void handleExport()}
            exporting={exporting}
            applying={applying}
          />
        }
      />

      <CaptionTransport />
    </div>
  );
}

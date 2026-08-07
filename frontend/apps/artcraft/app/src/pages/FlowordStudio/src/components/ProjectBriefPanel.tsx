import React, { useState, useEffect } from 'react';
import { WorkflowInput } from '../services/workflowEngine';
import { fetchOmniRouteModels, OmniRouteModel } from '../api/flowordClient';
import { FileText, Sparkles, FolderOpen, Save, RefreshCw, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectBriefPanelProps {
  input: WorkflowInput;
  onChangeInput: (newInput: WorkflowInput) => void;
  onSaveConfig: () => void;
  onLoadConfig: () => void;
}

export const ProjectBriefPanel: React.FC<ProjectBriefPanelProps> = ({
  input,
  onChangeInput,
  onSaveConfig,
  onLoadConfig,
}) => {
  const [models, setModels] = useState<OmniRouteModel[]>([]);

  useEffect(() => {
    fetchOmniRouteModels().then((res) => setModels(res));
  }, []);

  const handleFieldChange = (field: keyof WorkflowInput, value: any) => {
    onChangeInput({ ...input, [field]: value });
  };

  const handleSourceUrlsChange = (rawText: string) => {
    const urls = rawText.split('\n').map((u) => u.trim()).filter(Boolean);
    onChangeInput({ ...input, sourceUrls: urls });
  };

  const handleApplyPreset = () => {
    onChangeInput({
      ...input,
      prompt: 'Tạo video 30 giây giới thiệu CapCut Automation, mở đầu bằng hook mạnh, gồm 5 cảnh, giọng kể chuyên nghiệp và kết thúc bằng CTA dùng thử.',
      topic: 'CapCut Automation Suite',
      targetDurationSeconds: 30,
      targetPlatform: 'tiktok',
      aspectRatio: '9:16',
      tone: 'professional',
      modelId: models[0]?.id || 'auto',
    });
    toast.success('Đã áp dụng prompt mẫu thử nghiệm CapCut Automation!');
  };

  return (
    <div
      style={{ backgroundColor: '#1a1e28', border: '1px solid rgba(255, 255, 255, 0.08)' }}
      className="rounded-2xl p-4 shadow-md select-none text-slate-100 font-sans"
    >
      {/* Panel Header */}
      <div style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} className="flex items-center justify-between pb-3 mb-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="font-bold text-base text-white">Project Brief — Cấu hình Đầu vào Workflow</h2>
            <p className="text-[11px] text-slate-300">Cổng LLM duy nhất: OmniRoute LLM Gateway (Routes to grok2api & chatgpt2api)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleApplyPreset}
            className="flex items-center gap-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg transition-colors font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" /> Prompt Mẫu Test
          </button>
          <button
            onClick={onSaveConfig}
            className="flex items-center gap-1 bg-[#232836] hover:bg-[#2d3448] text-slate-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" /> Save Config
          </button>
          <button
            onClick={onLoadConfig}
            className="flex items-center gap-1 bg-[#232836] hover:bg-[#2d3448] text-slate-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Load Config
          </button>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Workflow Name, Model Selector & Prompt (7 cols) */}
        <div className="md:col-span-7 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-mono font-bold text-amber-300 mb-1">
                Workflow Name (Tên Dự án):
              </label>
              <input
                type="text"
                value={input.workflowName}
                onChange={(e) => handleFieldChange('workflowName', e.target.value)}
                placeholder="VD: CapCut Automation Launch Campaign"
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-amber-300 mb-1 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-blue-400" /> OmniRoute Model:
              </label>
              <select
                value={input.modelId || 'auto'}
                onChange={(e) => handleFieldChange('modelId', e.target.value)}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} ({m.provider || 'OmniRoute'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-amber-300 mb-1">
              Main Prompt (Kịch bản & Chỉ dẫn chính): <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={input.prompt}
              onChange={(e) => handleFieldChange('prompt', e.target.value)}
              placeholder="Nhập prompt chi tiết cho OmniRoute sinh kịch bản..."
              style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
              Source URLs (Nguồn nội dung TikTok / XHS / YouTube - mỗi URL 1 dòng):
            </label>
            <textarea
              rows={2}
              value={input.sourceUrls.join('\n')}
              onChange={(e) => handleSourceUrlsChange(e.target.value)}
              placeholder="https://tiktok.com/@trend_video..."
              style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              className="w-full px-3 py-1.5 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Right Column: Parameters & Selectors (5 cols) */}
        <div className="md:col-span-5 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Nền tảng Target:</label>
              <select
                value={input.targetPlatform}
                onChange={(e) => handleFieldChange('targetPlatform', e.target.value)}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
              >
                <option value="tiktok">TikTok (9:16)</option>
                <option value="reels">Instagram Reels</option>
                <option value="youtube_shorts">YouTube Shorts</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Thời lượng (Giây):</label>
              <input
                type="number"
                value={input.targetDurationSeconds}
                onChange={(e) => handleFieldChange('targetDurationSeconds', Number(e.target.value))}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Tỷ lệ khung hình:</label>
              <select
                value={input.aspectRatio}
                onChange={(e) => handleFieldChange('aspectRatio', e.target.value)}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
              >
                <option value="9:16">9:16 Vertical</option>
                <option value="16:9">16:9 Landscape</option>
                <option value="1:1">1:1 Square</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Giọng điệu (Tone):</label>
              <select
                value={input.tone}
                onChange={(e) => handleFieldChange('tone', e.target.value)}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
              >
                <option value="professional">Professional</option>
                <option value="storytelling">Storytelling</option>
                <option value="educational">Educational</option>
                <option value="review">Review</option>
                <option value="viral">Viral Trend</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Script Mode:</label>
              <select
                value={input.scriptMode}
                onChange={(e) => handleFieldChange('scriptMode', e.target.value)}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
              >
                <option value="original">Original Script</option>
                <option value="source_based">Source-Based</option>
                <option value="commentary">Commentary</option>
                <option value="remix">Remix</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Output Target:</label>
              <select
                value={input.outputMode}
                onChange={(e) => handleFieldChange('outputMode', e.target.value)}
                style={{ backgroundColor: '#12151e', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                className="w-full px-2.5 py-1.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
              >
                <option value="draft_only">Draft Only (DraftReady)</option>
                <option value="render_video">Render Video (Completed)</option>
              </select>
            </div>
          </div>

          {/* Local File Pickers */}
          <div className="pt-1">
            <button
              onClick={() => {
                const path = 'C:\\Assets\\local_sample_audio.mp3';
                onChangeInput({ ...input, musicPath: path });
                toast.success('Đã chọn tệp âm thanh local!');
              }}
              style={{ backgroundColor: '#232836' }}
              className="w-full px-3 py-1.5 rounded-xl text-slate-200 hover:bg-[#2d3448] flex items-center justify-between text-xs transition-colors"
            >
              <span className="flex items-center gap-1.5 truncate">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                {input.musicPath ? `Nhạc: ${input.musicPath}` : 'Chọn tệp Nhạc nền Local...'}
              </span>
              <span className="text-amber-300 text-[10px]">Browse</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

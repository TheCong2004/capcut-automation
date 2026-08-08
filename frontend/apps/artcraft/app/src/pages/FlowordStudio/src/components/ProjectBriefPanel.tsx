import React, { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { fetchOmniRouteModels, OmniRouteModel } from '../api/flowordClient';
import { WorkflowInput } from '../services/workflowEngine';

interface ProjectBriefPanelProps {
  input: WorkflowInput;
  onChangeInput: (newInput: WorkflowInput) => void;
  onSaveConfig: () => void;
  onLoadConfig: () => void;
}

const fieldLabel = 'mb-1.5 block text-xs font-medium text-zinc-300';
const control = 'floword-control w-full px-3 py-2 text-sm placeholder:text-zinc-600';

export const ProjectBriefPanel: React.FC<ProjectBriefPanelProps> = ({
  input,
  onChangeInput,
  onSaveConfig,
  onLoadConfig,
}) => {
  const [models, setModels] = useState<OmniRouteModel[]>([]);

  useEffect(() => {
    void fetchOmniRouteModels().then(setModels);
  }, []);

  const change = <K extends keyof WorkflowInput>(field: K, value: WorkflowInput[K]) => {
    onChangeInput({ ...input, [field]: value });
  };

  return (
    <section className="floword-card p-5 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Project Brief</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Source and production settings for the next workflow run.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onLoadConfig} className="floword-button floword-button-secondary text-zinc-300">
            <RefreshCw className="h-3.5 w-3.5" /> Load
          </button>
          <button type="button" onClick={onSaveConfig} className="floword-button floword-button-secondary text-zinc-300">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className={fieldLabel} htmlFor="floword-project-name">Project</label>
            <input id="floword-project-name" className={control} value={input.workflowName} onChange={(event) => change('workflowName', event.target.value)} />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-source">Source</label>
            <textarea
              id="floword-source"
              rows={3}
              className={`${control} resize-y font-mono text-xs leading-5`}
              value={input.sourceUrls.join('\n')}
              onChange={(event) => change('sourceUrls', event.target.value.split('\n').map((url) => url.trim()).filter(Boolean))}
              placeholder="One source URL per line"
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-prompt">Prompt</label>
            <textarea
              id="floword-prompt"
              rows={7}
              required
              className={`${control} resize-y leading-6`}
              value={input.prompt}
              onChange={(event) => change('prompt', event.target.value)}
              placeholder="Describe the video, audience, structure, and call to action…"
            />
          </div>
        </div>

        <div className="grid content-start gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={fieldLabel} htmlFor="floword-model">AI Model</label>
            <select id="floword-model" className={control} value={input.modelId || 'auto'} onChange={(event) => change('modelId', event.target.value)}>
              <option value="auto">Auto route</option>
              {models.map((model) => <option key={model.id} value={model.id}>{model.id}</option>)}
            </select>
            {models.length === 0 && <p className="mt-1.5 text-[11px] text-zinc-600">OmniRoute model catalog is currently unavailable.</p>}
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-voice">Voice</label>
            <select id="floword-voice" className={control} value={input.tone} onChange={(event) => change('tone', event.target.value as WorkflowInput['tone'])}>
              <option value="professional">Professional</option>
              <option value="storytelling">Storytelling</option>
              <option value="educational">Educational</option>
              <option value="review">Review</option>
              <option value="viral">Viral</option>
            </select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-language">Language</label>
            <input id="floword-language" className={control} value={input.language} onChange={(event) => change('language', event.target.value)} />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-duration">Duration</label>
            <div className="relative"><input id="floword-duration" type="number" min={1} className={`${control} pr-14`} value={input.targetDurationSeconds} onChange={(event) => change('targetDurationSeconds', Number(event.target.value))} /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-zinc-500">sec</span></div>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-platform">Platform</label>
            <select id="floword-platform" className={control} value={input.targetPlatform} onChange={(event) => change('targetPlatform', event.target.value as WorkflowInput['targetPlatform'])}>
              <option value="tiktok">TikTok</option><option value="reels">Instagram Reels</option><option value="youtube_shorts">YouTube Shorts</option>
            </select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-aspect">Format</label>
            <select id="floword-aspect" className={control} value={input.aspectRatio} onChange={(event) => change('aspectRatio', event.target.value as WorkflowInput['aspectRatio'])}>
              <option value="9:16">9:16 Vertical</option><option value="16:9">16:9 Landscape</option><option value="1:1">1:1 Square</option>
            </select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="floword-output">Output</label>
            <select id="floword-output" className={control} value={input.outputMode} onChange={(event) => change('outputMode', event.target.value as WorkflowInput['outputMode'])}>
              <option value="draft_only">CapCut draft</option><option value="render_video">Rendered video</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                const path = 'C:\\Assets\\local_sample_audio.mp3';
                change('musicPath', path);
                toast.success('Local audio selected');
              }}
              className="floword-button floword-button-secondary w-full justify-between text-zinc-300"
            >
              <span className="flex min-w-0 items-center gap-2"><FolderOpen className="h-4 w-4 shrink-0" /><span className="truncate">{input.musicPath || 'Choose local audio'}</span></span>
              <span className="text-xs text-zinc-500">Browse</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

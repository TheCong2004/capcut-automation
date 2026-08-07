import React, { useState, useEffect } from 'react';
import { HardDrive, Server, Check, RefreshCw, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LocalCapCutDraft {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
  type: 'local' | 'mate';
}

interface DraftExplorerProps {
  activeDraftUrl: string;
  onSelectDraft: (draftUrl: string) => void;
}

export const DraftExplorer: React.FC<DraftExplorerProps> = ({
  activeDraftUrl,
  onSelectDraft,
}) => {
  const [drafts, setDrafts] = useState<LocalCapCutDraft[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'local' | 'mate'>('all');

  const loadDrafts = async () => {
    // Draft listing over Tauri is not wired yet; show only drafts created in this
    // session rather than seeding fake projects.
    setLoading(true);
    setLoading(false);
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const filteredDrafts = drafts.filter((d) => (filter === 'all' ? true : d.type === filter));

  const handleCreateDraft = () => {
    const newId = `draft_${Date.now()}`;
    const newDraft: LocalCapCutDraft = {
      id: newId,
      name: `New CapCut Project ${drafts.length + 1}`,
      path: `draft_id=${newId}`,
      updatedAt: 'Just created',
      type: 'mate',
    };
    setDrafts([newDraft, ...drafts]);
    onSelectDraft(newDraft.path);
    toast.success(`Created & selected new draft: ${newDraft.name}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1f2c] rounded-xl p-4 shadow-md select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/60">
        <div>
          <h3 className="font-bold text-sm text-white">
            Quản lý Dự án Draft CapCut
          </h3>
          <p className="text-xs text-slate-300">Danh sách CapCut Local & Server Projects</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateDraft}
            className="flex items-center gap-1 text-xs font-mono font-bold bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg hover:bg-amber-300 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo Draft Mới
          </button>
          <button
            onClick={loadDrafts}
            disabled={loading}
            className="p-1.5 text-slate-300 hover:text-amber-300 transition-colors bg-[#242a3a] rounded-lg"
            title="Quét lại dự án"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#12151f] p-1.5 rounded-xl mb-3 text-xs font-mono">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
            filter === 'all' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
          }`}
        >
          Tất cả ({drafts.length})
        </button>
        <button
          onClick={() => setFilter('mate')}
          className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
            filter === 'mate' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
          }`}
        >
          Draft Mate
        </button>
        <button
          onClick={() => setFilter('local')}
          className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
            filter === 'local' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
          }`}
        >
          Draft Local
        </button>
      </div>

      {/* Draft List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredDrafts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
            Không tìm thấy dự án nào.
          </div>
        ) : (
          filteredDrafts.map((draft) => {
            const isSelected = activeDraftUrl.includes(draft.id) || activeDraftUrl === draft.path;

            return (
              <div
                key={draft.id}
                onClick={() => {
                  onSelectDraft(draft.path);
                  toast.success(`Đã chọn dự án: ${draft.name}`);
                }}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-400/20 ring-2 ring-amber-400 text-amber-300 font-bold'
                    : 'bg-[#242a3a] text-slate-200 hover:bg-[#2d3448]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {draft.type === 'mate' ? (
                      <Server className="w-4 h-4 text-purple-400" />
                    ) : (
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="text-xs font-bold text-white">{draft.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-400 font-bold" />}
                </div>

                <p className="text-[11px] text-slate-300 font-mono truncate pl-6" title={draft.path}>
                  {draft.path}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

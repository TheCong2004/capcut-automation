import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiFetch } from '@freellmapi/lib/api'
import { Button } from '@freellmapi/components/ui/button'
import { Switch } from '@freellmapi/components/ui/switch'
import { GripVertical, Brain, Zap, DollarSign, Save, RotateCcw, AlertTriangle } from 'lucide-react'

interface FallbackEntry {
  modelDbId: number
  priority: number
  effectivePriority: number
  penalty: number
  rateLimitHits: number
  enabled: boolean
  platform: string
  modelId: string
  displayName: string
  intelligenceRank: number
  speedRank: number
  sizeLabel: string
  rpmLimit: number | null
  rpdLimit: number | null
  monthlyTokenBudget: string
  keyCount: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface TokenUsageData {
  totalBudget: number
  totalUsed: number
  models: { displayName: string; platform: string; budget: number }[]
}

const platformColors: Record<string, string> = {
  google:      '#3b82f6',
  groq:        '#ef4444',
  cerebras:    '#8b5cf6',
  sambanova:   '#14b8a6',
  nvidia:      '#84cc16',
  mistral:     '#f59e0b',
  openrouter:  '#ec4899',
  github:      '#64748b',
  cohere:      '#d946ef',
  cloudflare:  '#f97316',
  zhipu:       '#06b6d4',
  ollama:      '#3b82f6',
  kilo:        '#a855f7',
  pollinations: '#c084fc',
  llm7:        '#38bdf8',
  huggingface: '#eab308',
}

function TokenUsageBar({ data }: { data: TokenUsageData }) {
  const { totalBudget, totalUsed, models } = data
  const remaining = Math.max(0, totalBudget - totalUsed)
  const remainingPct = totalBudget > 0 ? Math.round((remaining / totalBudget) * 100) : 0

  const modelsWithWidth = models.map(m => ({
    ...m,
    remainingTokens: totalBudget > 0 ? (m.budget / totalBudget) * remaining : 0,
    widthPct: totalBudget > 0 ? (m.budget / totalBudget) * (remaining / totalBudget) * 100 : 0,
  }))
  const usedPct = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0

  return (
    <section className="rounded-xl bg-[#14151c] p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Ngân Sách Tokens Hàng Tháng (Budget Pool)</h3>
        <span className="text-xs text-slate-400 tabular-nums font-mono">
          Còn lại: <span className="text-blue-400 font-bold">{formatTokens(remaining)}</span>
          <span className="mx-2 text-slate-600">|</span>
          {remainingPct}% / Tổng {formatTokens(totalBudget)}
        </span>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#0e0f14] p-0.5">
        {modelsWithWidth.map((m, i) => (
          <div
            key={i}
            title={`${m.displayName} (${m.platform}) — ${formatTokens(m.remainingTokens)} remaining`}
            className="h-full rounded-sm transition-all"
            style={{
              width: `${m.widthPct}%`,
              backgroundColor: platformColors[m.platform] ?? '#94a3b8',
            }}
          />
        ))}
        {totalUsed > 0 && (
          <div
            title={`Đã dùng — ${formatTokens(totalUsed)}`}
            className="h-full bg-slate-700/50 rounded-sm"
            style={{ width: `${usedPct}%` }}
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2 text-xs font-mono">
        {modelsWithWidth.map((m, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0 bg-[#0e0f14] p-2 rounded-xl">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: platformColors[m.platform] ?? '#94a3b8' }}
            />
            <span className="truncate text-slate-200 font-medium">{m.displayName}</span>
            <span className="flex-1" />
            <span className="text-blue-400 font-semibold">{formatTokens(m.remainingTokens)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function SortableModelRow({
  entry,
  index,
  onToggle,
}: {
  entry: FallbackEntry
  index: number
  onToggle: (modelDbId: number, enabled: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.modelDbId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-4 px-5 py-3.5 bg-[#14151c] border-b border-white/[0.03] transition-all ${
        isDragging ? 'opacity-40 bg-[#242632]' : 'hover:bg-[#1c1e28]/50'
      } ${entry.enabled ? '' : 'opacity-40'}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-200 transition-colors p-1"
        aria-label="Kéo để đổi thứ tự"
      >
        <GripVertical className="size-4" />
      </button>

      <span className="text-xs font-mono font-bold text-slate-400 w-6 tabular-nums">#{index + 1}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-white">{entry.displayName}</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#0e0f14] text-slate-300">
            {entry.platform}
          </span>
          {entry.penalty > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 flex items-center gap-1">
              <AlertTriangle className="size-3" /> −{entry.penalty} phạt
            </span>
          )}
        </div>

        <div className="flex gap-4 mt-1 text-xs text-slate-400 font-mono tabular-nums">
          <span className="text-blue-400">Trí tuệ: #{entry.intelligenceRank}</span>
          <span className="text-teal-400">Tốc độ: #{entry.speedRank}</span>
          {entry.rpmLimit && <span>RPM: {entry.rpmLimit}</span>}
          {entry.rpdLimit && <span>RPD: {entry.rpdLimit}</span>}
          <span className="text-slate-300">{entry.monthlyTokenBudget} tok/tháng</span>
        </div>
      </div>

      <Switch
        checked={entry.enabled}
        onCheckedChange={(checked) => onToggle(entry.modelDbId, checked)}
      />
    </div>
  )
}

export default function FallbackPage() {
  const queryClient = useQueryClient()
  const [localEntries, setLocalEntries] = useState<FallbackEntry[] | null>(null)

  const { data: rawEntries, isLoading } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })
  const entries = Array.isArray(rawEntries) ? rawEntries : []

  const { data: tokenUsage } = useQuery<TokenUsageData>({
    queryKey: ['fallback', 'token-usage'],
    queryFn: () => apiFetch('/api/fallback/token-usage'),
  })

  const saveMutation = useMutation({
    mutationFn: (data: { modelDbId: number; priority: number; enabled: boolean }[]) =>
      apiFetch('/api/fallback', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      setLocalEntries(null)
    },
  })

  const sortMutation = useMutation({
    mutationFn: (preset: string) =>
      apiFetch(`/api/fallback/sort/${preset}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      setLocalEntries(null)
    },
  })

  const allEntriesRaw = localEntries ?? entries
  const allEntries = Array.isArray(allEntriesRaw) ? allEntriesRaw : []
  const displayEntries = allEntries.filter(e => e.keyCount > 0)
  const unconfiguredPlatforms = [...new Set(allEntries.filter(e => e.keyCount === 0).map(e => e.platform))]

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = displayEntries.findIndex(e => e.modelDbId === active.id)
    const newIndex = displayEntries.findIndex(e => e.modelDbId === over.id)
    const reorderedVisible = arrayMove(displayEntries, oldIndex, newIndex)
    const unconfigured = allEntries.filter(e => e.keyCount === 0)
    const merged = [
      ...reorderedVisible.map((e, i) => ({ ...e, priority: i + 1 })),
      ...unconfigured.map((e, i) => ({ ...e, priority: reorderedVisible.length + i + 1 })),
    ]
    setLocalEntries(merged)
  }

  function handleToggle(modelDbId: number, enabled: boolean) {
    const updated = allEntries.map(e =>
      e.modelDbId === modelDbId ? { ...e, enabled } : e
    )
    setLocalEntries(updated)
  }

  function handleSave() {
    if (!localEntries) return
    saveMutation.mutate(
      allEntries.map(e => ({
        modelDbId: e.modelDbId,
        priority: e.priority,
        enabled: e.enabled,
      }))
    )
  }

  const hasChanges = localEntries !== null

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-lg font-bold text-white">Chuỗi Ưu Tiên & Xoay Vòng Fallback</h2>
          <p className="text-xs text-slate-400 mt-0.5">Kéo thả để sắp xếp thứ tự ưu tiên thử nghiệm từ trên xuống dưới.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sortMutation.mutate('intelligence')}
            disabled={sortMutation.isPending}
            className="border-0 bg-[#242632] hover:bg-[#2e3140] text-slate-200 text-xs gap-1.5 rounded-xl"
          >
            <Brain className="size-3.5 text-blue-400" /> Trí Tuệ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sortMutation.mutate('speed')}
            disabled={sortMutation.isPending}
            className="border-0 bg-[#242632] hover:bg-[#2e3140] text-slate-200 text-xs gap-1.5 rounded-xl"
          >
            <Zap className="size-3.5 text-amber-400" /> Tốc Độ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sortMutation.mutate('budget')}
            disabled={sortMutation.isPending}
            className="border-0 bg-[#242632] hover:bg-[#2e3140] text-slate-200 text-xs gap-1.5 rounded-xl"
          >
            <DollarSign className="size-3.5 text-teal-400" /> Ngân Sách
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {tokenUsage && tokenUsage.totalBudget > 0 && (
          <TokenUsageBar data={tokenUsage} />
        )}

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm bg-[#14151c] rounded-xl">
            Đang tải danh sách chuỗi Fallback…
          </div>
        ) : displayEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center bg-[#14151c]/50">
            <p className="text-sm text-slate-400">
              Chưa có Model nào khả dụng. Vui lòng thêm API Key tại mục <a href="#" className="underline text-blue-400 font-bold">Quản lý API Keys</a> trước!
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl overflow-hidden bg-[#14151c] shadow-sm">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayEntries.map(e => e.modelDbId)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayEntries.map((entry, index) => (
                    <SortableModelRow
                      key={entry.modelDbId}
                      entry={entry}
                      index={index}
                      onToggle={handleToggle}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {hasChanges && (
              <div className="flex justify-end gap-3 p-4 bg-[#14151c] rounded-xl shadow-lg">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalEntries(null)}
                  className="border-0 bg-[#242632] text-slate-300 text-xs gap-1.5 rounded-xl"
                >
                  <RotateCcw className="size-3.5" /> Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 px-5 rounded-xl border-0 shadow"
                >
                  <Save className="size-3.5" />
                  {saveMutation.isPending ? 'Đang lưu…' : 'Lưu Thứ Tự Chuỗi'}
                </Button>
              </div>
            )}

            {unconfiguredPlatforms.length > 0 && (
              <p className="text-xs text-slate-500 font-mono">
                Ẩn do chưa thêm API Key: {unconfiguredPlatforms.join(', ')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

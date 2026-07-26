import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getBase } from '@freellmapi/lib/api'
import { Button } from '@freellmapi/components/ui/button'
import { Input } from '@freellmapi/components/ui/input'
import { Label } from '@freellmapi/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@freellmapi/components/ui/select'
import { Switch } from '@freellmapi/components/ui/switch'
import { Copy, Eye, EyeOff, RefreshCw, Plus, Trash2, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react'
import type { ApiKey, Platform } from '../../../shared/types'

const PLATFORMS: { value: Platform; label: string; tag: string }[] = [
  { value: 'google', label: 'Google AI Studio (Gemini)', tag: 'Fast & Free' },
  { value: 'groq', label: 'Groq (Llama 3 / Mixtral)', tag: 'Ultra High Speed' },
  { value: 'cerebras', label: 'Cerebras AI', tag: 'Supercomputer' },
  { value: 'sambanova', label: 'SambaNova', tag: 'High Speed' },
  { value: 'nvidia', label: 'NVIDIA NIM', tag: 'Enterprise' },
  { value: 'mistral', label: 'Mistral AI', tag: 'Official' },
  { value: 'openrouter', label: 'OpenRouter', tag: 'Aggregator' },
  { value: 'github', label: 'GitHub Models', tag: 'Free Tier' },
  { value: 'cohere', label: 'Cohere', tag: 'Command-R' },
  { value: 'cloudflare', label: 'Cloudflare Workers AI', tag: 'Edge' },
  { value: 'zhipu', label: 'Zhipu AI (GLM)', tag: 'CN' },
  { value: 'ollama', label: 'Ollama Cloud / Local', tag: 'Self-hosted' },
  { value: 'kilo', label: 'Kilo Gateway', tag: 'Anon' },
  { value: 'pollinations', label: 'Pollinations AI', tag: 'Anon Free' },
  { value: 'llm7', label: 'LLM7', tag: 'Anon' },
  { value: 'huggingface', label: 'HuggingFace Router', tag: 'Open Source' },
]

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: 'bg-emerald-400', bg: 'bg-[#14151a] text-emerald-400', label: 'Sẵn sàng' },
  rate_limited: { color: 'bg-amber-400', bg: 'bg-[#14151a] text-amber-400', label: 'Chờ Quota' },
  invalid: { color: 'bg-rose-400', bg: 'bg-[#14151a] text-rose-400', label: 'Lỗi Key' },
  error: { color: 'bg-rose-400', bg: 'bg-[#14151a] text-rose-400', label: 'Lỗi server' },
  unknown: { color: 'bg-slate-500', bg: 'bg-[#14151a] text-slate-400', label: 'Chưa check' },
}

interface HealthPlatform {
  platform: string
  totalKeys: number
  healthyKeys: number
  rateLimitedKeys: number
  invalidKeys: number
  errorKeys: number
  unknownKeys: number
}

interface HealthData {
  platforms: HealthPlatform[]
  keys: { id: number; platform: string; status: string; lastCheckedAt: string | null }[]
}

function UnifiedKeySection() {
  const queryClient = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const regenerate = useMutation({
    mutationFn: () => apiFetch('/api/settings/api-key/regenerate', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified-key'] }),
  })

  const apiKey = data?.apiKey ?? ''
  const masked = apiKey ? apiKey.slice(0, 14) + '•'.repeat(28) : '…'
  const baseUrl = `${getBase()}/v1`

  function copy() {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="rounded-xl bg-[#14151c] p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#242632] text-blue-400">
              <Cpu className="size-4" />
            </span>
            <h3 className="text-base font-bold text-white">Unified Proxy API Key</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dùng Key này thay thế cho <code className="font-mono bg-[#242632] text-slate-200 px-1.5 py-0.5 rounded">OpenAI api_key</code> trong ứng dụng của bạn để tự động xoay vòng API Keys.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
          className="border-0 bg-[#242632] hover:bg-[#2e3140] text-slate-200 text-xs gap-1.5 rounded-xl"
        >
          <RefreshCw className={`size-3.5 ${regenerate.isPending ? 'animate-spin' : ''}`} />
          Tạo lại Key mới
        </Button>
      </div>

      {/* Key Box */}
      <div className="flex items-center gap-2 bg-[#0e0f14] rounded-xl p-2 pl-4">
        <code className="flex-1 font-mono text-xs text-blue-400 select-all truncate tabular-nums">
          {showKey ? apiKey : masked}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowKey(!showKey)}
          className="text-slate-400 hover:text-slate-200 text-xs gap-1"
        >
          {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showKey ? 'Ẩn' : 'Hiện'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={copy}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 rounded-lg border-0 shadow"
        >
          {copied ? <CheckCircle2 className="size-3.5 text-white" /> : <Copy className="size-3.5" />}
          {copied ? 'Đã chép' : 'Sao chép'}
        </Button>
      </div>

      {/* Endpoints */}
      <div className="mt-4 pt-3.5 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 bg-[#0e0f14] p-3 rounded-xl">
          <span className="text-slate-400 font-medium">Base URL:</span>
          <code className="font-mono text-slate-200 font-medium select-all">{baseUrl}</code>
        </div>
        <div className="flex items-center gap-2 bg-[#0e0f14] p-3 rounded-xl">
          <span className="text-slate-400 font-medium">Completions Endpoint:</span>
          <code className="font-mono text-slate-200 font-medium select-all">/v1/chat/completions</code>
        </div>
      </div>
    </section>
  )
}

export default function KeysPage() {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [accountId, setAccountId] = useState('')
  const [label, setLabel] = useState('')

  const { data: rawKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: () => apiFetch('/api/keys'),
  })
  const keys = Array.isArray(rawKeys) ? rawKeys : []

  const { data: healthData } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    refetchInterval: 30000,
  })

  const addKey = useMutation({
    mutationFn: (body: { platform: string; key: string; label?: string }) =>
      apiFetch('/api/keys', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      setPlatform('')
      setApiKey('')
      setAccountId('')
      setLabel('')
    },
  })

  const deleteKey = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
    },
  })

  const checkAll = useMutation({
    mutationFn: () => apiFetch('/api/health/check-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const checkKey = useMutation({
    mutationFn: (keyId: number) => apiFetch(`/api/health/check/${keyId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const togglePlatform = useMutation({
    mutationFn: ({ platform, enabled }: { platform: string; enabled: boolean }) =>
      apiFetch(`/api/keys/platform/${platform}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    },
  })

  const needsAccountId = platform === 'cloudflare'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!platform || !apiKey) return
    if (needsAccountId && !accountId) return
    const key = needsAccountId ? `${accountId}:${apiKey}` : apiKey
    addKey.mutate({ platform, key, label: label || undefined })
  }

  const healthKeyMap = new Map<number, { status: string; lastCheckedAt: string | null }>()
  for (const k of healthData?.keys ?? []) healthKeyMap.set(k.id, k)

  const grouped = PLATFORMS.map(p => ({
    ...p,
    keys: keys.filter(k => k.platform === p.value),
  })).filter(p => p.keys.length > 0)

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-lg font-bold text-white">Quản Lý API Keys & Platform</h2>
          <p className="text-xs text-slate-400 mt-0.5">Thêm và kiểm tra tình trạng kết nối các API Key.</p>
        </div>
        {keys.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkAll.mutate()}
            disabled={checkAll.isPending}
            className="border-0 bg-[#242632] hover:bg-[#2e3140] text-slate-200 text-xs gap-1.5 rounded-xl"
          >
            <RefreshCw className={`size-3.5 ${checkAll.isPending ? 'animate-spin' : ''}`} />
            {checkAll.isPending ? 'Đang kiểm tra tất cả…' : 'Kiểm tra toàn bộ Keys'}
          </Button>
        )}
      </div>

      <UnifiedKeySection />

      {/* Add New Key Card */}
      <section className="rounded-xl bg-[#14151c] p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="p-1 rounded-md bg-[#242632] text-blue-400">
            <Plus className="size-4" />
          </span>
          <h3 className="text-sm font-bold text-white">Thêm API Key Mới</h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-medium">Nhà cung cấp (Platform)</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger className="w-[260px] bg-[#0e0f14] border-0 text-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-blue-500/50">
                <SelectValue placeholder="Chọn nhà cung cấp..." />
              </SelectTrigger>
              <SelectContent className="bg-[#181920] border-0 text-slate-200 max-h-72">
                {PLATFORMS.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-xs focus:bg-[#282a36] focus:text-blue-400">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{p.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0e0f14] text-slate-400 font-mono">{p.tag}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsAccountId && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Account ID</Label>
              <Input
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                placeholder="Ví dụ: a1b2c3d4…"
                className="w-[200px] bg-[#0e0f14] border-0 font-mono text-xs text-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          )}

          <div className="space-y-1.5 flex-1 min-w-[260px]">
            <Label className="text-xs text-slate-300 font-medium">{needsAccountId ? 'API Token' : 'API Key'}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={needsAccountId ? 'Dán Bearer token' : 'Dán chuỗi API Key vào đây...'}
              className="bg-[#0e0f14] border-0 font-mono text-xs text-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-medium">Nhãn gợi nhớ (Label)</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Tùy chọn"
              className="w-[160px] bg-[#0e0f14] border-0 text-xs text-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={!platform || !apiKey || (needsAccountId && !accountId) || addKey.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 rounded-xl border-0 shadow"
          >
            {addKey.isPending ? 'Đang thêm…' : 'Thêm Key'}
          </Button>
        </form>

        {addKey.isError && (
          <p className="text-rose-400 text-xs mt-3 flex items-center gap-1">
            <ShieldAlert className="size-3.5" /> {(addKey.error as Error).message}
          </p>
        )}
      </section>

      {/* Configured Keys List */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <span>Danh Sách Key Theo Nhà Cung Cấp</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#14151c] text-slate-400 font-mono">
            {keys.length} Keys
          </span>
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm bg-[#14151c] rounded-xl">
            Đang tải danh sách API Keys…
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center bg-[#14151c]/50">
            <p className="text-sm text-slate-400">Chưa có API Key nào được cài đặt.</p>
            <p className="text-xs text-slate-500 mt-1">Hãy chọn nhà cung cấp ở biểu mẫu phía trên và thêm Key đầu tiên để bắt đầu!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(group => (
              <div key={group.value} className="rounded-xl bg-[#14151c] overflow-hidden shadow-sm">
                {/* Platform Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#0e0f14]">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={group.keys.some(k => k.enabled)}
                      onCheckedChange={(checked) =>
                        togglePlatform.mutate({ platform: group.value, enabled: checked })
                      }
                      disabled={togglePlatform.isPending}
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{group.label}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">{group.tag}</p>
                    </div>
                  </div>
                  <span className="text-xs text-blue-400 font-mono font-medium px-2.5 py-0.5 rounded bg-[#14151c]">
                    {group.keys.length} Key{group.keys.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Keys Items */}
                <div className="divide-y divide-white/[0.03]">
                  {group.keys.map(k => {
                    const h = healthKeyMap.get(k.id)
                    const status = h?.status ?? k.status
                    const lastChecked = h?.lastCheckedAt
                    const st = statusConfig[status] ?? statusConfig.unknown

                    return (
                      <div key={k.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#1c1e28]/50 transition-colors">
                        {/* Status Dot */}
                        <span className={`size-2 rounded-full flex-shrink-0 ${st.color}`} />
                        
                        {/* Key Masked */}
                        <code className="text-xs font-mono text-slate-200 font-medium flex-shrink-0">{k.maskedKey}</code>
                        
                        {k.label && (
                          <span className="text-xs px-2 py-0.5 rounded bg-[#242632] text-slate-300 font-medium">
                            {k.label}
                          </span>
                        )}

                        {/* Status Badge */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${st.bg}`}>
                          {st.label}
                        </span>

                        <div className="flex-1" />

                        {lastChecked && (
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            Check: {new Date(lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => checkKey.mutate(k.id)}
                          disabled={checkKey.isPending}
                          className="text-slate-400 hover:text-slate-200 text-xs"
                        >
                          Check
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-slate-400 hover:text-rose-400 text-xs"
                          onClick={() => deleteKey.mutate(k.id)}
                          disabled={deleteKey.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

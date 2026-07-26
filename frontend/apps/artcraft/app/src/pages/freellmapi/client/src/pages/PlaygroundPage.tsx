import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, getBase } from '@freellmapi/lib/api'
import { Button } from '@freellmapi/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@freellmapi/components/ui/select'
import { Send, Trash2, Bot, User, Sparkles, Cpu, Clock, Layers } from 'lucide-react'

interface FallbackEntry {
  modelDbId: number
  priority: number
  enabled: boolean
  platform: string
  modelId: string
  displayName: string
  sizeLabel: string
  keyCount: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  meta?: {
    platform?: string
    model?: string
    latency?: number
    fallbackAttempts?: number
  }
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('auto')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: keyData } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const { data: rawEntries } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })
  const fallbackEntries = Array.isArray(rawEntries) ? rawEntries : []

  const availableModels = fallbackEntries.filter(e => e?.keyCount > 0 && e?.enabled)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`

      const body: any = {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      }
      if (selectedModel !== 'auto') body.model = selectedModel

      const base = getBase()
      const start = Date.now()
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      const latency = Date.now() - start
      const routedVia = res.headers.get('X-Routed-Via')
      const fallbackAttempts = res.headers.get('X-Fallback-Attempts')

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        setMessages([...newMessages, {
          role: 'assistant',
          content: `Error: ${err.error?.message ?? 'Unknown error'}`,
        }])
        return
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2)
      const via = data._routed_via ?? (routedVia ? {
        platform: routedVia.split('/')[0],
        model: routedVia.split('/').slice(1).join('/'),
      } : undefined)

      setMessages([...newMessages, {
        role: 'assistant',
        content,
        meta: {
          platform: via?.platform,
          model: via?.model,
          latency,
          fallbackAttempts: fallbackAttempts ? parseInt(fallbackAttempts) : undefined,
        },
      }])
    } catch (err: any) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Error: ${err.message}`,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    inputRef.current?.focus()
  }

  const activeModelLabel = selectedModel === 'auto'
    ? 'Auto (tự chọn model tối ưu)'
    : availableModels.find(m => m.modelId === selectedModel)?.displayName ?? selectedModel

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[480px] space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-lg font-bold text-white">Interactive Playground</h2>
          <p className="text-xs text-slate-400 mt-0.5">Gửi tin nhắn thử nghiệm trực tiếp qua Gateway.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v ?? 'auto')}>
            <SelectTrigger className="w-[260px] bg-[#14151c] border-0 text-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-blue-500/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#181920] border-0 text-slate-200 max-h-72">
              <SelectItem value="auto" className="text-xs text-blue-400 font-medium focus:bg-[#242632]">
                ⚡ Auto (Tự động chuyển kênh)
              </SelectItem>
              {availableModels.map(m => (
                <SelectItem key={m.modelDbId} value={m.modelId} className="text-xs focus:bg-[#242632]">
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{m.displayName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#14151c] text-slate-400 font-mono">{m.platform}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="border-0 bg-[#242632] hover:bg-[#2e3140] text-slate-300 text-xs gap-1.5 rounded-xl"
            >
              <Trash2 className="size-3.5" /> Xóa
            </Button>
          )}
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="flex-1 flex flex-col rounded-xl bg-[#14151c] overflow-hidden min-h-0 shadow-sm">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-2.5 max-w-md p-8 rounded-xl border border-dashed border-white/[0.06] bg-[#0e0f14]">
                <div className="size-10 rounded-lg bg-[#242632] text-blue-400 flex items-center justify-center mx-auto">
                  <Sparkles className="size-5" />
                </div>
                <h4 className="text-sm font-bold text-white">Bắt đầu trò chuyện thử nghiệm</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Đang sử dụng cấu hình: <span className="text-blue-400 font-medium">{activeModelLabel}</span>.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="size-8 rounded-lg bg-[#242632] text-blue-400 flex items-center justify-center shrink-0">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div className="max-w-[75%] space-y-1.5">
                    <div
                      className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white font-medium shadow rounded-tr-none'
                          : 'bg-[#0e0f14] text-slate-200 rounded-tl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>

                    {msg.meta && (
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-mono">
                        {msg.meta.platform && (
                          <span className="px-2 py-0.5 rounded bg-[#0e0f14] text-slate-300 flex items-center gap-1">
                            <Cpu className="size-3 text-blue-400" /> {msg.meta.platform}
                          </span>
                        )}
                        {msg.meta.model && (
                          <span className="px-2 py-0.5 rounded bg-[#0e0f14] text-slate-300">
                            {msg.meta.model}
                          </span>
                        )}
                        {msg.meta.latency != null && (
                          <span className="px-2 py-0.5 rounded bg-[#0e0f14] text-slate-300 flex items-center gap-1">
                            <Clock className="size-3" /> {msg.meta.latency} ms
                          </span>
                        )}
                        {msg.meta.fallbackAttempts != null && msg.meta.fallbackAttempts > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 flex items-center gap-1">
                            <Layers className="size-3" /> {msg.meta.fallbackAttempts} lần xoay vòng
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="size-8 rounded-lg bg-[#242632] text-blue-400 flex items-center justify-center shrink-0">
                    <Bot className="size-4" />
                  </div>
                  <div className="bg-[#0e0f14] rounded-xl rounded-tl-none px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Textarea Input Container */}
        <div className="border-t border-white/[0.04] bg-[#0e0f14] p-3.5">
          <div className="flex gap-2.5 items-end bg-[#14151c] rounded-xl p-2 focus-within:ring-1 focus-within:ring-blue-500/50">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi... (Nhấn Enter để gửi, Shift+Enter để xuống dòng)"
              rows={1}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none min-h-[38px] max-h-[140px] resize-none border-0"
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 140) + 'px'
              }}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 h-9 gap-1.5 rounded-lg border-0 shadow"
            >
              <Send className="size-3.5" />
              {loading ? 'Đang gửi…' : 'Gửi'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

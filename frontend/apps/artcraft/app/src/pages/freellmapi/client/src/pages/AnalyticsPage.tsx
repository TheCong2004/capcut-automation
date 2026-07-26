import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@freellmapi/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@freellmapi/components/ui/table'

type TimeRange = '24h' | '7d' | '30d'

function formatTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="rounded-xl bg-[#14151c] p-4 shadow-sm">
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1.5 text-white ${className ?? ''}`}>{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#14151c] overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-[#0e0f14]">
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// Lightweight native SVG Bar Chart
function SimpleBarChart({ data, dataKey, xKey, barColor = "#3b82f6", unit = "" }: {
  data: any[];
  dataKey: string;
  xKey: string;
  barColor?: string;
  unit?: string;
}) {
  if (!data || data.length === 0) return <p className="text-sm text-slate-500 text-center py-8">Chưa có dữ liệu thống kê</p>;

  const maxVal = Math.max(...data.map(d => Number(d[dataKey]) || 0), 1);

  return (
    <div className="space-y-3 py-1">
      {data.map((item, idx) => {
        const val = Number(item[dataKey]) || 0;
        const pct = Math.round((val / maxVal) * 100);
        return (
          <div key={idx} className="flex items-center gap-3 text-xs font-mono">
            <span className="w-24 truncate font-medium text-slate-300">{item[xKey]}</span>
            <div className="flex-1 h-4 bg-[#0e0f14] rounded overflow-hidden flex items-center p-0.5">
              <div
                className="h-full transition-all duration-300 rounded"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="w-20 text-right text-blue-400 font-bold">{val} {unit}</span>
          </div>
        );
      })}
    </div>
  );
}

// Lightweight native SVG Line Chart
function SimpleLineChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <p className="text-sm text-slate-500 text-center py-8">Chưa có dữ liệu biểu đồ</p>;

  const maxVal = Math.max(
    ...data.map(d => Math.max(Number(d.successCount) || 0, Number(d.failureCount) || 0)),
    1
  );

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-end gap-4 text-xs font-mono mb-2">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/> Thành công</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/> Thất bại</div>
      </div>
      <div className="space-y-2">
        {data.slice(-10).map((item, idx) => {
          const succ = Number(item.successCount) || 0;
          const fail = Number(item.failureCount) || 0;
          const succPct = Math.round((succ / maxVal) * 100);
          const failPct = Math.round((fail / maxVal) * 100);

          return (
            <div key={idx} className="flex items-center gap-3 text-xs font-mono">
              <span className="w-24 truncate text-slate-400">{item.timestamp}</span>
              <div className="flex-1 space-y-1">
                <div className="h-2 bg-[#0e0f14] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all rounded-full" style={{ width: `${Math.max(succPct, 1)}%` }} />
                </div>
                {fail > 0 && (
                  <div className="h-2 bg-[#0e0f14] rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all rounded-full" style={{ width: `${Math.max(failPct, 1)}%` }} />
                  </div>
                )}
              </div>
              <span className="w-24 text-right font-bold text-[11px]">
                <span className="text-blue-400">{succ}</span> / <span className="text-rose-400">{fail}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('7d')

  const { data: summary } = useQuery({
    queryKey: ['analytics', 'summary', range],
    queryFn: () => apiFetch<any>(`/api/analytics/summary?range=${range}`),
  })

  const { data: rawByPlatform } = useQuery({
    queryKey: ['analytics', 'by-platform', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/by-platform?range=${range}`),
  })
  const byPlatform = Array.isArray(rawByPlatform) ? rawByPlatform : []

  const { data: rawTimeline } = useQuery({
    queryKey: ['analytics', 'timeline', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/timeline?range=${range}`),
  })
  const timeline = Array.isArray(rawTimeline) ? rawTimeline : []

  const { data: rawByModel } = useQuery({
    queryKey: ['analytics', 'by-model', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/by-model?range=${range}`),
  })
  const byModel = Array.isArray(rawByModel) ? rawByModel : []

  const { data: rawErrors } = useQuery({
    queryKey: ['analytics', 'errors', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/errors?range=${range}`),
  })
  const errors = Array.isArray(rawErrors) ? rawErrors : []

  const { data: errorDist } = useQuery({
    queryKey: ['analytics', 'error-distribution', range],
    queryFn: () => apiFetch<{ byCategory: any[]; byPlatform: any[]; detailed: any[] }>(`/api/analytics/error-distribution?range=${range}`),
  })

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-lg font-bold text-white">Thống Kê Hiệu Năng & Nhật Ký Truy Vấn</h2>
          <p className="text-xs text-slate-400 mt-0.5">Theo dõi số lượng Yêu cầu, Tỷ lệ Thành công, Độ trễ Latency, Tiêu thụ Token và Chi phí Tiết kiệm.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-[#0e0f14] p-1">
          {(['24h', '7d', '30d'] as TimeRange[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-medium font-mono transition-colors ${
                range === r
                  ? 'bg-[#242632] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Tổng Yêu Cầu" value={summary?.totalRequests ?? 0} className="text-blue-400" />
          <Stat label="Tỷ lệ Thành công" value={`${summary?.successRate ?? 0}%`} className="text-teal-400" />
          <Stat label="Tokens Đầu vào" value={formatTokens(summary?.totalInputTokens)} />
          <Stat label="Tokens Đầu ra" value={formatTokens(summary?.totalOutputTokens)} />
          <Stat label="Độ trễ trung bình" value={`${summary?.avgLatencyMs ?? 0} ms`} />
          <Stat label="Ước tính Tiết kiệm" value={`$${summary?.estimatedCostSavings ?? '0.00'}`} className="text-blue-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Số lượng Requests theo Nhà Cung Cấp">
            <SimpleBarChart data={byPlatform} dataKey="requests" xKey="platform" barColor="#3b82f6" />
          </Panel>

          <Panel title="Độ trễ Latency trung bình (ms)">
            <SimpleBarChart data={byPlatform} dataKey="avgLatencyMs" xKey="platform" unit="ms" barColor="#6366f1" />
          </Panel>

          <div className="lg:col-span-2">
            <Panel title="Tần suất Yêu cầu theo Thời gian">
              <SimpleLineChart data={timeline} />
            </Panel>
          </div>

          <div className="lg:col-span-2">
            <Panel title="Chi tiết Hiệu năng từng Model">
              {byModel.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Chưa có dữ liệu</p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto -mx-5 -mb-5 border-t border-white/[0.04]">
                  <Table>
                    <TableHeader className="bg-[#0e0f14]">
                      <TableRow className="border-white/[0.04]">
                        <TableHead className="pl-5 text-slate-400 text-xs font-bold">Model</TableHead>
                        <TableHead className="text-slate-400 text-xs font-bold">Platform</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-bold">Requests</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-bold">Thành công</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-bold">Latency</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-bold">Tokens In</TableHead>
                        <TableHead className="text-right pr-5 text-slate-400 text-xs font-bold">Tokens Out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byModel.map((m: any, i: number) => (
                        <TableRow key={i} className="border-white/[0.03] hover:bg-[#1c1e28]/50 font-mono text-xs">
                          <TableCell className="pl-5 font-medium text-white">{m.displayName}</TableCell>
                          <TableCell className="text-slate-400">{m.platform}</TableCell>
                          <TableCell className="text-right tabular-nums text-slate-200">{m.requests}</TableCell>
                          <TableCell className="text-right tabular-nums text-blue-400 font-bold">{m.successRate}%</TableCell>
                          <TableCell className="text-right tabular-nums text-slate-300">{m.avgLatencyMs} ms</TableCell>
                          <TableCell className="text-right tabular-nums text-slate-400">{formatTokens(m.totalInputTokens)}</TableCell>
                          <TableCell className="text-right tabular-nums pr-5 text-slate-400">{formatTokens(m.totalOutputTokens)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Phân bố Lỗi theo Nhà Cung Cấp">
            {!errorDist?.byPlatform?.length ? (
              <p className="text-sm text-slate-500 text-center py-8">Không ghi nhận lỗi nào</p>
            ) : (
              <SimpleBarChart data={errorDist.byPlatform} dataKey="count" xKey="platform" barColor="#f43f5e" />
            )}
          </Panel>

          <Panel title="Nhật ký Lỗi gần đây (Recent Errors)">
            {errors.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Không có lỗi gần đây</p>
            ) : (
              <div className="max-h-[240px] overflow-y-auto -mx-5 -mb-5 border-t border-white/[0.04]">
                <Table>
                  <TableHeader className="bg-[#0e0f14]">
                    <TableRow className="border-white/[0.04]">
                      <TableHead className="pl-5 text-slate-400 text-xs font-bold">Provider</TableHead>
                      <TableHead className="text-slate-400 text-xs font-bold">Message</TableHead>
                      <TableHead className="text-right pr-5 text-slate-400 text-xs font-bold">Thời gian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.slice(0, 20).map((e: any) => (
                      <TableRow key={e.id} className="border-white/[0.03] hover:bg-[#1c1e28]/50 text-xs font-mono">
                        <TableCell className="pl-5 text-slate-300 font-semibold">{e.platform}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-rose-400">{e.error}</TableCell>
                        <TableCell className="text-right text-slate-500 tabular-nums pr-5">
                          {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

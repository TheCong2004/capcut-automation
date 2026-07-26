import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Key, Terminal, SlidersHorizontal, BarChart3, KeyRound } from 'lucide-react'
import KeysPage from '@freellmapi/pages/KeysPage'
import PlaygroundPage from '@freellmapi/pages/PlaygroundPage'
import FallbackPage from '@freellmapi/pages/FallbackPage'
import AnalyticsPage from '@freellmapi/pages/AnalyticsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function FreeLLMAppContent() {
  const [activeTab, setActiveTab] = useState<'keys' | 'playground' | 'fallback' | 'analytics'>('keys')

  const tabs = [
    { id: 'keys', label: 'Quản lý API Keys', icon: Key },
    { id: 'playground', label: 'Playground', icon: Terminal },
    { id: 'fallback', label: 'Xoay vòng Fallback', icon: SlidersHorizontal },
    { id: 'analytics', label: 'Thống kê & Log', icon: BarChart3 },
  ] as const

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-full bg-[#121318] text-slate-200 font-sans selection:bg-blue-600/30 py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Native ArtCraft Hero Title Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-[#1c1e26] text-blue-400 mb-1 shadow-md">
              <KeyRound className="size-6 text-blue-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">Free LLM API</h1>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Quản lý và xoay vòng API Key LLM miễn phí (Google, Groq, Mistral, Cerebras...)
            </p>
          </div>

          {/* Sub Navigation Bar (Soft Muted Pills - No Bright Borders) */}
          <div className="flex justify-center">
            <nav className="inline-flex items-center gap-1 bg-[#181920] p-1.5 rounded-2xl shadow-inner">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-[#2a2c38] text-white shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f212a]'
                    }`}
                  >
                    <Icon className={`size-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Card Container (Soft Borderless Dark Theme) */}
          <div className="bg-[#1c1e26] rounded-2xl p-6 sm:p-8 shadow-2xl">
            {activeTab === 'keys' && <KeysPage />}
            {activeTab === 'playground' && <PlaygroundPage />}
            {activeTab === 'fallback' && <FallbackPage />}
            {activeTab === 'analytics' && <AnalyticsPage />}
          </div>
        </div>
      </div>
    </QueryClientProvider>
  )
}

function App() {
  return <FreeLLMAppContent />
}

export default App

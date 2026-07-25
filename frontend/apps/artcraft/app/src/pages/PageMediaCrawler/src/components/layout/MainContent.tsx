import { Terminal } from '@mediacrawler/components/console/Terminal'
import { useLogWebSocket } from '@mediacrawler/hooks/useWebSocket'

export function MainContent() {
  // Connect to WebSocket for logs
  useLogWebSocket()

  return (
    <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-10">
      <Terminal />
    </main>
  )
}

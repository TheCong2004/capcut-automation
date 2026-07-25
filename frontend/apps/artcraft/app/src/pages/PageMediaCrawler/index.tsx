import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import App from './src/App'
import './src/i18n'
import './src/index.css'

export function PageMediaCrawler() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

// components/providers.tsx
"use client"

import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState } from "react"

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            console.error(`[Query error] ${query.queryKey}:`, error)
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        forcedTheme="light"
        disableTransitionOnChange
        nonce={nonce}
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

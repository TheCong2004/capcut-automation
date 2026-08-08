import React, { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@vynaro/routes/-routeTree.gen";
import "@vynaro/styles/globals.css";

const vynaroQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const VynaroFeatureRoot: React.FC = () => {
  const router = useMemo(() => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ["/"],
    });
    return createRouter({
      routeTree,
      history: memoryHistory,
      context: { queryClient: vynaroQueryClient },
      defaultPreload: "intent",
    });
  }, []);

  return (
    <div className="vynaro-root h-full w-full overflow-hidden">
      <QueryClientProvider client={vynaroQueryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </div>
  );
};

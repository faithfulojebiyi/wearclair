import { QueryClient } from '@tanstack/react-query';

// module-level so account cleanup (sign-out, expiry, owner change) can clear it
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

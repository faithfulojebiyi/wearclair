import { ClsStore } from 'nestjs-cls';

// request-scoped context. SessionGuard populates userId from the Better Auth
// session; requestId is set by the CLS middleware.
export type AlsContext = {
  requestId?: string;
  userId?: string;
} & ClsStore;

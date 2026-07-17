// Main module
export { MastraModule } from './mastra.module';
export type {
  MastraModuleOptions,
  MastraModuleAsyncOptions,
  MastraModuleOptionsFactory,
} from './mastra.module';

// Service
export { MastraService } from './mastra.service';

// Constants (for @Inject)
export { MASTRA, MASTRA_OPTIONS, MASTRA_ROUTE_BASE } from './constants';

// Decorators
export { Public } from './decorators/public.decorator';
export {
  MastraThrottle,
  SkipThrottle,
  type ThrottleOptions,
} from './decorators/throttle.decorator';

// Guards (for custom usage)
export { MastraAuthGuard } from './guards/mastra-auth.guard';
export { MastraRouteGuard } from './guards/mastra-route.guard';
export { MastraThrottleGuard } from './guards/mastra-throttle.guard';

// Filters (for custom usage)
export { MastraExceptionFilter } from './filters/mastra-exception.filter';

// Interceptors (for custom usage)
export { StreamingInterceptor } from './interceptors/streaming.interceptor';
export { RequestTrackingInterceptor } from './interceptors/request-tracking.interceptor';

// Services (for custom usage)
export {
  RouteHandlerService,
  ValidationError,
} from './services/route-handler.service';
export type {
  RouteHandlerParams,
  RouteHandlerResult,
  RouteMatch,
} from './services/route-handler.service';
export { RequestContextService } from './services/request-context.service';
export { ShutdownService } from './services/shutdown.service';
export { AuthService } from './services/auth.service';

// Controllers
export { MastraController } from './controllers/mastra.controller';

// Utilities
export { parseMultipartFormData } from './utils/parse-multipart';
export type { MultipartOptions } from './utils/parse-multipart';
export { getMastraRoutePath } from './utils/route-path';
export { getRequestPath, getHeaderValue } from './utils/request';

// Server adapter (for advanced usage)
export { NestMastraServer } from './mastra-server.adapter';

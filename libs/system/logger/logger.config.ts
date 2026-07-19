import { ClsServiceManager } from 'nestjs-cls';
import type { Params } from 'nestjs-pino';

import { ConfigService } from '@nestjs/config';

import type { AlsContext } from '../als/als.types';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  // better-auth's bearer plugin returns the live session token here on sign-in
  'res.headers["set-auth-token"]',
  '*.password',
  '*.token',
  '*.secret',
];

// enriches every log line (not just request logs) with request context from als.
// als is inactive outside an http request (e.g. worker), so this no-ops there.
function alsMixin(): Record<string, string> {
  const cls = ClsServiceManager.getClsService<AlsContext>();

  if (!cls.isActive()) {
    return {};
  }

  const requestId = cls.get('requestId');

  return requestId ? { requestId } : {};
}

// shared pino config for api/worker. pino writes json to stdout in prod, pretty in dev.
export function buildLoggerParams(config: ConfigService): Params {
  const appEnv = config.get<string>('APP_ENV');
  const level =
    config.get<string>('LOG_LEVEL') ??
    (appEnv === 'development' ? 'debug' : 'info');

  const transport =
    appEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined;

  return {
    pinoHttp: {
      level,
      base: { service: process.env.APP_NAME },
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      mixin: alsMixin,
      // skip root + health-probe noise from request auto-logs. ignore runs on the raw req
      // so it catches non-nest routes too.
      autoLogging: {
        ignore: (req) => {
          const url = (req.url ?? '').split('?')[0];

          return url === '/' || url.endsWith('/health');
        },
      },
      transport,
    },
  };
}

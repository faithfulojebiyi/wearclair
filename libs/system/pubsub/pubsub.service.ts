import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

// plain Redis (Valkey) pub/sub for live streaming across processes: the worker
// PUBLISHes events; the api SUBSCRIBEs per SSE connection and forwards to the
// browser. Fire-and-forget (no persistence, no Redis Streams) — publishing is
// best-effort so a Redis blip never breaks the work in progress.
@Injectable()
export class PubSubService implements OnModuleDestroy {
  private publisher?: Redis;
  private readonly subscribers = new Set<Redis>();
  private readonly url = process.env.APP_REDIS_URL;

  private pub(): Redis | null {
    if (!this.url) {
      return null;
    }

    if (!this.publisher) {
      this.publisher = new Redis(this.url, { maxRetriesPerRequest: null });
      this.publisher.on('error', () => undefined);
    }

    return this.publisher;
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    try {
      await this.pub()?.publish(channel, JSON.stringify(payload));
    } catch {
      // best-effort — never let streaming break the run
    }
  }

  // subscribe to a channel; returns an unsubscribe fn (call on SSE disconnect).
  // one dedicated connection per subscription keeps the lifecycle simple.
  async subscribe(
    channel: string,
    handler: (message: unknown) => void,
  ): Promise<() => Promise<void>> {
    if (!this.url) {
      return async () => undefined;
    }

    const sub = new Redis(this.url, { maxRetriesPerRequest: null });
    sub.on('error', () => undefined);
    sub.on('message', (_channel, message) => {
      try {
        handler(JSON.parse(message));
      } catch {
        // ignore malformed frames
      }
    });
    await sub.subscribe(channel);
    this.subscribers.add(sub);

    return async () => {
      this.subscribers.delete(sub);
      try {
        sub.disconnect();
      } catch {
        // ignore
      }
    };
  }

  onModuleDestroy(): void {
    for (const s of this.subscribers) {
      s.disconnect();
    }
    this.publisher?.disconnect();
  }
}

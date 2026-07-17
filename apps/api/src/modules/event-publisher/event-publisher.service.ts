import { Inngest } from 'inngest';

import { Injectable } from '@nestjs/common';

import { EventUserDto } from '@system/queues/dto/events.dto';
import { EVENTS } from '@system/queues/events.config';

// dev mode is opt-in via INNGEST_DEV=1 (local .env); unset in deployed envs so the
// SDK runs in cloud mode and syncs against Inngest cloud.
export const inngest = new Inngest({ id: 'api' });

type EventName = (typeof EVENTS)[keyof typeof EVENTS]['event'];

type EventByName<N extends EventName> = {
  [K in keyof typeof EVENTS]: (typeof EVENTS)[K] extends { event: N }
    ? (typeof EVENTS)[K]
    : never;
}[keyof typeof EVENTS];

type EventData<N extends EventName> =
  EventByName<N> extends {
    create(data: infer D, ...args: unknown[]): unknown;
  }
    ? D
    : never;

type SendData<N extends EventName> = Omit<EventData<N>, 'user'>;

interface SendEventArgs<N extends EventName> {
  id?: string;
  name: N;
  data: SendData<N>;
  user?: EventUserDto;
  ts?: number;
}

@Injectable()
export class EventPublisherService {
  async sendEvent<N extends EventName>({
    id,
    name,
    data,
    user,
    ts,
  }: SendEventArgs<N>) {
    return inngest.send({
      id,
      name,
      data: { ...data, user },
      ts,
    });
  }

  async sendEventBatch<N extends EventName>(batch: SendEventArgs<N>[]) {
    return inngest.send(
      batch.map(({ id, name, data, user }) => ({
        id,
        name,
        data: { ...data, user },
      })),
    );
  }
}

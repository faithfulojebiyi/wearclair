import { getSubscriptionToken } from 'inngest/realtime';

import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import {
  USER_CHANNEL_TOPICS,
  userChannel,
} from '@system/queues/realtime.config';

import { inngest } from '../../event-publisher/event-publisher.service';
import { RealtimeTokenDto } from '../dto/devices.dto';

export class GetRealtimeTokenQuery extends Query<RealtimeTokenDto> {
  constructor() {
    super();
  }
}

// mints a subscription token scoped to the caller's own realtime channel — the
// client uses it to hear "derivation finished" pushes from the worker instead of
// racing the background pipeline with an immediate refetch.
@QueryHandler(GetRealtimeTokenQuery)
export class GetRealtimeTokenQueryHandler implements IQueryHandler<GetRealtimeTokenQuery> {
  constructor(private readonly alsService: AlsService) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const resolvedChannel = userChannel({ userId });

    const token = await getSubscriptionToken(inngest, {
      channel: resolvedChannel,
      topics: [...USER_CHANNEL_TOPICS],
    });

    if (!token.key) {
      throw new ServiceUnavailableException('realtime token unavailable');
    }

    return {
      key: token.key,
      // resolveDefaultUrl always yields a value; the fallback is for the types
      apiBaseUrl: token.apiBaseUrl ?? 'https://api.inngest.com',
      channel: resolvedChannel.name,
      topics: [...USER_CHANNEL_TOPICS],
    };
  }
}

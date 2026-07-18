import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// RESEND_API_KEY is optional in dev — the client is built lazily so an
// unconfigured dev env still boots; sending without a key throws the clear
// config error. Outside dev the constructor builds eagerly, so a misconfigured
// deploy fails at startup.
@Injectable()
export class ResendService {
  private resend?: Resend;

  constructor(private readonly configService: ConfigService) {
    if (this.configService.get<string>('APP_ENV') !== 'development') {
      void this.client;
    }
  }

  private get client(): Resend {
    if (!this.resend) {
      const apiKey = this.configService.get<string>('RESEND_API_KEY');

      if (!apiKey) {
        throw new Error('RESEND_API_KEY env var is not set');
      }

      this.resend = new Resend(apiKey);
    }

    return this.resend;
  }

  async send(payload: CreateEmailOptions) {
    await this.client.emails.send(payload);
  }
}

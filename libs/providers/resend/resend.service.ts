import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResendService {
  private readonly RESEND_API_KEY: string;
  private readonly resend: Resend;

  constructor(private configService: ConfigService) {
    this.RESEND_API_KEY = this.configService.get<string>('RESEND_API_KEY')!;
    this.resend = new Resend(this.RESEND_API_KEY);
  }

  async send(payload: CreateEmailOptions) {
    await this.resend.emails.send(payload);
  }
}

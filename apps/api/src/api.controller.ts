import { Controller, Get } from '@nestjs/common';

import { Public } from '@system/auth/auth.decorators';

import { ApiService } from './api.service';

@Controller()
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.apiService.getHello();
  }
}

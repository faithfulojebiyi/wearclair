import { ClsService } from 'nestjs-cls';

import { Injectable } from '@nestjs/common';

import { AlsContext } from './als.types';

@Injectable()
export class AlsService {
  constructor(private readonly cls: ClsService<AlsContext>) {}

  get ctx(): ClsService<AlsContext> {
    return this.cls;
  }
}

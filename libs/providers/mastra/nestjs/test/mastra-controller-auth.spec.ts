import 'reflect-metadata';

import { describe, expect, it } from 'bun:test';

import { IS_PUBLIC_KEY } from '@system/auth/auth.decorators';

import { MastraController } from '../controllers/mastra.controller';

// /mastra/* must NOT opt out of the app's global SessionGuard — the controller
// used to be @Public(), which left agent routes (and LLM spend) unauthenticated.
describe('MastraController auth surface', () => {
  it('is not marked @Public — the global SessionGuard applies', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, MastraController) as
      boolean | undefined;

    expect(isPublic).toBeUndefined();
  });

  it('is excluded from the OpenAPI document', () => {
    const excluded = Reflect.getMetadata(
      'swagger/apiExcludeController',
      MastraController,
    ) as [boolean] | undefined;

    expect(excluded?.[0]).toBe(true);
  });
});

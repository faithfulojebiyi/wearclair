import { describe, it, expect } from 'bun:test';
import type { Mastra } from '@mastra/core/mastra';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import { MastraController } from '../controllers/mastra.controller';
import { MastraModule, type MastraModuleOptions } from '../mastra.module';
import { MastraService } from '../mastra.service';

interface InspectableProvider {
  provide?: unknown;
  useValue?: unknown;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: unknown[];
}

const fakeMastra = { name: 'm' } as unknown as Mastra;

function providerFor(
  providers: unknown[] | undefined,
  token: unknown,
): InspectableProvider {
  const found = (providers as InspectableProvider[]).find(
    (p) => p && typeof p === 'object' && p.provide === token,
  );
  if (!found) throw new Error('provider not found');
  return found;
}

describe('MastraModule.register', () => {
  it('wires the controller, exports, and the Mastra instance', () => {
    const mod = MastraModule.register({ mastra: fakeMastra });
    expect(mod.controllers).toContain(MastraController);
    expect(mod.exports).toEqual(
      expect.arrayContaining([MASTRA, MastraService]),
    );
    expect(providerFor(mod.providers, MASTRA).useValue).toBe(fakeMastra);
  });

  it('defaults the prefix to /mastra', () => {
    const mod = MastraModule.register({ mastra: fakeMastra });
    const opts = providerFor(mod.providers, MASTRA_OPTIONS)
      .useValue as MastraModuleOptions;
    expect(opts.prefix).toBe('/mastra');
  });

  it('keeps an explicitly provided prefix', () => {
    const mod = MastraModule.register({
      mastra: fakeMastra,
      prefix: '/api/mastra',
    });
    const opts = providerFor(mod.providers, MASTRA_OPTIONS)
      .useValue as MastraModuleOptions;
    expect(opts.prefix).toBe('/api/mastra');
  });
});

describe('MastraModule.registerAsync', () => {
  it('throws when no provider strategy is supplied', () => {
    expect(() => MastraModule.registerAsync({})).toThrow();
  });

  it('resolves options via useFactory and merges the default prefix', async () => {
    const mod = MastraModule.registerAsync({
      useFactory: () => ({ mastra: fakeMastra }),
    });
    const optionsProvider = providerFor(mod.providers, MASTRA_OPTIONS);
    const resolved =
      (await optionsProvider.useFactory!()) as MastraModuleOptions;
    expect(resolved.prefix).toBe('/mastra');
    expect(resolved.mastra).toBe(fakeMastra);
  });

  it('extracts the Mastra instance from the resolved options', async () => {
    const mod = MastraModule.registerAsync({
      useFactory: () => ({ mastra: fakeMastra }),
    });
    const mastraProvider = providerFor(mod.providers, MASTRA);
    const opts = { mastra: fakeMastra } as MastraModuleOptions;
    expect(mastraProvider.useFactory!(opts)).toBe(fakeMastra);
  });

  it('the Mastra factory throws when the instance is missing', async () => {
    const mod = MastraModule.registerAsync({
      useFactory: () => ({ mastra: fakeMastra }),
    });
    const mastraProvider = providerFor(mod.providers, MASTRA);
    expect(() => mastraProvider.useFactory!({})).toThrow();
  });
});

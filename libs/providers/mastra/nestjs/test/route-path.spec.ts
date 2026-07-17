import { describe, it, expect } from 'bun:test';
import { getMastraRoutePath } from '../utils/route-path';

describe('getMastraRoutePath', () => {
  it('strips a leading-slash prefix and keeps the remainder', () => {
    expect(getMastraRoutePath('/mastra/agents', '/mastra')).toBe('/agents');
  });

  it('normalizes a prefix that is missing its leading slash', () => {
    expect(getMastraRoutePath('/mastra/agents', 'mastra')).toBe('/agents');
  });

  it('normalizes a prefix that has a trailing slash', () => {
    expect(getMastraRoutePath('/mastra/agents', '/mastra/')).toBe('/agents');
  });

  it('returns "/" when the path equals the prefix exactly', () => {
    expect(getMastraRoutePath('/mastra', '/mastra')).toBe('/');
  });

  it('returns null when the path does not start with the prefix', () => {
    expect(getMastraRoutePath('/other/agents', '/mastra')).toBeNull();
  });

  it('does not treat a prefix as matching a longer sibling segment', () => {
    // "/mastra-other" must not be considered under the "/mastra" prefix.
    expect(getMastraRoutePath('/mastra-other', '/mastra')).toBeNull();
  });

  it('returns the path unchanged when no prefix is configured', () => {
    expect(getMastraRoutePath('/agents')).toBe('/agents');
    expect(getMastraRoutePath('/agents', '')).toBe('/agents');
  });

  it('returns "/" for the root path with no prefix', () => {
    expect(getMastraRoutePath('/')).toBe('/');
  });
});

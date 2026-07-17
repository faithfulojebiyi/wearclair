import { describe, it, expect } from 'bun:test';
import { formatBytes } from '../utils/format';
import { getHeaderValue, getRequestPath } from '../utils/request';
import { fakeRequest } from './test-helpers';

describe('getRequestPath', () => {
  it('returns the path without the query string', () => {
    expect(getRequestPath(fakeRequest({ url: '/mastra/agents?foo=1' }))).toBe(
      '/mastra/agents',
    );
  });

  it('returns the whole url when there is no query string', () => {
    expect(getRequestPath(fakeRequest({ url: '/mastra/agents' }))).toBe(
      '/mastra/agents',
    );
  });

  it('defaults to "/" when url is empty', () => {
    expect(getRequestPath(fakeRequest({ url: '' }))).toBe('/');
  });
});

describe('getHeaderValue', () => {
  it('reads a header case-insensitively', () => {
    const req = fakeRequest({
      headers: { 'content-type': 'application/json' },
    });
    expect(getHeaderValue(req, 'Content-Type')).toBe('application/json');
  });

  it('collapses an array-valued header to its first entry', () => {
    const req = fakeRequest({ headers: { 'x-multi': ['a', 'b'] } });
    expect(getHeaderValue(req, 'x-multi')).toBe('a');
  });

  it('returns undefined for a missing header', () => {
    expect(getHeaderValue(fakeRequest(), 'x-absent')).toBeUndefined();
  });
});

describe('formatBytes', () => {
  it('formats raw bytes', () => {
    expect(formatBytes(512)).toBe('512 bytes');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

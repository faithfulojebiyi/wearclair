import type { FastifyRequest } from 'fastify';

/**
 * Fastify-flavored request helpers.
 *
 * The upstream Express adapter relies on Express-only conveniences (`req.path`,
 * `req.get()`, `req.originalUrl`). FastifyRequest has none of these, so these
 * helpers provide the equivalents the adapter needs.
 */

/**
 * Get the path portion of the request URL (without the query string).
 * Equivalent to Express's `req.path`.
 */
export function getRequestPath(request: FastifyRequest): string {
  const url = request.url || '/';
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

/**
 * Read a single header value (collapsing array-valued headers to the first
 * entry). Equivalent to Express's `req.get(name)`.
 */
export function getHeaderValue(
  request: FastifyRequest,
  name: string,
): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

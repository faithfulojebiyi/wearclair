import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { formatBytes } from './format';

export interface MultipartOptions {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed MIME types for file uploads */
  allowedMimeTypes?: string[];
}

/**
 * Minimal structural shapes for the parts emitted by `@fastify/multipart`'s
 * async `request.parts()` iterator. We type them locally to avoid leaking the
 * plugin's types across the adapter surface.
 */
interface MultipartFilePart {
  type: 'file';
  fieldname: string;
  filename: string;
  mimetype: string;
  file: NodeJS.ReadableStream & { truncated: boolean };
  toBuffer: () => Promise<Buffer>;
}

interface MultipartFieldPart {
  type: 'field';
  fieldname: string;
  value: string;
}

type MultipartPart = MultipartFilePart | MultipartFieldPart;

/**
 * `@fastify/multipart` augments FastifyRequest with `parts`, but its return type
 * is the plugin's own `Multipart` union. We cast through `unknown` to our local
 * structural shape rather than extending FastifyRequest (which would clash with
 * the augmentation).
 */
type PartsFn = (options?: {
  limits?: { fileSize?: number };
}) => AsyncIterableIterator<MultipartPart>;

/**
 * Parse multipart/form-data using `@fastify/multipart` (registered globally in
 * `apps/api/src/main.ts`). Converts file uploads to Buffers and parses JSON
 * field values.
 *
 * This is the Fastify-native equivalent of the upstream Express adapter's
 * Busboy-based `parseMultipartFormData()`: same return shape
 * (`Record<fieldname, Buffer | parsedJSON>`), platform-appropriate parser. We
 * use the plugin's `request.parts()` iterator rather than piping `request.raw`
 * into Busboy, because the registered multipart content-type parser already
 * owns the request stream.
 *
 * @param request - The Fastify request object
 * @param options - Multipart parsing options
 */
export async function parseMultipartFormData(
  request: FastifyRequest,
  options: MultipartOptions = {},
): Promise<Record<string, unknown>> {
  const req = request as unknown as { parts?: PartsFn };

  if (typeof req.parts !== 'function') {
    throw new BadRequestException(
      'Multipart parsing is not enabled. Register @fastify/multipart on the Fastify app.',
    );
  }

  const contentType = request.headers['content-type'];
  if (!contentType) {
    throw new BadRequestException(
      'Content-Type header is required for multipart requests',
    );
  }

  const result: Record<string, unknown> = {};
  const parts = req.parts(
    options.maxFileSize
      ? { limits: { fileSize: options.maxFileSize } }
      : undefined,
  );

  try {
    for await (const part of parts) {
      if (part.type === 'file') {
        // Validate MIME type if allowedMimeTypes is specified
        if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
          if (!options.allowedMimeTypes.includes(part.mimetype)) {
            part.file.resume(); // Drain the stream
            throw new BadRequestException(
              `Invalid file type: ${part.mimetype}. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
            );
          }
        }

        const buffer = await part.toBuffer();

        // `@fastify/multipart` flags the stream as truncated when the size
        // limit is hit instead of throwing, so check after buffering.
        if (part.file.truncated) {
          const maxSize = options.maxFileSize;
          throw new PayloadTooLargeException(
            `File size limit exceeded${maxSize ? ` (max: ${formatBytes(maxSize)})` : ''}`,
          );
        }

        result[part.fieldname] = buffer;
      } else {
        // Try to parse JSON strings (like 'options')
        try {
          result[part.fieldname] = JSON.parse(part.value);
        } catch {
          result[part.fieldname] = part.value;
        }
      }
    }
  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof PayloadTooLargeException
    ) {
      throw error;
    }
    throw new BadRequestException(
      `Failed to parse multipart form data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

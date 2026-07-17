import { describe, it, expect } from 'bun:test';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { parseMultipartFormData } from '../utils/parse-multipart';

interface FilePart {
  type: 'file';
  fieldname: string;
  filename: string;
  mimetype: string;
  file: { truncated: boolean; resume: () => void };
  toBuffer: () => Promise<Buffer>;
}
interface FieldPart {
  type: 'field';
  fieldname: string;
  value: string;
}
type Part = FilePart | FieldPart;

function multipartRequest(
  parts: Part[],
  { contentType = 'multipart/form-data; boundary=x', withParts = true } = {},
): FastifyRequest {
  async function* gen(): AsyncIterableIterator<Part> {
    for (const p of parts) yield p;
  }
  const req: Record<string, unknown> = {
    headers: contentType ? { 'content-type': contentType } : {},
  };
  if (withParts) req.parts = () => gen();
  return req as unknown as FastifyRequest;
}

function filePart(over: Partial<FilePart> = {}): FilePart {
  return {
    type: 'file',
    fieldname: 'file',
    filename: 'a.txt',
    mimetype: 'text/plain',
    file: { truncated: false, resume: () => undefined },
    toBuffer: () => Promise.resolve(Buffer.from('hello')),
    ...over,
  };
}

describe('parseMultipartFormData', () => {
  it('parses JSON field values and leaves plain strings alone', async () => {
    const result = await parseMultipartFormData(
      multipartRequest([
        { type: 'field', fieldname: 'options', value: '{"a":1}' },
        { type: 'field', fieldname: 'note', value: 'plain text' },
      ]),
    );
    expect(result.options).toEqual({ a: 1 });
    expect(result.note).toBe('plain text');
  });

  it('converts a file part to a Buffer keyed by fieldname', async () => {
    const result = await parseMultipartFormData(
      multipartRequest([filePart({ fieldname: 'upload' })]),
    );
    expect(Buffer.isBuffer(result.upload)).toBe(true);
    expect((result.upload as Buffer).toString()).toBe('hello');
  });

  it('throws BadRequest when multipart is not enabled', async () => {
    await expect(
      parseMultipartFormData(multipartRequest([], { withParts: false })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequest when the content-type header is missing', async () => {
    await expect(
      parseMultipartFormData(multipartRequest([], { contentType: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects files whose mime type is not allowlisted', async () => {
    await expect(
      parseMultipartFormData(
        multipartRequest([filePart({ mimetype: 'application/x-msdownload' })]),
        { allowedMimeTypes: ['image/png'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws PayloadTooLarge when a file is truncated by the size limit', async () => {
    await expect(
      parseMultipartFormData(
        multipartRequest([
          filePart({
            file: { truncated: true, resume: () => undefined },
          }),
        ]),
        { maxFileSize: 1024 },
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
});

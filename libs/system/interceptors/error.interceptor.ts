import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

interface PrismaLikeError extends Error {
  code?: string;
  meta?: { cause?: string };
}

// prisma errors are matched by name (not instanceof) so the filter doesn't
// depend on the generated client
function asPrismaError(exception: unknown): PrismaLikeError | null {
  if (
    exception instanceof Error &&
    (exception.name === 'PrismaClientKnownRequestError' ||
      exception.name === 'PrismaClientValidationError')
  ) {
    return exception;
  }

  return null;
}

function extractMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const message = (response as { message?: unknown }).message;

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message)) {
        return message.join(', ');
      }
    }

    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return 'Internal server error';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();
    const isDev = process.env.APP_ENV === 'development';

    // echo the request id (set from x-request-id) so clients can reference a failed call
    const requestId = ctx.getRequest<{ id?: string }>().id;
    const reply = ctx.getResponse<{
      header?: (key: string, value: string) => void;
    }>();

    if (requestId && typeof reply.header === 'function') {
      reply.header('x-request-id', requestId);
    }

    // single structured log — the request id ties the sanitized response to the
    // full error detail here
    this.logger.error({ requestId, err: exception });

    const path = httpAdapter.getRequestUrl(ctx.getRequest()) as
      string | undefined;

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      const errors = zodError.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      const responseBody = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors,
        timestamp: new Date().toISOString(),
        path,
      };

      httpAdapter.reply(
        ctx.getResponse(),
        responseBody,
        HttpStatus.BAD_REQUEST,
      );
      return;
    }

    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError() as ZodError;

      // issue detail describes our internal response shape — dev only
      const errors = isDev
        ? zodError.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          }))
        : undefined;

      const responseBody = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Response serialization failed',
        ...(errors ? { errors } : {}),
        timestamp: new Date().toISOString(),
        path,
      };

      httpAdapter.reply(
        ctx.getResponse(),
        responseBody,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      return;
    }

    const prismaError = asPrismaError(exception);

    if (prismaError) {
      // db cause + prisma error code are internals — dev only
      const responseBody = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: isDev
          ? prismaError.meta?.cause || prismaError.message
          : 'Database request failed',
        timestamp: new Date().toISOString(),
        path,
        ...(isDev && prismaError.code ? { code: prismaError.code } : {}),
      };

      httpAdapter.reply(
        ctx.getResponse(),
        responseBody,
        HttpStatus.BAD_REQUEST,
      );
      return;
    }

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 4xx messages are intentional (Nest exceptions thrown by handlers); 5xx
    // messages outside dev are generic — internals stay in the log
    const message =
      httpStatus >= 500 && !isDev
        ? 'Internal server error'
        : extractMessage(exception);

    const responseBody = {
      statusCode: httpStatus,
      message,
      timestamp: new Date().toISOString(),
      path,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

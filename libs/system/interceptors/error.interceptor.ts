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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    // echo the request id (set from x-request-id) so clients can reference a failed call
    const requestId = ctx.getRequest<{ id?: string }>().id;
    const reply = ctx.getResponse<{
      header?: (key: string, value: string) => void;
    }>();

    if (requestId && typeof reply.header === 'function') {
      reply.header('x-request-id', requestId);
    }

    this.logger.error(exception);

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
        path: httpAdapter.getRequestUrl(ctx.getRequest()),
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
      const errors = zodError.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      const responseBody = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Response serialization failed',
        errors,
        timestamp: new Date().toISOString(),
        path: httpAdapter.getRequestUrl(ctx.getRequest()),
      };

      this.logger.error(`ZodSerializationException: ${zodError.message}`);
      httpAdapter.reply(
        ctx.getResponse(),
        responseBody,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      return;
    }

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      exception.name === 'PrismaClientKnownRequestError' ||
      exception.name === 'PrismaClientValidationError'
    ) {
      const responseBody = {
        statusCode: 400,
        message: exception.meta?.cause || 'Error occurred',
        timestamp: new Date().toISOString(),
        path: httpAdapter.getRequestUrl(ctx.getRequest()),
        code: exception.code,
      };

      httpAdapter.reply(ctx.getResponse(), responseBody, 400);
      return;
    }

    const responseBody = {
      statusCode: httpStatus,
      message: exception.response?.message || exception.message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    if (process.env.APP_ENV !== 'development' && httpStatus >= 500) {
      this.logger.error(exception);
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

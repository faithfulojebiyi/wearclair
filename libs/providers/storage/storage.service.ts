import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { s3, type S3Config } from '@storagesdk/adapters/s3';
import { Storage } from '@storagesdk/core';

// default presigned-URL lifetime (seconds).
export const STORAGE_URL_EXPIRES_IN = 3600;

function buildS3Config(config: ConfigService): S3Config {
  const bucket = config.get<string>('S3_BUCKET');

  if (!bucket) {
    throw new Error('S3_BUCKET env var is not set');
  }

  const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
  const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
  const endpoint = config.get<string>('S3_ENDPOINT');

  return {
    bucket,
    region: config.get<string>('AWS_REGION') ?? 'us-east-1',
    // omit to fall back to the AWS default credential chain when not set.
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    // set for S3-compatible backends: Tigris, Cloudflare R2, MinIO, Spaces.
    ...(endpoint ? { endpoint } : {}),
    ...(config.get<string>('S3_FORCE_PATH_STYLE') === 'true'
      ? { forcePathStyle: true }
      : {}),
  };
}

// storage via StorageSDK — one env-driven, S3-compatible adapter covers AWS S3,
// Tigris, Cloudflare R2, and MinIO. Use `client` for the SDK API (upload /
// download / head / url / uploadUrl / delete). Native Tigris snapshots + forks
// (the agent-run sandbox) come later via the `tigris` adapter.
//
// S3_BUCKET is optional in dev — the client is built lazily so an unconfigured
// dev env still boots; first use throws the clear config error. Outside dev the
// constructor builds eagerly, so a misconfigured deploy fails at startup.
@Injectable()
export class StorageService {
  private storage?: Storage;

  constructor(private readonly configService: ConfigService) {
    if (this.configService.get<string>('APP_ENV') !== 'development') {
      void this.client;
    }
  }

  get client(): Storage {
    this.storage ??= new Storage({
      adapter: s3(buildS3Config(this.configService)),
    });

    return this.storage;
  }
}

import { InngestFunction } from 'inngest';

import { ApiService } from '@api/api.service';

import { failedEvents } from './failed-events.function';
import { hello } from './hello.function';

export const getInngestRegistry = ({
  apiService,
}: {
  apiService: ApiService;
}): InngestFunction.Any[] => {
  return [hello({ apiService }), failedEvents()];
};

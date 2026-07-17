import { CommandBus, QueryBus } from '@nestjs/cqrs';

// the DI-resolved buses handed to Inngest queue consumers (see main.ts). Consumers
// stay thin — they dispatch CQRS commands/queries; the handlers hold the logic.
export interface InngestFunctionDto {
  commandBus: CommandBus;
  queryBus: QueryBus;
}

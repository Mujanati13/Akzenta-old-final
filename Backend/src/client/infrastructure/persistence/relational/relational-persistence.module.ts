import { Module } from '@nestjs/common';
import { ClientRepository } from '../client.repository';
import { ClientRelationalRepository } from './repositories/client.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientEntity } from './entities/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity])],
  providers: [
    {
      provide: ClientRepository,
      useClass: ClientRelationalRepository,
    },
  ],
  exports: [ClientRepository],
})
export class RelationalClientPersistenceModule {}

import { Module } from '@nestjs/common';
import { AkzenteFavoriteClientRepository } from '../akzente-favorite-client.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AkzenteFavoriteClientEntity } from './entities/akzente-favorite-client.entity';
import { AkzenteFavoriteClientRelationalRepository } from './repositories/akzente-favorite-client.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AkzenteFavoriteClientEntity])],
  providers: [
    {
      provide: AkzenteFavoriteClientRepository,
      useClass: AkzenteFavoriteClientRelationalRepository,
    },
  ],
  exports: [AkzenteFavoriteClientRepository],
})
export class RelationalAkzenteFavoriteClientPersistenceModule {}

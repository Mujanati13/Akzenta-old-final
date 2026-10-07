import { Module } from '@nestjs/common';
import { AkzenteRepository } from '../akzente.repository';
import { AkzenteRelationalRepository } from './repositories/akzente.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AkzenteEntity } from './entities/akzente.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AkzenteEntity])],
  providers: [
    {
      provide: AkzenteRepository,
      useClass: AkzenteRelationalRepository,
    },
  ],
  exports: [AkzenteRepository],
})
export class RelationalAkzentePersistenceModule {}

import { Module } from '@nestjs/common';
import { AkzenteFavoriteProjectRepository } from '../akzente-favorite-project.repository';
import { AkzenteFavoriteProjectRelationalRepository } from './repositories/akzente-favorite-project.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AkzenteFavoriteProjectEntity } from './entities/akzente-favorite-project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AkzenteFavoriteProjectEntity])],
  providers: [
    {
      provide: AkzenteFavoriteProjectRepository,
      useClass: AkzenteFavoriteProjectRelationalRepository,
    },
  ],
  exports: [AkzenteFavoriteProjectRepository],
})
export class RelationalAkzenteFavoriteProjectPersistenceModule {}

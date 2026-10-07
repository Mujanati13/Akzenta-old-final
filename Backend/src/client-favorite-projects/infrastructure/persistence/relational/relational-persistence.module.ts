import { Module } from '@nestjs/common';
import { ClientFavoriteProjectRepository } from '../client-favorite-project.repository';
import { ClientFavoriteProjectRelationalRepository } from './repositories/client-favorite-project.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientFavoriteProjectEntity } from './entities/client-favorite-project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClientFavoriteProjectEntity])],
  providers: [
    {
      provide: ClientFavoriteProjectRepository,
      useClass: ClientFavoriteProjectRelationalRepository,
    },
  ],
  exports: [ClientFavoriteProjectRepository],
})
export class RelationalClientFavoriteProjectPersistenceModule {}

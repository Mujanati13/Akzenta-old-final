import { Module, forwardRef } from '@nestjs/common';
import { MerchandiserFavoriteProjectService } from './merchandiser-favorite-projects.service';
import { MerchandiserFavoriteProjectController } from './merchandiser-favorite-projects.controller';
import { MerchandiserFavoriteProjectRepository } from './infrastructure/persistence/merchandiser-favorite-project.repository';
import { MerchandiserFavoriteProjectRelationalRepository } from './infrastructure/persistence/relational/repositories/merchandiser-favorite-project.repository';
import { MerchandiserFavoriteProjectEntity } from './infrastructure/persistence/relational/entities/merchandiser-favorite-project.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchandiserModule } from '../merchandiser/merchandiser.module';
import { ProjectModule } from '../project/project.module';

const infrastructurePersistenceModule = TypeOrmModule.forFeature([MerchandiserFavoriteProjectEntity]);

@Module({
  imports: [infrastructurePersistenceModule, forwardRef(() => MerchandiserModule), forwardRef(() => ProjectModule)],
  controllers: [MerchandiserFavoriteProjectController],
  providers: [
    {
      provide: MerchandiserFavoriteProjectRepository,
      useClass: MerchandiserFavoriteProjectRelationalRepository,
    },
    MerchandiserFavoriteProjectService,
  ],
  exports: [MerchandiserFavoriteProjectService, MerchandiserFavoriteProjectRepository],
})
export class MerchandiserFavoriteProjectModule {}

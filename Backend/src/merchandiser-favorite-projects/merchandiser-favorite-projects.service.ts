import {
  // common
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateMerchandiserFavoriteProjectDto } from './dto/create-merchandiser-favorite-project.dto';
import { UpdateMerchandiserFavoriteProjectDto } from './dto/update-merchandiser-favorite-project.dto';
import { MerchandiserFavoriteProjectRepository } from './infrastructure/persistence/merchandiser-favorite-project.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserFavoriteProject } from './domain/merchandiser-favorite-project';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class MerchandiserFavoriteProjectService {
  constructor(
    // Dependencies here
    private readonly merchandiserFavoriteProjectRepository: MerchandiserFavoriteProjectRepository,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
  ) {}

  async create(
    createMerchandiserFavoriteProjectDto: CreateMerchandiserFavoriteProjectDto,
  ) {
    // Lookup by merchandiser ENTITY ID (not user ID)
    const merchandiser = await this.merchandiserService.findById(
      createMerchandiserFavoriteProjectDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    const project = await this.projectService.findById(
      createMerchandiserFavoriteProjectDto.project.id,
    );
    if (!project) {
      throw new Error('Project not found');
    }

    return this.merchandiserFavoriteProjectRepository.create({
      merchandiser,
      project,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserFavoriteProjectRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserFavoriteProject['id']) {
    return this.merchandiserFavoriteProjectRepository.findById(id);
  }

  findByIds(ids: MerchandiserFavoriteProject['id'][]) {
    return this.merchandiserFavoriteProjectRepository.findByIds(ids);
  }

  findOne(options: { merchandiserId: number; projectId: number }) {
    return this.merchandiserFavoriteProjectRepository.findOne(options);
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteProject[]> {
    return this.merchandiserFavoriteProjectRepository.findByMerchandiserId(merchandiserId);
  }

  async update(
    id: MerchandiserFavoriteProject['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateMerchandiserFavoriteProjectDto: UpdateMerchandiserFavoriteProjectDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.merchandiserFavoriteProjectRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: MerchandiserFavoriteProject['id']) {
    return this.merchandiserFavoriteProjectRepository.remove(id);
  }
}

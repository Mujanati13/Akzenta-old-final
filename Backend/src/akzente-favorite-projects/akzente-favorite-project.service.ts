import {
  // common
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateAkzenteFavoriteProjectDto } from './dto/create-akzente-favorite-project.dto';
import { UpdateAkzenteFavoriteProjectDto } from './dto/update-akzente-favorite-project.dto';
import { AkzenteFavoriteProjectRepository } from './infrastructure/persistence/akzente-favorite-project.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AkzenteFavoriteProject } from './domain/akzente-favorite-project';
import { AkzenteService } from '../akzente/akzente.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class AkzenteFavoriteProjectService {
  constructor(
    // Dependencies here
    private readonly akzenteFavoriteProjectRepository: AkzenteFavoriteProjectRepository,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
  ) {}

  async create(
    createAkzenteFavoriteProjectDto: CreateAkzenteFavoriteProjectDto,
  ) {
    // Find Akzente by user ID instead of Akzente ID
    const akzente = await this.akzenteService.findByUserId(
      createAkzenteFavoriteProjectDto.akzente.id,
    );
    if (!akzente) {
      throw new Error('Akzente not found');
    }

    const project = await this.projectService.findById(
      createAkzenteFavoriteProjectDto.project.id,
    );
    if (!project) {
      throw new Error('Report not found');
    }

    return this.akzenteFavoriteProjectRepository.create({
      akzente,
      project,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.akzenteFavoriteProjectRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: AkzenteFavoriteProject['id']) {
    return this.akzenteFavoriteProjectRepository.findById(id);
  }

  findByIds(ids: AkzenteFavoriteProject['id'][]) {
    return this.akzenteFavoriteProjectRepository.findByIds(ids);
  }

  findOne(options: { akzenteId: number; projectId: number }) {
    return this.akzenteFavoriteProjectRepository.findOne(options);
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteProject[]> {
    return this.akzenteFavoriteProjectRepository.findByAkzenteId(akzenteId);
  }

  async update(
    id: AkzenteFavoriteProject['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateAkzenteFavoriteProjectDto: UpdateAkzenteFavoriteProjectDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.akzenteFavoriteProjectRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: AkzenteFavoriteProject['id']) {
    return this.akzenteFavoriteProjectRepository.remove(id);
  }
}

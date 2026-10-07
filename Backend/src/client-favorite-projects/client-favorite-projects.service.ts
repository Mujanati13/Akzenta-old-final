import {
  // common
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateClientFavoriteProjectDto } from './dto/create-client-favorite-project.dto';
import { UpdateClientFavoriteProjectDto } from './dto/update-client-favorite-project.dto';
import { ClientFavoriteProjectRepository } from './infrastructure/persistence/client-favorite-project.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ClientFavoriteProject } from './domain/client-favorite-project';
import { ClientService } from '../client/client.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class ClientFavoriteProjectService {
  constructor(
    // Dependencies here
    private readonly clientFavoriteProjectRepository: ClientFavoriteProjectRepository,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
  ) {}

  async create(
    createClientFavoriteProjectDto: CreateClientFavoriteProjectDto,
  ) {
    // Find Akzente by user ID instead of Akzente ID
    const client = await this.clientService.findByUserId(
      createClientFavoriteProjectDto.client.id,
    );
    if (!client) {
      throw new Error('Client not found');
    }

    const project = await this.projectService.findById(
      createClientFavoriteProjectDto.project.id,
    );
    if (!project) {
      throw new Error('Report not found');
    }

    return this.clientFavoriteProjectRepository.create({
      client,
      project,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.clientFavoriteProjectRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: ClientFavoriteProject['id']) {
    return this.clientFavoriteProjectRepository.findById(id);
  }

  findByIds(ids: ClientFavoriteProject['id'][]) {
    return this.clientFavoriteProjectRepository.findByIds(ids);
  }

  findOne(options: { clientId: number; projectId: number }) {
    return this.clientFavoriteProjectRepository.findOne(options);
  }

  async findByClientId(clientId: number): Promise<ClientFavoriteProject[]> {
    return this.clientFavoriteProjectRepository.findByClientId(clientId);
  }

  async update(
    id: ClientFavoriteProject['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateClientFavoriteProjectDto: UpdateClientFavoriteProjectDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.clientFavoriteProjectRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: ClientFavoriteProject['id']) {
    return this.clientFavoriteProjectRepository.remove(id);
  }
}

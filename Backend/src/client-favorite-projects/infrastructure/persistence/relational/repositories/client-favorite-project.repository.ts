import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientFavoriteProjectEntity } from '../entities/client-favorite-project.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ClientFavoriteProject } from '../../../../domain/client-favorite-project';
import { ClientFavoriteProjectMapper } from '../mappers/client-favorite-project.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { ClientFavoriteProjectRepository } from '../../client-favorite-project.repository';

@Injectable()
export class ClientFavoriteProjectRelationalRepository
  implements ClientFavoriteProjectRepository
{
  constructor(
    @InjectRepository(ClientFavoriteProjectEntity)
    private readonly clientFavoriteProjectRepository: Repository<ClientFavoriteProjectEntity>,
  ) {}

  async create(data: ClientFavoriteProject): Promise<ClientFavoriteProject> {
    const persistenceModel = ClientFavoriteProjectMapper.toPersistence(data);
    const newEntity = await this.clientFavoriteProjectRepository.save(
      this.clientFavoriteProjectRepository.create(persistenceModel),
    );
    return ClientFavoriteProjectMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<ClientFavoriteProject[]> {
    const entities = await this.clientFavoriteProjectRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => ClientFavoriteProjectMapper.toDomain(entity));
  }

  async findById(
    id: ClientFavoriteProject['id'],
  ): Promise<NullableType<ClientFavoriteProject>> {
    const entity = await this.clientFavoriteProjectRepository.findOne({
      where: { id },
    });

    return entity ? ClientFavoriteProjectMapper.toDomain(entity) : null;
  }

  async findByIds(ids: ClientFavoriteProject['id'][]): Promise<ClientFavoriteProject[]> {
    const entities = await this.clientFavoriteProjectRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => ClientFavoriteProjectMapper.toDomain(entity));
  }

  findOne(options: { clientId: number; projectId: number }): Promise<NullableType<ClientFavoriteProject>> {
    return this.clientFavoriteProjectRepository.findOne({
      where: {
        client: { id: options.clientId },
        project: { id: options.projectId },
      },
      relations: ['client', 'project'],
    }).then(entity => entity ? ClientFavoriteProjectMapper.toDomain(entity) : null);
  }

  async findByClientId(clientId: number): Promise<ClientFavoriteProject[]> {
    const entities = await this.clientFavoriteProjectRepository.find({
      where: { client: { id: clientId } },
      relations: ['client', 'project'],
    });

    return entities.map((entity) => ClientFavoriteProjectMapper.toDomain(entity));
  }

  async update(
    id: ClientFavoriteProject['id'],
    payload: Partial<ClientFavoriteProject>,
  ): Promise<ClientFavoriteProject> {
    const entity = await this.clientFavoriteProjectRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.clientFavoriteProjectRepository.save(
      this.clientFavoriteProjectRepository.create(
        ClientFavoriteProjectMapper.toPersistence({
          ...ClientFavoriteProjectMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ClientFavoriteProjectMapper.toDomain(updatedEntity);
  }

  async remove(id: ClientFavoriteProject['id']): Promise<void> {
    await this.clientFavoriteProjectRepository.delete(id);
  }
}

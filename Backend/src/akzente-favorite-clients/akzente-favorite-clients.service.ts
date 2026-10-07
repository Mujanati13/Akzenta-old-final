import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateAkzenteFavoriteClientDto } from './dto/create-akzente-favorite-client.dto';
import { UpdateAkzenteFavoriteClientDto } from './dto/update-akzente-favorite-client.dto';
import { AkzenteFavoriteClientRepository } from './infrastructure/persistence/akzente-favorite-client.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AkzenteFavoriteClient } from './domain/akzente-favorite-client';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientService } from '../client/client.service';

@Injectable()
export class AkzenteFavoriteClientsService {
  constructor(
    private readonly akzenteFavoriteClientRepository: AkzenteFavoriteClientRepository,
    private readonly akzenteService: AkzenteService,
    private readonly clientService: ClientService,
  ) {}

  async create(
    createFavoriteClientDto: CreateAkzenteFavoriteClientDto,
  ) {
    const akzente = await this.akzenteService.findById(
      createFavoriteClientDto.akzente.id,
    );
    if (!akzente) {
      throw new Error('Akzente not found');
    }

    const client = await this.clientService.findById(
      createFavoriteClientDto.client.id,
    );
    if (!client) {
      throw new Error('Client company not found');
    }

    return this.akzenteFavoriteClientRepository.create({
      akzente,
      client,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.akzenteFavoriteClientRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: AkzenteFavoriteClient['id']) {
    return this.akzenteFavoriteClientRepository.findById(id);
  }

  findByIds(ids: AkzenteFavoriteClient['id'][]) {
    return this.akzenteFavoriteClientRepository.findByIds(ids);
  }

  async update(
    id: AkzenteFavoriteClient['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateFavoriteClientDto: UpdateAkzenteFavoriteClientDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.akzenteFavoriteClientRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: AkzenteFavoriteClient['id']) {
    return this.akzenteFavoriteClientRepository.remove(id);
  }
}

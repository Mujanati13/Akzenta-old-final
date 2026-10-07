import { Injectable } from '@nestjs/common';
import { CreateClientCompanyAssignedAkzenteDto } from './dto/create-client-company-assigned-akzente.dto';
import { UpdateClientCompanyAssignedAkzenteDto } from './dto/update-client-company-assigned-akzente.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ClientCompanyAssignedAkzente } from './domain/client-company-assigned-akzente';
import { ClientCompany } from '../client-company/domain/client-company';
import { ClientCompanyAssignedAkzenteRepository } from './infrastructure/persistence/client-company-assigned-akzente.repository';
import { Akzente } from '../akzente/domain/akzente';

@Injectable()
export class ClientCompanyAssignedAkzenteService {
  constructor(
    private readonly clientCompanyAssignedAkzenteRepository: ClientCompanyAssignedAkzenteRepository,
  ) {}

  async create(createClientCompanyAssignedAkzenteDto: CreateClientCompanyAssignedAkzenteDto): Promise<ClientCompanyAssignedAkzente> {
    // Convert DTOs to domain objects
    const akzente = new Akzente();
    akzente.id = createClientCompanyAssignedAkzenteDto.akzente.id;

    const clientCompany = new ClientCompany();
    clientCompany.id = createClientCompanyAssignedAkzenteDto.clientCompany.id;

    const clonedPayload = {
      akzente,
      clientCompany,
    };

    return this.clientCompanyAssignedAkzenteRepository.create(clonedPayload);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompanyAssignedAkzente[]; hasNextPage: boolean }> {
    const result = await this.clientCompanyAssignedAkzenteRepository.findAllWithPagination({
      paginationOptions,
    });

    return {
      data: result.data,
      hasNextPage: result.data.length === paginationOptions.limit,
    };
  }

  // Add this method to find assignments by client ID
  async findByAkzenteId(akzenteId: number): Promise<ClientCompanyAssignedAkzente[]> {
    return this.clientCompanyAssignedAkzenteRepository.findByAkzenteId(akzenteId);
  }

  async findByAkzenteIdWithPagination(akzenteId: number, paginationOptions: IPaginationOptions): Promise<{ data: ClientCompanyAssignedAkzente[]; totalCount: number }> {
    return this.clientCompanyAssignedAkzenteRepository.findByAkzenteIdWithPagination(akzenteId, paginationOptions);
  }

  // Add this method to find assignments by client company ID
  async findByClientCompanyId(clientCompanyId: number): Promise<ClientCompanyAssignedAkzente[]> {
    return this.clientCompanyAssignedAkzenteRepository.findByClientCompanyId(clientCompanyId);
  }

  findById(id: ClientCompanyAssignedAkzente['id']) {
    return this.clientCompanyAssignedAkzenteRepository.findById(id);
  }

  findByIds(ids: ClientCompanyAssignedAkzente['id'][]) {
    return this.clientCompanyAssignedAkzenteRepository.findByIds(ids);
  }

  async update(id: ClientCompanyAssignedAkzente['id'], updateClientCompanyAssignedAkzenteDto: UpdateClientCompanyAssignedAkzenteDto) {
    const domainPayload: Partial<ClientCompanyAssignedAkzente> = {};

    if (updateClientCompanyAssignedAkzenteDto.akzente) {
      const akzente = new Akzente();
      akzente.id = updateClientCompanyAssignedAkzenteDto.akzente.id;
      domainPayload.akzente = akzente;
    }

    if (updateClientCompanyAssignedAkzenteDto.clientCompany) {
      const clientCompany = new ClientCompany();
      clientCompany.id = updateClientCompanyAssignedAkzenteDto.clientCompany.id;
      domainPayload.clientCompany = clientCompany;
    }

    return this.clientCompanyAssignedAkzenteRepository.update(id, domainPayload);
  }

  remove(id: ClientCompanyAssignedAkzente['id']) {
    return this.clientCompanyAssignedAkzenteRepository.remove(id);
  }
}
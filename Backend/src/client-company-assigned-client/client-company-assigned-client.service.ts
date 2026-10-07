import { Injectable } from '@nestjs/common';
import { CreateClientCompanyAssignedClientDto } from './dto/create-client-company-assigned-client.dto';
import { UpdateClientCompanyAssignedClientDto } from './dto/update-client-company-assigned-client.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ClientCompanyAssignedClient } from './domain/client-company-assigned-client';
import { Client } from '../client/domain/client';
import { ClientCompany } from '../client-company/domain/client-company';
import { ClientCompanyAssignedClientRepository } from './infrastructure/persistence/client-company-assigned-client.repository';

@Injectable()
export class ClientCompanyAssignedClientService {
  constructor(
    private readonly clientCompanyAssignedClientRepository: ClientCompanyAssignedClientRepository,
  ) {}

  async create(createClientCompanyAssignedClientDto: CreateClientCompanyAssignedClientDto): Promise<ClientCompanyAssignedClient> {
    // Convert DTOs to domain objects
    const client = new Client();
    client.id = createClientCompanyAssignedClientDto.client.id;

    const clientCompany = new ClientCompany();
    clientCompany.id = createClientCompanyAssignedClientDto.clientCompany.id;

    const clonedPayload = {
      client,
      clientCompany,
    };

    return this.clientCompanyAssignedClientRepository.create(clonedPayload);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: ClientCompanyAssignedClient[]; hasNextPage: boolean }> {
    const result = await this.clientCompanyAssignedClientRepository.findAllWithPagination({
      paginationOptions,
    });

    return {
      data: result.data,
      hasNextPage: result.data.length === paginationOptions.limit,
    };
  }

  // Add this method to find assignments by client ID
  async findByClientId(clientId: number): Promise<ClientCompanyAssignedClient[]> {
    return this.clientCompanyAssignedClientRepository.findByClientId(clientId);
  }

  // Add this method to find assignments by client company ID
  async findByClientCompanyId(clientCompanyId: number): Promise<ClientCompanyAssignedClient[]> {
    return this.clientCompanyAssignedClientRepository.findByClientCompanyId(clientCompanyId);
  }

  findById(id: ClientCompanyAssignedClient['id']) {
    return this.clientCompanyAssignedClientRepository.findById(id);
  }

  findByIds(ids: ClientCompanyAssignedClient['id'][]) {
    return this.clientCompanyAssignedClientRepository.findByIds(ids);
  }

  async update(id: ClientCompanyAssignedClient['id'], updateClientCompanyAssignedClientDto: UpdateClientCompanyAssignedClientDto) {
    const domainPayload: Partial<ClientCompanyAssignedClient> = {};

    if (updateClientCompanyAssignedClientDto.client) {
      const client = new Client();
      client.id = updateClientCompanyAssignedClientDto.client.id;
      domainPayload.client = client;
    }

    if (updateClientCompanyAssignedClientDto.clientCompany) {
      const clientCompany = new ClientCompany();
      clientCompany.id = updateClientCompanyAssignedClientDto.clientCompany.id;
      domainPayload.clientCompany = clientCompany;
    }

    return this.clientCompanyAssignedClientRepository.update(id, domainPayload);
  }

  remove(id: ClientCompanyAssignedClient['id']) {
    return this.clientCompanyAssignedClientRepository.remove(id);
  }
}
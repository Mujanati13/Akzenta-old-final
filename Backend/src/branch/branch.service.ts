import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchRepository } from './infrastructure/persistence/branch.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Branch } from './domain/branch';
import { ClientCompanyService } from '../client-company/client-company.service';
import { ClientCompany } from '../client-company/domain/client-company';
import { CitiesService } from '../cities/cities.service';
import { Cities } from '../cities/domain/cities';

@Injectable()
export class BranchService {
  constructor(
    private readonly branchRepository: BranchRepository,
    @Inject(forwardRef(() => ClientCompanyService))
    private readonly clientService: ClientCompanyService,
    private readonly cityService: CitiesService,
  ) {}

  async create(createBranchDto: CreateBranchDto): Promise<Branch> {
    const client = await this.clientService.findById(createBranchDto.client.id);
    if (!client) {
      throw new Error('Client not found');
    }

    let city: Cities | undefined;

    if (createBranchDto.city?.id) {
      const foundCity = await this.cityService.findById(
        createBranchDto.city.id,
      );
      if (!foundCity) {
      throw new Error('City not found');
      }
      city = foundCity;
    }

    return this.branchRepository.create({
      name: createBranchDto.name,
      branchNumber: createBranchDto.branchNumber,
      street: createBranchDto.street,
      zipCode: createBranchDto.zipCode,
      phone: createBranchDto.phone,
      client,
      city,
    });
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Branch[]; totalCount: number }> {
    const { data } = await this.branchRepository.findAllWithPagination({
      paginationOptions: {
        page: 1,
        limit: 0,
      },
    });

    const uniqueBranches = this.dedupeBranchesByIdentity(data);
    const totalCount = uniqueBranches.length;
    const shouldPaginate =
      !!paginationOptions.limit && paginationOptions.limit > 0;

    if (!shouldPaginate) {
      return {
        data: uniqueBranches,
        totalCount,
      };
    }

    const page = paginationOptions.page ?? 1;
    const limit = paginationOptions.limit;
    const start = (page - 1) * limit;

    return {
      data: uniqueBranches.slice(start, start + limit),
      totalCount,
    };
  }

  private dedupeBranchesByIdentity(branches: Branch[]): Branch[] {
    const byKey = new Map<string, Branch>();

    for (const branch of branches) {
      const key = this.getBranchIdentityKey(branch);
      const existing = byKey.get(key);

      if (!existing || branch.id < existing.id) {
        byKey.set(key, branch);
      }
    }

    return Array.from(byKey.values());
  }

  private getBranchIdentityKey(branch: Branch): string {
    const normalize = (value?: string | null) =>
      (value ?? '').toString().trim().toLowerCase();

    const branchNumber = normalize(branch.branchNumber);
    const parts = [
      normalize(branch.name),
      branchNumber || '',
      normalize(branch.street),
      normalize(branch.zipCode),
      branch.city?.id ?? '',
      branch.client?.id ?? '',
    ];

    return parts.join('|');
  }

  findById(id: Branch['id']) {
    return this.branchRepository.findById(id);
  }

  findByIds(ids: Branch['id'][]) {
    return this.branchRepository.findByIds(ids);
  }

  findByClientCompanyId(clientCompanyId: number) {
    return this.branchRepository.findByClientCompanyId(clientCompanyId);
  }

  async update(id: Branch['id'], updateBranchDto: UpdateBranchDto) {
    let client: ClientCompany | undefined = undefined;

    if (updateBranchDto.client) {
      const foundClient = await this.clientService.findById(
        updateBranchDto.client.id,
      );
      if (!foundClient) {
        throw new Error('Client not found');
      }
      client = foundClient;
    }

    let city: Cities | undefined = undefined;

    if (updateBranchDto.city) {
      const foundCity = await this.cityService.findById(updateBranchDto.city.id);
      if (!foundCity) {
        throw new Error('City not found');
      }
      city = foundCity;
    }

    return this.branchRepository.update(id, {
      name: updateBranchDto.name,
      branchNumber: updateBranchDto.branchNumber,
      street: updateBranchDto.street,
      zipCode: updateBranchDto.zipCode,
      phone: updateBranchDto.phone,
      client,
      city,
    });
  }

  remove(id: Branch['id']) {
    return this.branchRepository.remove(id);
  }

  async findByNameAndClient(name: string, clientId: number): Promise<Branch | null> {
    return this.branchRepository.findByNameAndClient(name, clientId);
  }

  async findByBranchNumberAndClient(
    branchNumber: string,
    clientId: number,
  ): Promise<Branch | null> {
    return this.branchRepository.findByBranchNumberAndClient(
      branchNumber,
      clientId,
    );
  }

  async findByNameAndBranchNumberAndClient(
    name: string,
    branchNumber: string,
    clientId: number,
  ): Promise<Branch | null> {
    return this.branchRepository.findByNameAndBranchNumberAndClient(
      name,
      branchNumber,
      clientId,
    );
  }

  async findByNameStreetZipCodeCityAndProject(
    name: string,
    street: string | null,
    zipCode: string | null,
    cityId: number,
    projectId: number,
  ): Promise<Branch | null> {
    return this.branchRepository.findByNameStreetZipCodeCityAndProject(
      name,
      street,
      zipCode,
      cityId,
      projectId,
    );
  }

  async findByNameStreetZipCodeCityAndClient(
    name: string,
    street: string | null,
    zipCode: string | null,
    cityId: number,
    clientId: number,
  ): Promise<Branch | null> {
    return this.branchRepository.findByNameStreetZipCodeCityAndClient(
      name,
      street,
      zipCode,
      cityId,
      clientId,
    );
  }
}

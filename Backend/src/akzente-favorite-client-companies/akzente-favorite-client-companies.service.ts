import {
  // common
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateAkzenteFavoriteClientCompanyDto } from './dto/create-akzente-favorite-client-company.dto';
import { UpdateAkzenteFavoriteClientCompanyDto } from './dto/update-akzente-favorite-client-company.dto';
import { AkzenteFavoriteClientCompanyRepository } from './infrastructure/persistence/akzente-favorite-client-company.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AkzenteFavoriteClientCompany } from './domain/akzente-favorite-client-company';
import { AkzenteService } from '../akzente/akzente.service';
import { ClientCompanyService } from '../client-company/client-company.service';

@Injectable()
export class AkzenteFavoriteClientCompaniesService {
  constructor(
    // Dependencies here
    private readonly favoriteClientCompanyRepository: AkzenteFavoriteClientCompanyRepository,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    private readonly clientCompanyService: ClientCompanyService,
  ) {}

  async create(
    createFavoriteClientCompanyDto: CreateAkzenteFavoriteClientCompanyDto,
  ) {
    const akzente = await this.akzenteService.findById(
      createFavoriteClientCompanyDto.akzente.id,
    );
    if (!akzente) {
      throw new Error('Akzente not found');
    }

    const clientCompany = await this.clientCompanyService.findById(
      createFavoriteClientCompanyDto.clientCompany.id,
    );
    if (!clientCompany) {
      throw new Error('Client company not found');
    }

    return this.favoriteClientCompanyRepository.create({
      akzente,
      clientCompany,
    });
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: AkzenteFavoriteClientCompany[]; hasNextPage: boolean }> {
    const result = await this.favoriteClientCompanyRepository.findAllWithPagination({
      paginationOptions,
    });

    return {
      data: result.data,
      hasNextPage: result.data.length === paginationOptions.limit,
    };
  }

  // Add this method to find favorites by akzente ID
  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteClientCompany[]> {
    return this.favoriteClientCompanyRepository.findByAkzenteId(akzenteId);
  }

  findById(id: AkzenteFavoriteClientCompany['id']) {
    return this.favoriteClientCompanyRepository.findById(id);
  }

  findByIds(ids: AkzenteFavoriteClientCompany['id'][]) {
    return this.favoriteClientCompanyRepository.findByIds(ids);
  }

  async update(
    id: AkzenteFavoriteClientCompany['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateFavoriteClientCompanyDto: UpdateAkzenteFavoriteClientCompanyDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.favoriteClientCompanyRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: AkzenteFavoriteClientCompany['id']) {
    return this.favoriteClientCompanyRepository.remove(id);
  }
}

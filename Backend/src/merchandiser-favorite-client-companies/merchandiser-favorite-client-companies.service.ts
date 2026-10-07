import {
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateMerchandiserFavoriteClientCompanyDto } from './dto/create-merchandiser-favorite-client-company.dto';
import { UpdateMerchandiserFavoriteClientCompanyDto } from './dto/update-merchandiser-favorite-client-company.dto';
import { MerchandiserFavoriteClientCompanyRepository } from './infrastructure/persistence/merchandiser-favorite-client-company.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MerchandiserFavoriteClientCompany } from './domain/merchandiser-favorite-client-company';
import { MerchandiserService } from '../merchandiser/merchandiser.service';
import { ClientCompanyService } from '../client-company/client-company.service';

@Injectable()
export class MerchandiserFavoriteClientCompanyService {
  constructor(
    private readonly merchandiserFavoriteClientCompanyRepository: MerchandiserFavoriteClientCompanyRepository,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandiserService: MerchandiserService,
    @Inject(forwardRef(() => ClientCompanyService))
    private readonly clientCompanyService: ClientCompanyService,
  ) {}

  async create(
    createMerchandiserFavoriteClientCompanyDto: CreateMerchandiserFavoriteClientCompanyDto,
  ) {
    // Find Merchandiser by user ID instead of Merchandiser ID
    const merchandiser = await this.merchandiserService.findByUserIdNumber(
      createMerchandiserFavoriteClientCompanyDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    const clientCompany = await this.clientCompanyService.findById(
      createMerchandiserFavoriteClientCompanyDto.clientCompany.id,
    );
    if (!clientCompany) {
      throw new Error('Client company not found');
    }

    return this.merchandiserFavoriteClientCompanyRepository.create({
      merchandiser,
      clientCompany,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.merchandiserFavoriteClientCompanyRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MerchandiserFavoriteClientCompany['id']) {
    return this.merchandiserFavoriteClientCompanyRepository.findById(id);
  }

  findByIds(ids: MerchandiserFavoriteClientCompany['id'][]) {
    return this.merchandiserFavoriteClientCompanyRepository.findByIds(ids);
  }

  findOne(options: { merchandiserId: number; clientCompanyId: number }) {
    return this.merchandiserFavoriteClientCompanyRepository.findOne(options);
  }

  async findByMerchandiserId(merchandiserId: number): Promise<MerchandiserFavoriteClientCompany[]> {
    return this.merchandiserFavoriteClientCompanyRepository.findByMerchandiserId(merchandiserId);
  }

  async update(
    id: MerchandiserFavoriteClientCompany['id'],
    updateMerchandiserFavoriteClientCompanyDto: UpdateMerchandiserFavoriteClientCompanyDto,
  ) {
    return this.merchandiserFavoriteClientCompanyRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: MerchandiserFavoriteClientCompany['id']) {
    return this.merchandiserFavoriteClientCompanyRepository.remove(id);
  }
}

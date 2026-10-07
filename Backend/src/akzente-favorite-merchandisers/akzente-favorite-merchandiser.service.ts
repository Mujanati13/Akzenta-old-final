import {
  Injectable, Inject, forwardRef
} from '@nestjs/common';
import { CreateAkzenteFavoriteMerchandiserDto } from './dto/create-akzente-favorite-merchandiser.dto';
import { UpdateAkzenteFavoriteMerchandiserDto } from './dto/update-akzente-favorite-merchandiser.dto';
import { AkzenteFavoriteMerchandiserRepository } from './infrastructure/persistence/akzente-favorite-merchandiser.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AkzenteFavoriteMerchandiser } from './domain/akzente-favorite-merchandiser';
import { AkzenteService } from '../akzente/akzente.service';
import { MerchandiserService } from '../merchandiser/merchandiser.service';

@Injectable()
export class AkzenteFavoriteMerchandisersService {
  constructor(
    private readonly akzenteFavoriteMerchandiserRepository: AkzenteFavoriteMerchandiserRepository,
    @Inject(forwardRef(() => AkzenteService))
    private readonly akzenteService: AkzenteService,
    @Inject(forwardRef(() => MerchandiserService))
    private readonly merchandisersService: MerchandiserService,
  ) {}

  async create(
    createFavoriteMerchandiserDto: CreateAkzenteFavoriteMerchandiserDto,
  ): Promise<AkzenteFavoriteMerchandiser> {
    const akzente = await this.akzenteService.findById(
      createFavoriteMerchandiserDto.akzente.id,
    );
    if (!akzente) {
      throw new Error('Akzente not found');
    }

    const merchandiser = await this.merchandisersService.findById(
      createFavoriteMerchandiserDto.merchandiser.id,
    );
    if (!merchandiser) {
      throw new Error('Merchandiser not found');
    }

    return this.akzenteFavoriteMerchandiserRepository.create({
      akzente,
      merchandiser,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.akzenteFavoriteMerchandiserRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: AkzenteFavoriteMerchandiser['id']) {
    return this.akzenteFavoriteMerchandiserRepository.findById(id);
  }

  findByIds(ids: AkzenteFavoriteMerchandiser['id'][]) {
    return this.akzenteFavoriteMerchandiserRepository.findByIds(ids);
  }

  async findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteMerchandiser[]> {
    return this.akzenteFavoriteMerchandiserRepository.findByAkzenteId(akzenteId);
  }

  async update(
    id: AkzenteFavoriteMerchandiser['id'],
    updateFavoriteMerchandiserDto: UpdateAkzenteFavoriteMerchandiserDto,
  ) {
    let akzente: any = undefined;
    let merchandiser: any = undefined;

    if (updateFavoriteMerchandiserDto.akzente) {
      const foundAkzente = await this.akzenteService.findById(
        updateFavoriteMerchandiserDto.akzente.id,
      );
      if (!foundAkzente) {
        throw new Error('Akzente not found');
      }
      akzente = foundAkzente;
    }

    if (updateFavoriteMerchandiserDto.merchandiser) {
      const foundMerchandiser = await this.merchandisersService.findById(
        updateFavoriteMerchandiserDto.merchandiser.id,
      );
      if (!foundMerchandiser) {
        throw new Error('Merchandiser not found');
      }
      merchandiser = foundMerchandiser;
    }

    return this.akzenteFavoriteMerchandiserRepository.update(id, {
      akzente,
      merchandiser,
    });
  }

  remove(id: AkzenteFavoriteMerchandiser['id']) {
    return this.akzenteFavoriteMerchandiserRepository.remove(id);
  }
}

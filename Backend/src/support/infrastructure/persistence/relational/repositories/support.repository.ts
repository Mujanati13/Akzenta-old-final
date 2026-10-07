import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportEntity } from '../entities/support.entity';
import { SupportMapper } from '../mappers/support.mapper';
import { Support } from '../../../../domain/support';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { SupportRepository } from '../../../persistence/support.repository';

@Injectable()
export class SupportRelationalRepository implements SupportRepository {
  constructor(
    @InjectRepository(SupportEntity)
    private readonly supportRepository: Repository<SupportEntity>,
  ) {}

  async create(data: Support): Promise<Support> {
    const persistenceModel = SupportMapper.toPersistence(data);
    const newEntity = await this.supportRepository.save(
      this.supportRepository.create(persistenceModel),
    );
    return SupportMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Support[]> {
    const entities = await this.supportRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => SupportMapper.toDomain(entity));
  }

  async findById(id: Support['id']): Promise<Support | null> {
    const entity = await this.supportRepository.findOne({
      where: { id },
    });

    return entity ? SupportMapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<Support | null> {
    const entity = await this.supportRepository.findOne({
      where: { email },
    });

    return entity ? SupportMapper.toDomain(entity) : null;
  }

  async update(id: Support['id'], payload: Partial<Support>): Promise<Support> {
    const entity = await this.supportRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Support not found');
    }

    const updatedEntity = await this.supportRepository.save(
      this.supportRepository.create(
        SupportMapper.toPersistence({
          ...SupportMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SupportMapper.toDomain(updatedEntity);
  }

  async remove(id: Support['id']): Promise<void> {
    await this.supportRepository.delete(id);
  }
}

import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { Support } from '../../domain/support';
import { IPaginationOptions } from '../../../utils/types/pagination-options';

export abstract class SupportRepository {
  abstract create(
    data: Omit<Support, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Support>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Support[]>;

  abstract findById(id: Support['id']): Promise<Support | null>;

  abstract findByEmail(email: string): Promise<Support | null>;

  abstract update(
    id: Support['id'],
    payload: DeepPartial<Support>,
  ): Promise<Support | null>;

  abstract remove(id: Support['id']): Promise<void>;
}


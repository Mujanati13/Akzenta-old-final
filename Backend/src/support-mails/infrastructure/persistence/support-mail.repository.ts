import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { SupportMail } from '../../domain/support-mail';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Client } from '../../../client/domain/client';

export abstract class SupportMailRepository {
  abstract create(
    data: Omit<SupportMail, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SupportMail>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<SupportMail[]>;

  abstract findById(id: SupportMail['id']): Promise<SupportMail | null>;

  abstract findByClientId(clientId: Client['id']): Promise<SupportMail[]>;

  abstract update(
    id: SupportMail['id'],
    payload: DeepPartial<SupportMail>,
  ): Promise<SupportMail | null>;

  abstract remove(id: SupportMail['id']): Promise<void>;
}


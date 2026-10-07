import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AkzenteFavoriteProject } from '../../domain/akzente-favorite-project';

export abstract class AkzenteFavoriteProjectRepository {
  abstract create(
    data: Omit<AkzenteFavoriteProject, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AkzenteFavoriteProject>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<AkzenteFavoriteProject[]>;

  abstract findById(
    id: AkzenteFavoriteProject['id'],
  ): Promise<NullableType<AkzenteFavoriteProject>>;

  abstract findByIds(ids: AkzenteFavoriteProject['id'][]): Promise<AkzenteFavoriteProject[]>;

  abstract findOne(options: { akzenteId: number; projectId: number }): Promise<NullableType<AkzenteFavoriteProject>>;

  abstract findByAkzenteId(akzenteId: number): Promise<AkzenteFavoriteProject[]>;

  abstract update(
    id: AkzenteFavoriteProject['id'],
    payload: DeepPartial<AkzenteFavoriteProject>,
  ): Promise<AkzenteFavoriteProject | null>;

  abstract remove(id: AkzenteFavoriteProject['id']): Promise<void>;
}

import { MerchandiserFavoriteClientCompany } from '../../../../domain/merchandiser-favorite-client-company';
import { MerchandiserFavoriteClientCompanyEntity } from '../entities/merchandiser-favorite-client-company.entity';

export class MerchandiserFavoriteClientCompanyMapper {
  static toDomain(
    raw: MerchandiserFavoriteClientCompanyEntity,
  ): MerchandiserFavoriteClientCompany {
    const domainEntity = new MerchandiserFavoriteClientCompany();
    delete (raw as any).__entity;

    Object.assign(domainEntity, raw);

    return domainEntity;
  }

  static toPersistence(
    domainEntity: MerchandiserFavoriteClientCompany,
  ): MerchandiserFavoriteClientCompanyEntity {
    const persistenceEntity = new MerchandiserFavoriteClientCompanyEntity();

    Object.assign(persistenceEntity, domainEntity);

    return persistenceEntity;
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { MerchandiserEntity } from '../../../../../merchandiser/infrastructure/persistence/relational/entities/merchandiser.entity';
import { ClientCompanyEntity } from '../../../../../client-company/infrastructure/persistence/relational/entities/client-company.entity';

@Entity({
  name: 'merchandiser_favorite_client_company',
})
export class MerchandiserFavoriteClientCompanyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MerchandiserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'merchandiser_id' })
  merchandiser: MerchandiserEntity;

  @ManyToOne(() => ClientCompanyEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'client_company_id' })
  clientCompany: ClientCompanyEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

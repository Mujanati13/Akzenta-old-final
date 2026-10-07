import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { AkzenteEntity } from '../../../../../akzente/infrastructure/persistence/relational/entities/akzente.entity';
import { ClientCompanyEntity } from '../../../../../client-company/infrastructure/persistence/relational/entities/client-company.entity';

@Entity({
  name: 'client_company_assigned_akzente',
})
export class ClientCompanyAssignedAkzenteEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AkzenteEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'akzente_id' })
  akzente: AkzenteEntity;

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

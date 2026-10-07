import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ClientEntity } from '../../../../../client/infrastructure/persistence/relational/entities/client.entity';
import { ReportEntity } from '../../../../../report/infrastructure/persistence/relational/entities/report.entity';

@Entity({
  name: 'client_favorite_reports',
})
export class ClientFavoriteReportEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @ManyToOne(() => ReportEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'report_id' })
  report: ReportEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
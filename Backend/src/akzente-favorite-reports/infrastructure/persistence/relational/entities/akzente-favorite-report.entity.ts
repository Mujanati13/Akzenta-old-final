import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { AkzenteEntity } from '../../../../../akzente/infrastructure/persistence/relational/entities/akzente.entity';
import { ReportEntity } from '../../../../../report/infrastructure/persistence/relational/entities/report.entity';

@Entity({
  name: 'akzente_favorite_reports',
})
export class AkzenteFavoriteReportEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AkzenteEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'akzente_id' })
  akzente: AkzenteEntity;

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
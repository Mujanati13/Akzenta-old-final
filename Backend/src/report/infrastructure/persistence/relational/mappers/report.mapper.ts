import { Report } from '../../../../domain/report';
import { ReportEntity } from '../entities/report.entity';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';
import { ClientCompanyMapper } from '../../../../../client-company/infrastructure/persistence/relational/mappers/client-company.mapper';
import { MerchandiserMapper } from '../../../../../merchandiser/infrastructure/persistence/relational/mappers/merchandiser.mapper';
import { BranchMapper } from '../../../../../branch/infrastructure/persistence/relational/mappers/branch.mapper';
import { StatusMapper } from '../../../../../report-status/infrastructure/persistence/relational/mappers/status.mapper';
import { AnswerMapper } from '../../../../../answer/infrastructure/persistence/relational/mappers/answer.mapper';
import { ConversationMapper } from '../../../../../conversation/infrastructure/persistence/relational/mappers/conversation.mapper';
import { UploadedAdvancedPhotoMapper } from '../../../../../uploaded-advanced-photos/infrastructure/persistence/relational/mappers/uploaded-advanced-photo.mapper';

export class ReportMapper {
  static toDomain(raw: ReportEntity): Report {
    const domainEntity = new Report();
    domainEntity.id = raw.id;
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    if (raw.status) {
      domainEntity.status = StatusMapper.toDomain(raw.status);
    }
    if (raw.clientCompany) {
      domainEntity.clientCompany = ClientCompanyMapper.toDomain(
        raw.clientCompany,
      );
    }
    if (raw.merchandiser) {
      domainEntity.merchandiser = MerchandiserMapper.toDomain(raw.merchandiser);
    }
    if (raw.branch) {
      domainEntity.branch = BranchMapper.toDomain(raw.branch);
    }
    if (raw.answers) {
      domainEntity.answers = raw.answers.map(answer => AnswerMapper.toDomain(answer));
    }
    if (raw.conversation) {
      domainEntity.conversation = ConversationMapper.toDomain(raw.conversation);
    }
    if (raw.uploadedAdvancedPhotos) {
      domainEntity.uploadedAdvancedPhotos = raw.uploadedAdvancedPhotos.map(uploadedAdvancedPhoto => 
        UploadedAdvancedPhotoMapper.toDomain(uploadedAdvancedPhoto)
      );
    }
    domainEntity.street = raw.street;
    domainEntity.zipCode = raw.zipCode;
    domainEntity.plannedOn = raw.plannedOn;
    domainEntity.note = raw.note;
    domainEntity.reportTo = raw.reportTo;
    domainEntity.visitDate = raw.visitDate;
    domainEntity.nextVisitDate = raw.nextVisitDate;
    domainEntity.feedback = raw.feedback;
    domainEntity.accepted = raw.accepted;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Report): ReportEntity {
    const persistenceEntity = new ReportEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(
        domainEntity.project,
      );
    }
    if (domainEntity.status) {
      persistenceEntity.status = StatusMapper.toPersistence(
        domainEntity.status,
      );
    }
    if (domainEntity.clientCompany) {
      persistenceEntity.clientCompany = ClientCompanyMapper.toPersistence(
        domainEntity.clientCompany,
      );
    }
    // Handle merchandiser explicitly to support null values (when removing merchandiser)
    if ('merchandiser' in domainEntity) {
      persistenceEntity.merchandiser = domainEntity.merchandiser 
        ? MerchandiserMapper.toPersistence(domainEntity.merchandiser)
        : null;
    }
    if (domainEntity.branch) {
      persistenceEntity.branch = BranchMapper.toPersistence(
        domainEntity.branch,
      );
    }
    if (domainEntity.answers) {
      persistenceEntity.answers = domainEntity.answers.map(answer => AnswerMapper.toPersistence(answer));
    }
    if (domainEntity.uploadedAdvancedPhotos) {
      persistenceEntity.uploadedAdvancedPhotos = domainEntity.uploadedAdvancedPhotos.map(uploadedAdvancedPhoto => 
        UploadedAdvancedPhotoMapper.toPersistence(uploadedAdvancedPhoto)
      );
    }
    persistenceEntity.street = domainEntity.street;
    persistenceEntity.zipCode = domainEntity.zipCode;
    persistenceEntity.plannedOn = domainEntity.plannedOn;
    persistenceEntity.note = domainEntity.note;
    persistenceEntity.reportTo = domainEntity.reportTo;
    persistenceEntity.visitDate = domainEntity.visitDate;
    persistenceEntity.nextVisitDate = domainEntity.nextVisitDate;
    persistenceEntity.feedback = domainEntity.feedback;
    if ('accepted' in domainEntity) {
      persistenceEntity.accepted = domainEntity.accepted ?? false;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}

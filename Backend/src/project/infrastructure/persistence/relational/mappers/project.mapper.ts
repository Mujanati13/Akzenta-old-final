import { Project } from '../../../../domain/project';
import { ProjectEntity } from '../entities/project.entity';
import { ClientCompanyMapper } from '../../../../../client-company/infrastructure/persistence/relational/mappers/client-company.mapper';
import { QuestionMapper } from '../../../../../question/infrastructure/persistence/relational/mappers/question.mapper';
import { PhotoMapper } from '../../../../../photo/infrastructure/persistence/relational/mappers/photo.mapper';
import { AdvancedPhotoMapper } from '../../../../../advanced-photo/infrastructure/persistence/relational/mappers/advanced-photo.mapper';

export class ProjectMapper {
  static toDomain(raw: ProjectEntity): Project {
    const domainEntity = new Project();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.startDate = raw.startDate;
    domainEntity.endDate = raw.endDate;
    domainEntity.isSpecCompliantEnabled = raw.isSpecCompliantEnabled;
    domainEntity.feedback = raw.feedback;
    if (raw.clientCompany) {
      domainEntity.clientCompany = ClientCompanyMapper.toDomain(
        raw.clientCompany,
      );
    }
    if (raw.questions) {
      domainEntity.questions = raw.questions.map(question => QuestionMapper.toDomain(question));
    }
    if (raw.photos) {
      domainEntity.photos = raw.photos.map(photo => PhotoMapper.toDomain(photo));
    }
    if (raw.advancedPhotos) {
      domainEntity.advancedPhotos = raw.advancedPhotos.map(advancedPhoto => AdvancedPhotoMapper.toDomain(advancedPhoto));
    }
    domainEntity.photoImageNamePattern = raw.photoImageNamePattern;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Project): ProjectEntity {
    const persistenceEntity = new ProjectEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.startDate = domainEntity.startDate;
    persistenceEntity.endDate = domainEntity.endDate;
    persistenceEntity.isSpecCompliantEnabled = domainEntity.isSpecCompliantEnabled;
    persistenceEntity.feedback = domainEntity.feedback;
    if (domainEntity.clientCompany) {
      persistenceEntity.clientCompany = ClientCompanyMapper.toPersistence(
        domainEntity.clientCompany,
      );
    }
    if (domainEntity.questions) {
      persistenceEntity.questions = domainEntity.questions.map(question => QuestionMapper.toPersistence(question));
    }
    if (domainEntity.photos) {
      persistenceEntity.photos = domainEntity.photos.map(photo => PhotoMapper.toPersistence(photo));
    }
    if (domainEntity.advancedPhotos) {
      persistenceEntity.advancedPhotos = domainEntity.advancedPhotos.map(advancedPhoto => AdvancedPhotoMapper.toPersistence(advancedPhoto));
    }
    persistenceEntity.photoImageNamePattern = domainEntity.photoImageNamePattern;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}

import { ProjectBranch } from '../../../../domain/project-branch';
import { ProjectBranchEntity } from '../entities/project-branch.entity';
import { ProjectMapper } from '../../../../../project/infrastructure/persistence/relational/mappers/project.mapper';
import { BranchMapper } from '../../../../../branch/infrastructure/persistence/relational/mappers/branch.mapper';

export class ProjectBranchMapper {
  static toDomain(raw: ProjectBranchEntity): ProjectBranch {
    const domainEntity = new ProjectBranch();
    domainEntity.id = raw.id;
    if (raw.project) {
      domainEntity.project = ProjectMapper.toDomain(raw.project);
    }
    if (raw.branch) {
      domainEntity.branch = BranchMapper.toDomain(raw.branch);
    }
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ProjectBranch): ProjectBranchEntity {
    const persistenceEntity = new ProjectBranchEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.project) {
      persistenceEntity.project = ProjectMapper.toPersistence(
        domainEntity.project,
      );
    }
    if (domainEntity.branch) {
      persistenceEntity.branch = BranchMapper.toPersistence(
        domainEntity.branch,
      );
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}

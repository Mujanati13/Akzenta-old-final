import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ReportEntity } from '../entities/report.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Report } from '../../../../domain/report';
import { ReportRepository } from '../../report.repository';
import { ReportMapper } from '../mappers/report.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { ConversationEntity } from '../../../../../conversation/infrastructure/persistence/relational/entities/conversation.entity';
import { MessageEntity } from '../../../../../message/infrastructure/persistence/relational/entities/message.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { ClientCompanyAssignedClientEntity } from '../../../../../client-company-assigned-client/infrastructure/persistence/relational/entities/client-company-assigned-client.entity';
import { ProjectEntity } from '../../../../../project/infrastructure/persistence/relational/entities/project.entity';
import { UploadedAdvancedPhotoEntity } from '../../../../../uploaded-advanced-photos/infrastructure/persistence/relational/entities/uploaded-advanced-photo.entity';
import { ReportStatusEnum } from '../../../../../report-status/dto/status.enum';

@Injectable()
export class ReportRelationalRepository implements ReportRepository {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepository: Repository<ReportEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
  ) {}

  async create(data: Report): Promise<Report> {
    const persistenceModel = ReportMapper.toPersistence(data);
    // Explicitly exclude ID when creating new reports to prevent duplicate key errors
    // Use object destructuring to omit the id property
    const { id, ...modelWithoutId } = persistenceModel;
    const newEntity = await this.reportRepository.save(
      this.reportRepository.create(modelWithoutId as ReportEntity),
    );
    
    // Reload with relations to ensure all data is available
    const reloadedEntity = await this.reportRepository.findOne({
      where: { id: newEntity.id },
      relations: ['project', 'status', 'clientCompany', 'branch', 'branch.city', 'branch.city.country', 'merchandiser', 'merchandiser.user'],
    });
    
    return reloadedEntity ? ReportMapper.toDomain(reloadedEntity) : ReportMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: Report[]; totalCount: number }> {
    const [entities, totalCount] = await this.reportRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      relations: ['project', 'status', 'clientCompany', 'branch', 'branch.city', 'branch.city.country', 'merchandiser', 'merchandiser.user'],
      order: {
        createdAt: 'DESC', // Default order by creation date descending (newest first)
      },
    });

    return {
      data: entities.map((entity) => ReportMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findByIdForUpdate(id: Report['id']): Promise<NullableType<Report>> {
    const entity = await this.reportRepository.findOne({
      where: { id },
      relations: [
        'project',
        'status',
        'clientCompany',
        'merchandiser',
        'branch',
        'branch.city',
        'branch.city.country',
      ],
    });

    return entity ? ReportMapper.toDomain(entity) : null;
  }

  async findById(id: Report['id']): Promise<NullableType<Report>> {
    const entity = await this.reportRepository.findOne({
      where: { id },
      relations: [
        'project',
        'project.questions',
        'project.questions.answerType',
        'project.questions.options',
        'project.photos',
        'project.advancedPhotos',
        'status',
        'clientCompany',
        'branch',
        'branch.city',
        'branch.city.country',
        'merchandiser',
        'answers',
        'answers.question',
        'answers.question.options',
        'answers.selectedOption',
        'conversation',
        'conversation.messages',
        'conversation.messages.sender',
        'conversation.messages.sender.photo',
        'conversation.messages.sender.type',
        'conversation.messages.receiver',
        'conversation.messages.receiver.photo',
        'conversation.messages.receiver.type',
        'uploadedAdvancedPhotos',
        'uploadedAdvancedPhotos.advancedPhoto',
        'uploadedAdvancedPhotos.file',
      ],
      order: {
        uploadedAdvancedPhotos: {
          order: 'ASC',
        },
      },
    });
    if (entity?.project) {
      this.sortProjectRelationsByCreatedAt(entity.project);
    }
    if (entity) {
      this.uniqUploadedAdvancedPhotoRows(entity);
    }
    return entity ? ReportMapper.toDomain(entity) : null;
  }

  /**
   * Sort project.questions and project.advancedPhotos by createdAt (creation order).
   */
  private sortProjectRelationsByCreatedAt(project: ProjectEntity): void {
    if (project.questions?.length) {
      project.questions.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    if (project.advancedPhotos?.length) {
      project.advancedPhotos.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
  }

  /**
   * TypeORM can surface the same uploaded_advanced_photo row more than once when many
   * relations are joined. Keep a single in-memory row per primary key.
   */
  private uniqUploadedAdvancedPhotoRows(entity: ReportEntity): void {
    if (!entity.uploadedAdvancedPhotos?.length) {
      return;
    }
    const byId = new Map<number, UploadedAdvancedPhotoEntity>();
    for (const row of entity.uploadedAdvancedPhotos) {
      if (row?.id != null && !byId.has(row.id)) {
        byId.set(row.id, row);
      }
    }
    entity.uploadedAdvancedPhotos = [...byId.values()].sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || a.id - b.id,
    );
  }

  async findByIdWithFilteredConversation(
    id: Report['id'],
    viewer: { role: 'akzente' | 'client' | 'merchandiser'; userId: number },
  ): Promise<NullableType<Report>> {
    // 1) Load report and required relations, but NOT messages to avoid join explosion
    const reportEntity = await this.reportRepository.findOne({
      where: { id },
      relations: [
        'project',
        'project.questions',
        'project.questions.answerType',
        'project.questions.options',
        'project.photos',
        'project.advancedPhotos',
        'status',
        'clientCompany',
        'branch',
        'branch.city',
        'branch.city.country',
        'merchandiser',
        'answers',
        'answers.question',
        'answers.selectedOption',
        'conversation',
        'uploadedAdvancedPhotos',
        'uploadedAdvancedPhotos.advancedPhoto',
        'uploadedAdvancedPhotos.file',
      ],
      order: {
        uploadedAdvancedPhotos: {
          order: 'ASC',
        },
      },
    });
    if (!reportEntity) return null;
    if (reportEntity.project) {
      this.sortProjectRelationsByCreatedAt(reportEntity.project);
    }
    this.uniqUploadedAdvancedPhotoRows(reportEntity);

    // 2) If there is a conversation, fetch messages (filtered for non-akzente)
    if (reportEntity.conversation) {
      const qb = this.messageRepository.createQueryBuilder('messages')
        .leftJoinAndSelect('messages.sender', 'sender')
        .leftJoinAndSelect('sender.photo', 'sender_photo')
        .leftJoinAndSelect('sender.type', 'sender_type')
        .leftJoinAndSelect('messages.receiver', 'receiver')
        .leftJoinAndSelect('receiver.photo', 'receiver_photo')
        .leftJoinAndSelect('receiver.type', 'receiver_type')
        .where('messages.conversation = :cid', { cid: reportEntity.conversation.id })
        .orderBy('messages.createdAt', 'ASC');

      if (viewer.role === 'client') {
        // Collect all client user IDs assigned to this report's client company
        const rawIds = await this.reportRepository.manager
          .createQueryBuilder(ClientCompanyAssignedClientEntity, 'ccac')
          .leftJoin('ccac.client', 'client')
          .leftJoin('client.user', 'client_user')
          .select('client_user.id', 'id')
          .where('ccac.clientCompany = :ccId', { ccId: reportEntity.clientCompany.id })
          .getRawMany();
        const clientUserIds = rawIds.map((r: any) => Number(r.id)).filter((n) => !!n);
        // Ensure current viewer is included even if not (yet) assigned
        if (!clientUserIds.includes(viewer.userId)) {
          clientUserIds.push(viewer.userId);
        }

        if (clientUserIds.length === 0) {
          (reportEntity.conversation as any).messages = [] as any;
          return ReportMapper.toDomain(reportEntity);
        }

        qb.andWhere(
          `(
            (LOWER(sender_type.name) = :akzente AND receiver.id IN (:...clientIds))
            OR (LOWER(receiver_type.name) = :akzente AND sender.id IN (:...clientIds))
            OR (messages.receiverType = :rAkzente AND sender.id IN (:...clientIds))
            OR (messages.receiverType = :rClient AND receiver.id IN (:...clientIds))
          )`,
          { akzente: 'akzente', rAkzente: 'akzente', rClient: 'client', clientIds: clientUserIds },
        );
      } else if (viewer.role === 'merchandiser') {
        qb.andWhere(
          '((LOWER(sender_type.name) = :akzente AND receiver.id = :viewerId) OR (LOWER(receiver_type.name) = :akzente AND sender.id = :viewerId))',
          { akzente: 'akzente', viewerId: viewer.userId },
        );
      } else if (viewer.role === 'akzente') {
        // Akzente users should see all messages addressed to/from Akzente,
        // regardless of the specific akzente receiver user ID.
        qb.andWhere(
          `(
            LOWER(sender_type.name) = :akzente
            OR LOWER(receiver_type.name) = :akzente
            OR messages.receiverType = :rAkzente
          )`,
          { akzente: 'akzente', rAkzente: 'akzente' },
        );
      }

      const filteredMessages = await qb.getMany();
      (reportEntity.conversation as any).messages = filteredMessages as any;
    }

    return ReportMapper.toDomain(reportEntity);
  }

  async findByIds(ids: Report['id'][]): Promise<Report[]> {
    const entities = await this.reportRepository.find({
      where: { id: In(ids) },
      relations: ['project', 'status', 'clientCompany', 'branch', 'branch.city', 'branch.city.country', 'merchandiser', 'merchandiser.user'],
    });
    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  async update(
    id: Report['id'],
    payload: Partial<Report>,
  ): Promise<Report | null> {
    const entity = await this.reportRepository.findOne({
      where: { id },
      relations: ['project', 'status', 'clientCompany', 'branch', 'branch.city', 'branch.city.country', 'merchandiser', 'merchandiser.user'],
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.reportRepository.save(
      this.reportRepository.create(
        ReportMapper.toPersistence({
          ...ReportMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    // Reload with relations to ensure all data is fresh
    const reloadedEntity = await this.reportRepository.findOne({
      where: { id: updatedEntity.id },
      relations: ['project', 'status', 'clientCompany', 'branch', 'branch.city', 'branch.city.country', 'merchandiser', 'merchandiser.user'],
    });

    return reloadedEntity ? ReportMapper.toDomain(reloadedEntity) : null;
  }

  async remove(id: Report['id']): Promise<void> {
    await this.reportRepository.delete(id);
  }

  async findBranchesByProjectId(projectId: number): Promise<{ branchId: number }[]> {
    const qb = this.reportRepository.createQueryBuilder('report')
      .select('DISTINCT report.branch', 'branchId')
      .where('report.project = :projectId', { projectId });
    return qb.getRawMany();
  }

  async findByProjectId(projectId: number): Promise<Report[]> {
    // Use query builder for better performance - only load essential relations for table view
    // Don't load heavy relations like answers, questions, photos, files - these cause N+1 queries
    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.project', 'project')
      .leftJoinAndSelect('report.status', 'status')
      .leftJoinAndSelect('report.clientCompany', 'clientCompany')
      .leftJoinAndSelect('report.branch', 'branch')
      .leftJoinAndSelect('branch.city', 'branchCity')
      .leftJoinAndSelect('branchCity.country', 'branchCityCountry')
      .leftJoinAndSelect('report.merchandiser', 'merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'merchandiserUser')
      .leftJoinAndSelect('report.answers', 'answers')
      .leftJoinAndSelect('answers.question', 'question')
      .leftJoinAndSelect('answers.selectedOption', 'answerSelectedOption')
      .leftJoinAndSelect('project.questions', 'projectQuestions')
      .leftJoinAndSelect('projectQuestions.answerType', 'projectQuestionAnswerType')
      // Don't load conversation, photos, files for table view - these are heavy
      // These will be loaded on-demand when viewing individual reports
      .where('report.project_id = :projectId', { projectId })
      .orderBy('report.createdAt', 'DESC');

    const entities = await queryBuilder.getMany();
    entities.forEach((entity) => {
      if (entity.project) {
        this.sortProjectRelationsByCreatedAt(entity.project);
      }
    });

    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  async findByProjectIdWithDetails(projectId: number): Promise<Report[]> {
    const entities = await this.reportRepository.find({
      where: { project: { id: projectId } },
      relations: [
        'project',
        'project.questions',
        'project.questions.answerType',
        'project.questions.options',
        'project.photos',
        'project.advancedPhotos',
        'status',
        'clientCompany',
        'branch',
        'branch.city',
        'merchandiser',
        'merchandiser.user',
        'answers',
        'answers.question',
        'answers.question.options',
        'answers.selectedOption',
        'uploadedAdvancedPhotos',
        'uploadedAdvancedPhotos.advancedPhoto',
        'uploadedAdvancedPhotos.file',
      ],
      order: {
        uploadedAdvancedPhotos: {
          order: 'ASC',
        },
      },
    });
    entities.forEach((entity) => {
      if (entity.project) {
        this.sortProjectRelationsByCreatedAt(entity.project);
      }
    });
    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  async findByProjectIdsAndStatus(projectIds: number[], status: number): Promise<Report[]> {

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.project', 'project')
      .leftJoinAndSelect('report.status', 'status')
      .leftJoinAndSelect('report.clientCompany', 'clientCompany')
      .leftJoinAndSelect('report.branch', 'branch')
      .leftJoinAndSelect('branch.city', 'branchCity')
      .leftJoinAndSelect('branchCity.country', 'branchCityCountry')
      .leftJoinAndSelect('report.merchandiser', 'merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'merchandiserUser')
      .where('report.project_id IN (:...projectIds)', { projectIds })
      .andWhere('report.status_id = :status', { status })
      .select([
        'report.id',
        'report.status',
        'report.createdAt',
        'report.updatedAt',
        'report.street',
        'report.zipCode',
        'report.visitDate',
        'report.plannedOn',
        'report.accepted',
        'project.id',
        'project.name',
        'clientCompany.id',
        'clientCompany.name',
        'clientCompany.logo',
        'branch.id',
        'branch.name',
        'merchandiser.id',
        'merchandiserUser.id',
        'merchandiserUser.firstName',
        'merchandiserUser.lastName',
        'status.id',
        'status.name',
        'status.akzenteName',
        'status.clientName',
        'status.merchandiserName',
        'status.akzenteColor',
        'status.clientColor',
        'status.merchandiserColor',
      ]);

    const entities = await qb.getMany();
    const reports: Report[] = entities.map((entity) => ReportMapper.toDomain(entity));

    return reports;
  }

  async findByProjectIdsAndStatuses(projectIds: number[], statuses: number[]): Promise<Report[]> {
    if (!projectIds?.length || !statuses?.length) {
      return [];
    }

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.project', 'project')
      .leftJoinAndSelect('report.status', 'status')
      .leftJoinAndSelect('report.clientCompany', 'clientCompany')
      .leftJoinAndSelect('report.branch', 'branch')
      .leftJoinAndSelect('branch.city', 'branchCity')
      .leftJoinAndSelect('branchCity.country', 'branchCityCountry')
      .leftJoinAndSelect('report.merchandiser', 'merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'merchandiserUser')
      .where('report.project_id IN (:...projectIds)', { projectIds })
      .andWhere('report.status_id IN (:...statuses)', { statuses })
      .select([
        'report.id',
        'report.status',
        'report.createdAt',
        'report.updatedAt',
        'report.street',
        'report.zipCode',
        'report.visitDate',
        'report.plannedOn',
        'report.accepted',
        'project.id',
        'project.name',
        'clientCompany.id',
        'clientCompany.name',
        'clientCompany.logo',
        'branch.id',
        'branch.name',
        'merchandiser.id',
        'merchandiserUser.id',
        'merchandiserUser.firstName',
        'merchandiserUser.lastName',
        'status.id',
        'status.name',
        'status.akzenteName',
        'status.clientName',
        'status.merchandiserName',
        'status.akzenteColor',
        'status.clientColor',
        'status.merchandiserColor',
      ]);

    const entities = await qb.getMany();
    const reports: Report[] = entities.map((entity) => ReportMapper.toDomain(entity));

    return reports;
  }

  async findByProjectIds(projectIds: number[]): Promise<Report[]> {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const entities = await this.reportRepository.find({
      where: { 
        project: { id: In(projectIds) }
      },
      relations: ['project', 'status', 'clientCompany', 'branch', 'branch.city', 'branch.city.country', 'merchandiser'],
    });

    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  async findByBranchId(branchId: number): Promise<Report[]> {
    const entities = await this.reportRepository.find({
      where: { branch: { id: branchId } },
      relations: [
        'project', 
        'status', 
        'clientCompany', 
        'branch',
        'branch.client',
        'branch.city',
        'branch.city.country',
        'merchandiser',
        'merchandiser.user',
        'answers',
        'answers.question',
        'answers.selectedOption',
        'uploadedAdvancedPhotos',
        'uploadedAdvancedPhotos.advancedPhoto',
        'uploadedAdvancedPhotos.file'
      ],
      order: {
        uploadedAdvancedPhotos: {
          order: 'ASC',
        },
      },
    });

    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  /**
   * Optimized query for merchandiser reports - uses QueryBuilder with select to only load essential fields
   * This significantly improves performance by avoiding loading unnecessary relations and data
   */
  async findByMerchandiserId(merchandiserId: number): Promise<Report[]> {
    const entities = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.project', 'project')
      .leftJoinAndSelect('project.clientCompany', 'projectClientCompany')
      .leftJoinAndSelect('report.clientCompany', 'reportClientCompany')
      .leftJoinAndSelect('report.status', 'status')
      .leftJoinAndSelect('report.branch', 'branch')
      .leftJoinAndSelect('branch.city', 'branchCity')
      .leftJoinAndSelect('branchCity.country', 'branchCityCountry')
      .leftJoinAndSelect('branch.client', 'branchClient')
      .leftJoinAndSelect('report.merchandiser', 'merchandiser')
      .leftJoinAndSelect('merchandiser.user', 'merchandiserUser')
      .where('report.merchandiser.id = :merchandiserId', { merchandiserId })
      .select([
        'report.id',
        'report.plannedOn',
        'report.createdAt',
        'report.updatedAt',
        'report.street',
        'report.zipCode',
        'report.note',
        'report.reportTo',
        'report.visitDate',
        'report.feedback',
        'report.accepted',
        'project.id',
        'project.name',
        'project.startDate',
        'project.endDate',
        'projectClientCompany.id',
        'projectClientCompany.name',
        'reportClientCompany.id',
        'reportClientCompany.name',
        'status.id',
        'status.name',
        'status.merchandiserName',
        'status.merchandiserColor',
        'status.akzenteColor',
        'status.clientColor',
        'branch.id',
        'branch.name',
        'branchClient.id',
        'branchClient.name',
        'merchandiser.id',
        'merchandiserUser.id',
        'merchandiserUser.firstName',
        'merchandiserUser.lastName',
        'merchandiserUser.email',
      ])
      .orderBy('report.createdAt', 'DESC')
      // Add reasonable limit to prevent loading excessive data
      // If more reports are needed, implement pagination
      .limit(1000)
      .getMany();

    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  /**
   * Optimized query for dashboard - only loads essential fields and filters by status at DB level
   * Only loads reports with dashboard-relevant statuses:
   * NEW (1), ASSIGNED (2), ACCEPTED (3), DUE (6)
   * This significantly improves performance by reducing data transfer
   */
  async findDashboardReportsByMerchandiserId(merchandiserId: number): Promise<Report[]> {
    // Include ACCEPTED as well because some Anfrage-like records can be in that stage.
    const dashboardStatusIds = [1, 2, 3, 6];
    
    const entities = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.project', 'project')
      .leftJoinAndSelect('project.clientCompany', 'clientCompany')
      .leftJoinAndSelect('report.status', 'status')
      .leftJoinAndSelect('report.merchandiser', 'merchandiser')
      .leftJoinAndSelect('report.branch', 'branch')
      .leftJoinAndSelect('branch.city', 'branchCity')
      .leftJoinAndSelect('branchCity.country', 'branchCityCountry')
      .leftJoinAndSelect('branch.client', 'branchClient')
      .where('merchandiser.id = :merchandiserId', { merchandiserId })
      .andWhere('status.id IN (:...statusIds)', { statusIds: dashboardStatusIds })
      .select([
        'report.id',
        'report.plannedOn',
        'report.createdAt',
        'report.street',
        'report.zipCode',
        'report.note',
        'report.feedback',
        'report.accepted',
        'project.id',
        'project.name',
        'clientCompany.id',
        'clientCompany.name',
        'status.id',
        'status.name',
        'status.merchandiserName',
        'status.merchandiserColor',
        'merchandiser.id',
        'branch.id',
        'branch.name',
        'branchClient.id',
        'branchClient.name',
      ])
      .orderBy('report.plannedOn', 'DESC')
      // Add reasonable limit to prevent loading excessive data
      // Dashboard only shows top 3 for upcoming/new, but we need more for overdue
      .limit(500)
      .getMany();

    return entities.map((entity) => ReportMapper.toDomain(entity));
  }

  async getReportCountsByStatusForProjects(projectIds: number[]): Promise<{ projectId: number; statusId: number; count: number }[]> {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.project_id', 'projectId')
      .addSelect('report.status_id', 'statusId')
      .addSelect('COUNT(report.id)', 'count')
      .where('report.project_id IN (:...projectIds)', { projectIds })
      .groupBy('report.project_id')
      .addGroupBy('report.status_id')
      .getRawMany();

    return result.map(r => ({
      projectId: Number(r.projectId),
      statusId: Number(r.statusId),
      count: Number(r.count)
    }));
  }

  // Count reports per project (not distinct branches)
  async getBranchCountsForProjects(projectIds: number[]): Promise<{ projectId: number; count: number }[]> {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.project_id', 'projectId')
      .addSelect('COUNT(report.id)', 'count')
      .where('report.project_id IN (:...projectIds)', { projectIds })
      .groupBy('report.project_id')
      .getRawMany();

    return result.map(r => ({
      projectId: Number(r.projectId),
      count: Number(r.count)
    }));
  }

  // Count completed reports per project (approved or viewed by customer)
  async getCompletedBranchCountsForProjects(projectIds: number[]): Promise<{ projectId: number; count: number }[]> {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.project_id', 'projectId')
      .addSelect('COUNT(report.id)', 'count')
      .where('report.project_id IN (:...projectIds)', { projectIds })
      .andWhere('report.status_id IN (:...statusIds)', {
        statusIds: [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED],
      })
      .groupBy('report.project_id')
      .getRawMany();

    return result.map(r => ({
      projectId: Number(r.projectId),
      count: Number(r.count)
    }));
  }
}

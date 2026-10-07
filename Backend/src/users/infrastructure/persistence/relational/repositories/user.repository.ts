import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FindOptionsWhere, Repository, In } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from '../../../../dto/query-user.dto';
import { User } from '../../../../domain/user';
import { UserRepository } from '../../user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class UsersRelationalRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(data: User): Promise<User> {
    const persistenceModel = UserMapper.toPersistence(data);
    const newEntity = await this.usersRepository.save(
      this.usersRepository.create(persistenceModel),
    );
    return UserMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<{ data: User[]; totalCount: number }> {
    const where: FindOptionsWhere<UserEntity> = {};

    if (filterOptions?.roles?.length) {
      where.role = filterOptions.roles.map((role) => ({
        id: role.id,
      })) as any;
    }

    if (filterOptions?.userTypes?.length) {
      where.type = filterOptions.userTypes.map((userType) => ({
        id: userType.id,
      })) as any;
    }

    // Handle userType filtering by name
    if (filterOptions?.userTypeNames?.length) {
      where.type = {
        name: In(filterOptions.userTypeNames),
      } as any;
    }

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.type', 'type')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.status', 'status')
      .leftJoinAndSelect('user.photo', 'photo');

    // Apply existing where conditions
    if (Object.keys(where).length > 0) {
      queryBuilder.where(where);
    }

    // Handle general search functionality (first name, last name only)
    if (filterOptions?.search) {
      const searchTerm = `%${filterOptions.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        "(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR CONCAT(LOWER(user.firstName), ' ', LOWER(user.lastName)) LIKE :search)",
        { search: searchTerm },
      );
    }

    // Handle userTypeSearch - search in user type names with LIKE matching
    // But only if userTypeNames is not already set (to avoid conflicts)
    if (
      filterOptions?.userTypeSearch &&
      !filterOptions?.userTypeNames?.length
    ) {
      const typeSearchTerm = `%${filterOptions.userTypeSearch.toLowerCase()}%`;
      queryBuilder.andWhere('LOWER(type.name) LIKE :typeSearch', {
        typeSearch: typeSearchTerm,
      });
    }

    // Apply sorting
    if (sortOptions?.length) {
      sortOptions.forEach((sort, index) => {
        if (index === 0) {
          queryBuilder.orderBy(
            `user.${sort.orderBy}`,
            sort.order.toUpperCase() as 'ASC' | 'DESC',
          );
        } else {
          queryBuilder.addOrderBy(
            `user.${sort.orderBy}`,
            sort.order.toUpperCase() as 'ASC' | 'DESC',
          );
        }
      });
      if (!sortOptions.some((sort) => sort.orderBy === 'id')) {
        queryBuilder.addOrderBy('user.id', 'ASC');
      }
    } else {
      // Default sorting - order by last name, then first name
      queryBuilder.orderBy('user.lastName', 'ASC');
      queryBuilder.addOrderBy('user.firstName', 'ASC');
      queryBuilder.addOrderBy('user.id', 'ASC');
    }

    // Get total count before applying pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination only when a positive limit is provided.
    if (paginationOptions.limit > 0) {
      queryBuilder
        .skip((paginationOptions.page - 1) * paginationOptions.limit)
        .take(paginationOptions.limit);
    }

    const entities = await queryBuilder.getMany();
    return {
      data: entities.map((entity) => UserMapper.toDomain(entity)),
      totalCount,
    };
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const normalizedEmail = email.toLowerCase().trim();

    const entity = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.type', 'type')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.status', 'status')
      .leftJoinAndSelect('user.photo', 'photo')
      .where('LOWER(TRIM(user.email)) = :email', { email: normalizedEmail })
      .getOne();

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    if (!socialId || !provider) return null;

    const entity = await this.usersRepository.findOne({
      where: { socialId, provider },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('User not found');
    }

    const updatedEntity = await this.usersRepository.save(
      this.usersRepository.create(
        UserMapper.toPersistence({
          ...UserMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return UserMapper.toDomain(updatedEntity);
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.softDelete(id);
  }
}

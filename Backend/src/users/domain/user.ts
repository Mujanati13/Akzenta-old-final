import { Exclude, Expose } from 'class-transformer';
import { FileType } from '../../files/domain/file';
import { Role } from '../../roles/domain/role';
import { GenericStatus } from '../../statuses/domain/status';
import { UserType } from '../../user-type/domain/user-type';
import { GenderEnum } from '../enums/gender.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientCompany } from '../../client-company/domain/client-company';

const idType = Number;

export class User {
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
  })
  // @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({
    type: String,
    example: 'email',
  })
  @Expose({ groups: ['me', 'admin'] })
  provider: string;

  @ApiProperty({
    type: String,
    example: '1234567890',
  })
  @Expose({ groups: ['me', 'admin'] })
  socialId?: string | null;

  @ApiProperty({
    type: String,
    example: 'John',
  })
  firstName: string | null;

  @ApiProperty({
    type: String,
    example: 'Doe',
  })
  lastName: string | null;

  @ApiProperty({
    enum: GenderEnum,
    example: GenderEnum.MALE,
  })
  gender?: GenderEnum | null;

  @ApiProperty({
    type: String,
    example: '+1234567890',
  })
  phone?: string | null;

  @ApiProperty({
    type: String,
    example: '+1234567890',
  })
  mobileNumber?: string | null;

  @ApiProperty({
    type: () => UserType,
  })
  type?: UserType;

  @ApiProperty({
    type: () => FileType,
  })
  photo?: FileType | null;

  @ApiProperty({
    type: () => Role,
  })
  role?: Role | null;

  @ApiProperty({
    type: () => GenericStatus,
  })
  status?: GenericStatus;

  @ApiProperty({
    type: [ClientCompany],
    description: 'Favorite client companies (for akzente users)',
  })
  favoriteClientCompanies?: ClientCompany[];

  @ApiProperty({
    type: [ClientCompany],
    description: 'Assigned client companies (for client users)',
  })
  clientCompanies?: ClientCompany[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Sales role flag for client (Kunde) users',
  })
  isSales?: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}

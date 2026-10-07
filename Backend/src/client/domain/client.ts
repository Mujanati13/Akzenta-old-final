import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';

export class Client {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => User,
  })
  user: User;

  @ApiProperty({
    type: Boolean,
    description: 'Indicates if the client user is in sales',
    default: false,
  })
  isSales: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

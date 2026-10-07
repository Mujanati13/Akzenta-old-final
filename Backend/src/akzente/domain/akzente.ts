import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';

export class Akzente {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: () => User,
  })
  user: User;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

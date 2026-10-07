import { Session } from '../../../session/domain/session';
import { User } from '../../../users/domain/user';

export type JwtPayloadType = Pick<User, 'id' | 'role'> & {
  sessionId: Session['id'];
  userType: 'akzente' | 'client' | 'merchandiser';
  iat: number;
  exp: number;
};

import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../common/enums/rol.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

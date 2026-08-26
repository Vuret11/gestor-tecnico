import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Rol } from '../common/enums/rol.enum';

const HASH = bcrypt.hashSync('secreto123', 10);

const MOCK_USER = {
  id: 'user-1',
  nombre: 'Técnico García',
  email: 'garcia@empresa.com',
  password: HASH,
  rol: Rol.TECNICO,
  activo: true,
  telefono: '600000001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let findByEmail: jest.Mock;
  let jwtSign: jest.Mock;

  beforeEach(async () => {
    findByEmail = jest.fn();
    jwtSign     = jest.fn().mockReturnValue('mock-jwt-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail } },
        { provide: JwtService,   useValue: { sign: jwtSign } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ── validateUser ────────────────────────────────────────────────────
  describe('validateUser', () => {
    it('devuelve el usuario sin password cuando las credenciales son correctas', async () => {
      findByEmail.mockResolvedValue(MOCK_USER);

      const result = await service.validateUser(MOCK_USER.email, 'secreto123');

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ id: 'user-1', email: MOCK_USER.email });
    });

    it('devuelve null si el usuario no existe', async () => {
      findByEmail.mockResolvedValue(null);

      expect(await service.validateUser('no@existe.com', 'cualquiera')).toBeNull();
    });

    it('devuelve null si la contraseña es incorrecta', async () => {
      findByEmail.mockResolvedValue(MOCK_USER);

      expect(await service.validateUser(MOCK_USER.email, 'wrongpass')).toBeNull();
    });

    it('devuelve null si el usuario está inactivo', async () => {
      findByEmail.mockResolvedValue({ ...MOCK_USER, activo: false });

      expect(await service.validateUser(MOCK_USER.email, 'secreto123')).toBeNull();
    });
  });

  // ── login ────────────────────────────────────────────────────────────
  describe('login', () => {
    it('devuelve access_token y datos del usuario', async () => {
      const { password: _, ...userWithout } = MOCK_USER;
      const result = await service.login(userWithout);

      expect(jwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: MOCK_USER.email, rol: Rol.TECNICO }),
      );
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user).toMatchObject({ id: 'user-1', rol: Rol.TECNICO });
    });
  });
});

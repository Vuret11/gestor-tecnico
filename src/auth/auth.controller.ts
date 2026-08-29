import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Rol } from '../common/enums/rol.enum';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Login con email y contraseña' })
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req: any, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @ApiOperation({ summary: 'Seed inicial — solo actúa si no hay usuarios' })
  @Post('seed')
  async seed() {
    const users = await this.usersService.findAll();
    if (users.length > 0) return { message: 'Ya existen usuarios, seed omitido' };
    await this.usersService.create({ nombre: 'Administrador', email: 'admin@empresa.com', password: 'Admin1234!', rol: Rol.ADMIN, telefono: '600000001' });
    await this.usersService.create({ nombre: 'Oficina Central', email: 'oficina@empresa.com', password: 'Oficina1234!', rol: Rol.OFICINA, telefono: '600000002' });
    return { message: 'Seed completado', admin: 'admin@empresa.com / Admin1234!' };
  }
}

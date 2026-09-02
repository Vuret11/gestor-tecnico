import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

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

  @ApiOperation({ summary: 'Registrar el token de notificaciones push del dispositivo' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('push-token')
  setPushToken(@CurrentUser() user: { id: string }, @Body('expoPushToken') expoPushToken: string | null) {
    return this.usersService.setPushToken(user.id, expoPushToken ?? null);
  }
}

import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ClassSerializerInterceptor, UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';

@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Crear usuario (solo admin)' })
  @Roles(Rol.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @ApiOperation({ summary: 'Listar todos los usuarios' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Actualizar usuario' })
  @Roles(Rol.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Configurar módulos accesibles para un usuario' })
  @Roles(Rol.ADMIN)
  @Patch(':id/modulos')
  setModulos(@Param('id') id: string, @Body('modulosAcceso') modulosAcceso: string[] | null) {
    return this.usersService.setModulos(id, modulosAcceso);
  }

  @ApiOperation({ summary: 'Desactivar usuario' })
  @Roles(Rol.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

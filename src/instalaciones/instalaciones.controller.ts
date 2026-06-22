import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { InstalacionesService } from './instalaciones.service';
import { CreateInstalacionDto } from './dto/create-instalacion.dto';
import { UpdateInstalacionDto } from './dto/update-instalacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';

@ApiTags('instalaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instalaciones')
export class InstalacionesController {
  constructor(private readonly service: InstalacionesService) {}

  @ApiOperation({ summary: 'Crear instalación' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post()
  create(@Body() dto: CreateInstalacionDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Listar instalaciones activas' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Instalaciones de un cliente' })
  @Get('by-cliente/:clienteId')
  findByCliente(@Param('clienteId') clienteId: string) {
    return this.service.findByCliente(clienteId);
  }

  @ApiOperation({ summary: 'Obtener instalación por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Actualizar instalación' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstalacionDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Desactivar instalación' })
  @Roles(Rol.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

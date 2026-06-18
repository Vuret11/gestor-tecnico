import {
  Controller, Get, Post, Body, Patch, Param, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IncidenciasService } from './incidencias.service';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';
import { UpdateIncidenciaDto } from './dto/update-incidencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('incidencias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidencias')
export class IncidenciasController {
  constructor(private readonly service: IncidenciasService) {}

  @ApiOperation({ summary: 'Crear incidencia' })
  @Post()
  create(@Body() dto: CreateIncidenciaDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Listar todas las incidencias' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Incidencias abiertas y en progreso' })
  @Get('abiertas')
  findAbiertas() {
    return this.service.findAbiertas();
  }

  @ApiOperation({ summary: 'Obtener incidencia por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Actualizar incidencia' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIncidenciaDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Cerrar incidencia con resolución' })
  @Patch(':id/cerrar')
  cerrar(@Param('id') id: string, @Body('resolucion') resolucion: string) {
    return this.service.cerrar(id, resolucion);
  }
}

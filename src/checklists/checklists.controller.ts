import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChecklistsService } from './checklists.service';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { GuardarRespuestasDto } from './dto/guardar-respuestas.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';

@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly service: ChecklistsService) {}

  @ApiOperation({ summary: 'Listar plantillas' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('plantillas')
  findAll() { return this.service.findAllPlantillas(); }

  @ApiOperation({ summary: 'Obtener plantilla por ID' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('plantillas/:id')
  findOne(@Param('id') id: string) { return this.service.findOnePlantilla(id); }

  @ApiOperation({ summary: 'Crear plantilla' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post('plantillas')
  create(@Body() dto: CreatePlantillaDto) { return this.service.createPlantilla(dto); }

  @ApiOperation({ summary: 'Eliminar plantilla (soft delete)' })
  @Roles(Rol.ADMIN)
  @Delete('plantillas/:id')
  delete(@Param('id') id: string) { return this.service.deletePlantilla(id); }

  @ApiOperation({ summary: 'Obtener checklist de una visita' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('visita/:visitaId')
  findByVisita(@Param('visitaId') visitaId: string) { return this.service.findByVisita(visitaId); }

  @ApiOperation({ summary: 'Asignar checklist a una visita' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post('visita/:visitaId')
  createForVisita(
    @Param('visitaId') visitaId: string,
    @Body() body: { plantillaId: string },
  ) { return this.service.createForVisita(visitaId, body.plantillaId); }

  @ApiOperation({ summary: 'Guardar respuestas del checklist' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch('visita/:visitaId')
  guardarRespuestas(
    @Param('visitaId') visitaId: string,
    @Body() dto: GuardarRespuestasDto,
  ) { return this.service.guardarRespuestas(visitaId, dto); }

  @ApiOperation({ summary: 'Marcar checklist como completado' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch('visita/:visitaId/completar')
  completar(@Param('visitaId') visitaId: string) { return this.service.completar(visitaId); }
}

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TareasService } from './tareas.service';
import { CreateTareaDto, UpdateTareaDto } from './dto/tarea.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';
import { EstadoTarea } from './entities/tarea.entity';

@ApiTags('tareas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tareas')
export class TareasController {
  constructor(private readonly service: TareasService) {}

  @ApiOperation({ summary: 'Listar tareas (filtros: proyecto, operario, estado, abiertas)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get()
  findAll(
    @Query('proyecto_id') proyecto_id?: string,
    @Query('operario_id') operario_id?: string,
    @Query('estado') estado?: EstadoTarea,
    @Query('abiertas') abiertas?: string,
  ) {
    return this.service.findAll({ proyecto_id, operario_id, estado, abiertas: abiertas === 'true' });
  }

  @ApiOperation({ summary: 'Carga de trabajo por operario' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('resumen/operarios')
  resumenOperarios() {
    return this.service.resumenOperarios();
  }

  @ApiOperation({ summary: 'Obtener tarea' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Crear tarea' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post()
  create(@Body() dto: CreateTareaDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Actualizar tarea (incluye finalizar)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTareaDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Borrar tarea' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

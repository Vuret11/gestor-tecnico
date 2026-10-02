import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LegalizacionesService } from './legalizaciones.service';
import { CreateLegalizacionDto, UpdateLegalizacionDto } from './dto/legalizacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';
import { EstadoLegalizacion } from './entities/legalizacion.entity';

@ApiTags('legalizaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legalizaciones')
export class LegalizacionesController {
  constructor(private readonly service: LegalizacionesService) {}

  @ApiOperation({ summary: 'Listar expedientes de legalización' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get()
  findAll(@Query('estado') estado?: EstadoLegalizacion, @Query('responsable') responsable?: string) {
    return this.service.findAll({ estado, responsable });
  }

  @ApiOperation({ summary: 'Resumen del apartado (estado, provincia, responsable, documentos)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('resumen')
  resumen() {
    return this.service.resumen();
  }

  @ApiOperation({ summary: 'Obtener expediente' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Crear expediente' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post()
  create(@Body() dto: CreateLegalizacionDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Sincronizar expedientes del CRM (por número de expediente)' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Post('sincronizar')
  sincronizar(@Body() lista: CreateLegalizacionDto[]) {
    return this.service.sincronizar(lista);
  }

  @ApiOperation({ summary: 'Actualizar expediente' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLegalizacionDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Archivar expediente' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

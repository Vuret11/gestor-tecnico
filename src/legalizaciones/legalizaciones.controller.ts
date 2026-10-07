import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LegalizacionesService } from './legalizaciones.service';
import { CreateLegalizacionDto, UpdateLegalizacionDto } from './dto/legalizacion.dto';
import { EtapaLegalizacion } from './entities/registro-etapa.entity';
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
  findAll(
    @Query('estado') estado?: EstadoLegalizacion,
    @Query('responsable') responsable?: string,
    /**
     * `archivados=1` incluye también las instalaciones archivadas. Lo pide el LISTADO del final de
     * Legalizaciones (Salva, 7-oct-2026: «un listado tipo el de la imagen»), que es el registro de lo
     * ya tramitado: por defecto se queda fuera lo archivado, como en el resto del panel.
     */
    @Query('archivados') archivados?: string,
  ) {
    return this.service.findAll({ estado, responsable, conArchivados: archivados === '1' });
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
  // Los ingenieros son de rol TECNICO y son quienes hacen las legalizaciones: sin esto recibían un
  // 403 al pulsar «Crear trámite» y el panel no lo decía (el botón parecía no hacer nada).
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
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
  // El rol `tecnico` entra aquí, pero el servicio exige además el permiso `borrar_legalizaciones` de la
  // ficha del usuario: los ingenieros son 6, no las más de veinte personas con ese rol (7-oct-2026).
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, { id: req.user?.sub ?? req.user?.id, rol: req.user?.rol });
  }

  @ApiOperation({ summary: 'Etapas del trámite (Inicio, Subida Portal, Finalizado) y su registro' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id/etapas')
  etapas(@Param('id') id: string) {
    return this.service.etapas(id);
  }

  /**
   * Marca (o desmarca, con `hecha: false`) una etapa. Cada pulsación deja una fila en el registro con
   * la fecha y quién lo hizo: lo pidió Salva el 7-oct-2026.
   */
  @ApiOperation({ summary: 'Marcar o desmarcar una etapa del trámite' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/etapas/:etapa')
  marcarEtapa(
    @Param('id') id: string,
    @Param('etapa') etapa: EtapaLegalizacion,
    @Body() cuerpo: { hecha?: boolean },
    @Req() req: any,
  ) {
    return this.service.marcarEtapa(id, etapa, cuerpo?.hecha !== false, {
      id: req.user?.sub ?? req.user?.id,
      nombre: req.user?.nombre,
    });
  }
}

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanificacionService } from './planificacion.service';

@ApiTags('planificacion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planificacion')
export class PlanificacionController {
  constructor(private readonly svc: PlanificacionService) {}

  // ── Provincias ──────────────────────────────────────────────────────────────
  @Get('provincias')
  getProvincias() { return this.svc.getProvincias(); }

  @Post('provincias')
  createProvincia(@Body() dto: any) { return this.svc.createProvincia(dto); }

  @Patch('provincias/:id')
  updateProvincia(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateProvincia(id, dto);
  }

  // ── Técnicos ────────────────────────────────────────────────────────────────
  @Get('tecnicos')
  @ApiQuery({ name: 'provinciaId', required: false })
  getTecnicos(@Query('provinciaId') provinciaId?: string) {
    return this.svc.getTecnicos(provinciaId);
  }

  @Post('tecnicos')
  createTecnico(@Body() dto: any) { return this.svc.createTecnico(dto); }

  @Patch('tecnicos/:id')
  updateTecnico(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateTecnico(id, dto);
  }

  @Delete('tecnicos/:id')
  removeTecnico(@Param('id') id: string) { return this.svc.removeTecnico(id); }

  // ── Clientes ────────────────────────────────────────────────────────────────
  @Get('clientes')
  getClientes() { return this.svc.getClientes(); }

  @Post('clientes')
  createCliente(@Body() dto: any) { return this.svc.createCliente(dto); }

  @Patch('clientes/:id')
  updateCliente(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCliente(id, dto);
  }

  @Delete('clientes/:id')
  removeCliente(@Param('id') id: string) { return this.svc.removeCliente(id); }

  // ── Obras ────────────────────────────────────────────────────────────────────
  @Get('obras')
  @ApiQuery({ name: 'provinciaId', required: false })
  @ApiQuery({ name: 'clienteId', required: false })
  getObras(
    @Query('provinciaId') provinciaId?: string,
    @Query('clienteId') clienteId?: string,
  ) { return this.svc.getObras(provinciaId, clienteId); }

  @Post('obras')
  createObra(@Body() dto: any) { return this.svc.createObra(dto); }

  @Patch('obras/:id')
  updateObra(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateObra(id, dto);
  }

  @Delete('obras/:id')
  removeObra(@Param('id') id: string) { return this.svc.removeObra(id); }

  // ── Asignaciones ─────────────────────────────────────────────────────────────
  @Get('asignaciones/semana')
  @ApiQuery({ name: 'desde', required: true })
  @ApiQuery({ name: 'hasta', required: true })
  @ApiQuery({ name: 'provinciaId', required: false })
  getAsignacionesSemana(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('provinciaId') provinciaId?: string,
  ) { return this.svc.getAsignacionesSemana(desde, hasta, provinciaId); }

  @Get('asignaciones/mes')
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'month', required: true })
  @ApiQuery({ name: 'provinciaId', required: false })
  getAsignacionesMes(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('provinciaId') provinciaId?: string,
  ) { return this.svc.getAsignacionesMes(+year, +month, provinciaId); }

  @Get('asignaciones/conflictos')
  getConflictos(@Query('desde') desde: string, @Query('hasta') hasta: string) {
    return this.svc.getConflictos(desde, hasta);
  }

  @Post('asignaciones')
  createAsignacion(@Body() dto: any) { return this.svc.createAsignacion(dto); }

  @Patch('asignaciones/:id')
  updateAsignacion(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateAsignacion(id, dto);
  }

  @Delete('asignaciones/:id')
  removeAsignacion(@Param('id') id: string) { return this.svc.removeAsignacion(id); }

  // ── Importación ────────────────────────────────────────────────────────────
  @Post('importar')
  importar(@Body() dto: { rows: any[] }) {
    return this.svc.importarAsignaciones(dto.rows);
  }
}

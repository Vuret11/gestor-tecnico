import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, ParseBoolPipe, Optional,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { AddVisitaArticuloDto } from './dto/add-visita-articulo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventario')
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

  // ── Almacenes ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Listar almacenes activos' })
  @Get('almacenes')
  findAlmacenes() {
    return this.service.findAlmacenes();
  }

  @ApiOperation({ summary: 'Crear almacén' })
  @Post('almacenes')
  createAlmacen(@Body() dto: CreateAlmacenDto) {
    return this.service.createAlmacen(dto);
  }

  // ── Artículos ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Listar artículos activos' })
  @Get('articulos')
  findAll(@Query('todos') todos?: string) {
    return todos === 'true' ? this.service.findAllIncludingInactivos() : this.service.findAll();
  }

  @ApiOperation({ summary: 'Obtener artículo por ID' })
  @Get('articulos/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Crear artículo' })
  @Post('articulos')
  create(@Body() dto: CreateArticuloDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Actualizar artículo' })
  @Patch('articulos/:id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateArticuloDto>) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Ajustar stock manualmente en un almacén' })
  @Patch('articulos/:id/almacenes/:almacenId')
  ajustarStock(
    @Param('id') id: string,
    @Param('almacenId') almacenId: string,
    @Body('delta') delta?: number,
    @Body('stockMinimo') stockMinimo?: number,
  ) {
    return this.service.ajustarStock(
      id,
      almacenId,
      delta != null ? Number(delta) : undefined,
      stockMinimo != null ? Number(stockMinimo) : undefined,
    );
  }

  @ApiOperation({ summary: 'Desactivar artículo' })
  @Delete('articulos/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Artículos de visita ───────────────────────────────────────────────────

  @ApiOperation({ summary: 'Artículos usados en una visita' })
  @Get('visita/:visitaId')
  findByVisita(@Param('visitaId') visitaId: string) {
    return this.service.findByVisita(visitaId);
  }

  @ApiOperation({ summary: 'Artículos usados en todas las visitas de una instalación' })
  @Get('instalacion/:instalacionId')
  findByInstalacion(@Param('instalacionId') instalacionId: string) {
    return this.service.findByInstalacion(instalacionId);
  }

  @ApiOperation({ summary: 'Añadir artículo a visita (descuenta stock)' })
  @Post('visita/:visitaId')
  addToVisita(@Param('visitaId') visitaId: string, @Body() dto: AddVisitaArticuloDto) {
    return this.service.addToVisita(visitaId, dto);
  }

  @ApiOperation({ summary: 'Quitar artículo de visita (restaura stock)' })
  @Delete('visita/linea/:id')
  removeFromVisita(@Param('id') id: string) {
    return this.service.removeFromVisita(id);
  }

  @ApiOperation({ summary: 'Historial de materiales usados en visitas' })
  @Get('historial')
  historial(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.historial(
      desde ? new Date(desde) : undefined,
      hasta ? new Date(hasta) : undefined,
    );
  }
}

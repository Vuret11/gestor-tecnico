import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { AddVisitaArticuloDto } from './dto/add-visita-articulo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventario')
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

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

  @ApiOperation({ summary: 'Ajustar stock manualmente' })
  @Patch('articulos/:id/stock')
  ajustarStock(@Param('id') id: string, @Body('cantidad') cantidad: number) {
    return this.service.ajustarStock(id, Number(cantidad));
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
}

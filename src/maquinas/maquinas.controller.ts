import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MaquinasService } from './maquinas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('maquinas')
@UseGuards(JwtAuthGuard)
export class MaquinasController {
  constructor(private readonly servicio: MaquinasService) {}

  @Get('fabricantes')
  fabricantes() { return this.servicio.fabricantes(); }

  @Get()
  listar(@Query('fabricante') fabricante?: string) { return this.servicio.listar(fabricante); }

  @Post()
  crear(@Body() dto: any) { return this.servicio.crear(dto); }

  @Delete(':id')
  borrar(@Param('id') id: string) { return this.servicio.borrar(Number(id)); }
}

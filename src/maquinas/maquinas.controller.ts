import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MaquinasService } from './maquinas.service';
import { BuscarFichaService } from './buscar-ficha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('maquinas')
@UseGuards(JwtAuthGuard)
export class MaquinasController {
  constructor(
    private readonly servicio: MaquinasService,
    private readonly fichas: BuscarFichaService,
  ) {}

  @Get('fabricantes')
  fabricantes() { return this.servicio.fabricantes(); }

  // ── Máquinas que NO están en el catálogo: buscar y leer su ficha técnica (7-oct-2026) ──────────
  // El alta de un trámite puede llevar una máquina que no está en el catálogo. Antes se tecleaban a
  // mano sus datos; ahora el panel busca la ficha del fabricante y lee de ella lo que publica, con la
  // evidencia de cada valor, y el instalador confirma. Guardar es el `POST /maquinas` de siempre.

  @Get('buscar-fichas')
  buscarFichas(@Query('fabricante') fabricante?: string, @Query('modelo') modelo?: string) {
    return this.fichas.buscar(fabricante ?? '', modelo ?? '');
  }

  @Post('leer-ficha')
  leerFicha(@Body() cuerpo: any) {
    return this.fichas.leer(
      String(cuerpo?.url ?? '').trim(),
      String(cuerpo?.fabricante ?? '').trim(),
      String(cuerpo?.modelo ?? '').trim(),
    );
  }

  /** La ficha descargada en el PC del instalador: el camino que funciona cuando la búsqueda no da nada. */
  @Post('subir-ficha')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
  }))
  subirFicha(@UploadedFile() file: any, @Body() cuerpo: any) {
    if (!file?.buffer?.length) throw new BadRequestException('No ha llegado ningún fichero');
    return this.fichas.leerSubido(
      file.buffer,
      String(file.originalname ?? 'ficha.pdf'),
      String(cuerpo?.fabricante ?? '').trim(),
      String(cuerpo?.modelo ?? '').trim(),
    );
  }

  @Get()
  listar(@Query('fabricante') fabricante?: string) { return this.servicio.listar(fabricante); }

  @Post()
  crear(@Body() dto: any) { return this.servicio.crear(dto); }

  @Delete(':id')
  borrar(@Param('id') id: string) { return this.servicio.borrar(Number(id)); }
}

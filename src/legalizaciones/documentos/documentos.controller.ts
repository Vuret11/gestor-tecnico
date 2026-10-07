import { Body, Controller, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs/promises';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Rol } from '../../common/enums/rol.enum';
import { GeneradorDocumentosService } from './generador.service';
import { NOMBRE_DOCUMENTO, TIPOS_DOCUMENTO, datosQueFaltan } from './armador';
import type { ConfigFija, TipoDocumento, TramiteParaDocumentos } from './armador';

/**
 * Documentos oficiales de legalización, generados en la Pi.
 *
 * Prefijo propio (`documentos-legalizacion`) para no chocar con `GET /legalizaciones/:id`.
 */
@ApiTags('documentos-legalizacion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documentos-legalizacion')
export class DocumentosController {
  constructor(private readonly generador: GeneradorDocumentosService) {}

  @ApiOperation({ summary: 'Ver la configuración fija (empresa y personas) de los documentos' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('config')
  verConfig() {
    return this.generador.configFija();
  }

  @ApiOperation({ summary: 'Guardar la configuración fija (empresa y personas)' })
  @Roles(Rol.ADMIN)
  @Put('config')
  guardarConfig(@Body() datos: ConfigFija) {
    return this.generador.guardarConfigFija(datos);
  }

  @ApiOperation({ summary: 'Qué documentos tiene ya generados el trámite y qué datos le faltan' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('tramite/:id')
  async estado(@Param('id') id: string) {
    const tramite = await this.generador.tramite(id);
    return {
      id: tramite.id,
      num_obra: tramite.num_obra,
      cliente: tramite.cliente,
      generados: tramite.documentos_generados ?? {},
      faltan_datos: datosQueFaltan(tramite as unknown as TramiteParaDocumentos),
      documentos: (await this.generador.documentosCorrespondientes(tramite)).map((tipo) => ({
        tipo,
        nombre: NOMBRE_DOCUMENTO[tipo],
        generado: (tramite.documentos_generados ?? {})[tipo] ?? null,
      })),
    };
  }

  @ApiOperation({ summary: 'Generar los seis documentos y guardarlos' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post('tramite/:id')
  generarTodos(@Param('id') id: string) {
    return this.generador.generarYGuardarTodos(id);
  }

  @ApiOperation({ summary: 'Generar un documento y descargarlo' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post('tramite/:id/:tipo')
  async generarUno(@Param('id') id: string, @Param('tipo') tipo: TipoDocumento, @Res() res: Response) {
    const pdf = await this.generador.generarPdf(id, tipo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tipo}.pdf"`);
    res.send(pdf);
  }

  @ApiOperation({ summary: 'Descargar un documento ya generado' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('tramite/:id/:tipo/descargar')
  async descargar(@Param('id') id: string, @Param('tipo') tipo: TipoDocumento, @Res() res: Response) {
    const ruta = await this.generador.rutaPdfGuardado(id, tipo);
    const pdf = await fs.readFile(ruta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tipo}.pdf"`);
    res.send(pdf);
  }
}

import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { IngenieriaService } from './ingenieria.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { GuardarMedicionesDto, MedicionDto, RetencionDto, UpdateFaseDto } from './dto/ficha.dto';
import { CreateHitoDto, HitoDto } from './dto/hito.dto';
import { CreateNotaDto, NotaDto } from './dto/nota.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';

/**
 * OJO con el orden: las rutas con texto fijo («resumen-obras», «fases/:id», «sembrar-fases»…) van
 * ANTES de las de `:id`, que si no se las come el comodín.
 */
@ApiTags('ingenieria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ingenieria')
export class IngenieriaController {
  constructor(private readonly service: IngenieriaService) {}

  // ── Pantalla de seguimiento ───────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Indicadores de la cabecera (clientes activos, obras activas, márgenes…)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('resumen-obras')
  resumenObras() {
    return this.service.resumenObras();
  }

  @ApiOperation({ summary: 'Estado (finalizada / fase actual) de todas las obras' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('estados')
  estados() {
    return this.service.estados();
  }

  @ApiOperation({ summary: 'Siguiente número de obra libre (OB-AAAA-NNN)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('siguiente-numero')
  async siguienteNumero() {
    return { num_obra: await this.service.siguienteNumObra() };
  }

  @ApiOperation({ summary: 'Crear las 7 fases de las obras que aún no las tengan' })
  @Roles(Rol.ADMIN)
  @Post('sembrar-fases')
  sembrarFases() {
    return this.service.sembrarFasesDeTodas();
  }

  @ApiOperation({ summary: 'Poner los 4 hitos de siempre a las obras que no los tengan (sin fecha)' })
  @Roles(Rol.ADMIN)
  @Post('sembrar-hitos')
  sembrarHitos() {
    return this.service.sembrarHitosDeTodas();
  }

  // ── Fases ─────────────────────────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Actualizar las fechas de una fase de obra' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch('fases/:faseId')
  actualizarFase(@Param('faseId') faseId: string, @Body() dto: UpdateFaseDto) {
    return this.service.actualizarFase(faseId, dto);
  }

  // ── Hitos (los rombos del Gantt) ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Añadir un hito a la obra' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/hitos')
  crearHito(@Param('id') id: string, @Body() dto: CreateHitoDto) {
    return this.service.crearHito(id, dto);
  }

  @ApiOperation({ summary: 'Actualizar un hito (fecha, nombre o si ya se ha conseguido)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch('hitos/:id')
  actualizarHito(@Param('id') id: string, @Body() dto: HitoDto) {
    return this.service.actualizarHito(id, dto);
  }

  @ApiOperation({ summary: 'Borrar un hito' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete('hitos/:id')
  borrarHito(@Param('id') id: string) {
    return this.service.borrarHito(id);
  }

  // ── Notas de la obra (el bloc de notas de la ficha) ───────────────────────────────────────────

  @ApiOperation({ summary: 'Añadir una nota a la obra' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/notas')
  crearNota(@Param('id') id: string, @Body() dto: CreateNotaDto) {
    return this.service.crearNota(id, dto);
  }

  @ApiOperation({ summary: 'Editar una nota' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch('notas/:id')
  actualizarNota(@Param('id') id: string, @Body() dto: NotaDto) {
    return this.service.actualizarNota(id, dto);
  }

  @ApiOperation({ summary: 'Borrar una nota' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete('notas/:id')
  borrarNota(@Param('id') id: string) {
    return this.service.borrarNota(id);
  }

  // ── Retenciones ───────────────────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Borrar una retención' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete('retenciones/:id')
  borrarRetencion(@Param('id') id: string) {
    return this.service.borrarRetencion(id);
  }

  @ApiOperation({ summary: 'Actualizar una retención' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch('retenciones/:id')
  actualizarRetencion(@Param('id') id: string, @Body() dto: RetencionDto) {
    return this.service.actualizarRetencion(id, dto);
  }

  // ── Mediciones vs planos ──────────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Borrar una partida del informe de mediciones' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete('mediciones/:id')
  borrarMedicion(@Param('id') id: string) {
    return this.service.borrarMedicion(id);
  }

  // ── Listado y CRUD de obras ───────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Listar proyectos de ingeniería' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get()
  findAll(@Query('todos') todos?: string) {
    return this.service.findAll(todos === 'true');
  }

  @ApiOperation({ summary: 'Ficha completa de una obra (fases, retenciones, mediciones, documentos)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id/ficha')
  ficha(@Param('id') id: string) {
    return this.service.ficha(id);
  }

  @ApiOperation({ summary: 'Obtener proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Crear proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post()
  create(@Body() dto: CreateProyectoDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Actualizar proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProyectoDto>) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Archivar proyecto' })
  @Roles(Rol.ADMIN, Rol.OFICINA)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Retenciones y mediciones de una obra ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Añadir una retención a la obra' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/retenciones')
  crearRetencion(@Param('id') id: string, @Body() dto: RetencionDto) {
    return this.service.crearRetencion(id, dto);
  }

  @ApiOperation({ summary: 'Guardar el informe de mediciones vs planos de la obra (reemplaza el anterior)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/mediciones')
  guardarMediciones(@Param('id') id: string, @Body() dto: GuardarMedicionesDto) {
    return this.service.guardarMediciones(id, dto);
  }

  @ApiOperation({ summary: 'Añadir una partida al informe de mediciones de la obra' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/mediciones/una')
  anadirMedicion(@Param('id') id: string, @Body() dto: MedicionDto) {
    return this.service.anadirMedicion(id, dto);
  }

  // ── Documentación de la obra ──────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Subir documentación de la obra (.xlsx, .pdf, .dwg)' })
  @ApiConsumes('multipart/form-data')
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/documentos')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      // Un cajón por obra: uploads/obras/<id de la obra>/
      destination: (req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'obras', String(req.params.id));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 80 * 1024 * 1024 },
  }))
  subirDocumento(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.guardarDocumento(id, file);
  }

  @ApiOperation({ summary: 'Quitar un documento de la obra (y del disco)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete(':id/documentos/:docId')
  borrarDocumento(@Param('id') id: string, @Param('docId') docId: string) {
    return this.service.borrarDocumento(id, docId);
  }
}

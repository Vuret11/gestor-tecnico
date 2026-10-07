import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomologacionesService } from './homologaciones.service';
import { CreateHomologacionDto, UpdateHomologacionDto } from './dto/homologacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../common/enums/rol.enum';
import { EstadoHomologacion } from './entities/homologacion.entity';

/**
 * Homologaciones: el segundo apartado de Ingeniería (junto a Obras y Legalizaciones).
 * Los ingenieros son de rol TECNICO y son los usuarios reales del apartado, así que TODO
 * el CRUD (incluido borrar) lleva TECNICO: con los permisos de legalizaciones recibían 403
 * en el botón y el panel no lo decía.
 */
@ApiTags('homologaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('homologaciones')
export class HomologacionesController {
  constructor(private readonly service: HomologacionesService) {}

  @ApiOperation({ summary: 'Listar obras de homologación' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get()
  findAll(
    @Query('estado') estado?: EstadoHomologacion,
    @Query('responsable') responsable?: string,
    @Query('instalacion') instalacion?: string,
    @Query('proyecto_id') proyectoId?: string,
  ) {
    return this.service.findAll({ estado, responsable, instalacion, proyecto_id: proyectoId });
  }

  @ApiOperation({ summary: 'Resumen del apartado (estado, instalación, impacto económico)' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get('resumen')
  resumen() {
    return this.service.resumen();
  }

  @ApiOperation({ summary: 'Descargar el informe en PDF: mediciones, cumplimiento o completo' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  // Va antes de `@Get(':id')` para que no lo capture la ruta del expediente.
  @Get(':id/informe/:tipo')
  async informe(@Param('id') id: string, @Param('tipo') tipo: string, @Res() res: Response) {
    const { buffer, nombre } = await this.service.informePdf(id, tipo);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombre}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @ApiOperation({ summary: 'Obtener una obra de homologación' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Dar de alta una obra de homologación' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post()
  create(@Body() dto: CreateHomologacionDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Subir la documentación de la obra (Excel, PDF o DWG/DXF)' })
  @ApiConsumes('multipart/form-data')
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/archivos')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      // Un cajón por trámite: uploads/homologaciones/<id>/ y el nombre original se guarda aparte.
      destination: (req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'homologaciones', String(req.params.id));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    // Los planos y los PDF de memoria pueden pesar: 80 MB por archivo.
    limits: { fileSize: 80 * 1024 * 1024 },
  }))
  subirArchivo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.guardarArchivo(id, file);
  }

  @ApiOperation({ summary: 'Analizar la documentación del trámite: resultado por instalación' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Post(':id/analizar')
  analizar(@Param('id') id: string) {
    return this.service.analizar(id);
  }

  @ApiOperation({ summary: 'Quitar un archivo de la documentación de la obra' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete(':id/archivos/:indice')
  borrarArchivo(@Param('id') id: string, @Param('indice') indice: string) {
    return this.service.borrarArchivo(id, Number(indice));
  }

  @ApiOperation({ summary: 'Actualizar una obra de homologación' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHomologacionDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Eliminar (borrado lógico) una obra de homologación' })
  @Roles(Rol.ADMIN, Rol.OFICINA, Rol.TECNICO)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
  UseInterceptors, UploadedFile, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RepositorioService } from './repositorio.service';
import { CreateCarpetaDto } from './dto/create-carpeta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('repositorio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('repositorio')
export class RepositorioController {
  constructor(private readonly service: RepositorioService) {}

  // ── Carpetas ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Listar carpetas' })
  @Get('carpetas')
  findAllCarpetas() {
    return this.service.findAllCarpetas();
  }

  @ApiOperation({ summary: 'Crear carpeta' })
  @Post('carpetas')
  createCarpeta(@Body() dto: CreateCarpetaDto) {
    return this.service.createCarpeta(dto);
  }

  @ApiOperation({ summary: 'Editar carpeta' })
  @Patch('carpetas/:id')
  updateCarpeta(@Param('id') id: string, @Body() dto: Partial<CreateCarpetaDto>) {
    return this.service.updateCarpeta(id, dto);
  }

  @ApiOperation({ summary: 'Eliminar carpeta y sus archivos' })
  @Delete('carpetas/:id')
  removeCarpeta(@Param('id') id: string) {
    return this.service.removeCarpeta(id);
  }

  // ── Archivos ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Listar archivos de una carpeta' })
  @Get('carpetas/:id/archivos')
  findByCarpeta(@Param('id') id: string) {
    return this.service.findByCarpeta(id);
  }

  @ApiOperation({ summary: 'Subir archivo a carpeta' })
  @ApiConsumes('multipart/form-data')
  @Post('carpetas/:id/archivos')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadArchivo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.service.uploadArchivo(id, file, req.user?.sub ?? req.user?.id);
  }

  @ApiOperation({ summary: 'Eliminar archivo' })
  @Delete('archivos/:id')
  removeArchivo(@Param('id') id: string) {
    return this.service.removeArchivo(id);
  }
}

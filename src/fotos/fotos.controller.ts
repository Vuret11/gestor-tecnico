import {
  Controller, Get, Post, Body, Param, Delete, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FotosService } from './fotos.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const uploadsDir = join(process.cwd(), 'uploads');

@ApiTags('fotos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fotos')
export class FotosController {
  constructor(private readonly service: FotosService) {}

  @ApiOperation({ summary: 'Subir foto de visita (multipart) o registrar URL' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `foto-${unique}${extname(file.originalname)}`);
      },
    }),
  }))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateFotoDto,
  ) {
    const url = file ? `/uploads/${file.filename}` : (dto.url ?? '');
    return this.service.create({ ...dto, url });
  }

  @ApiOperation({ summary: 'Fotos de una visita' })
  @Get('visita/:visitaId')
  findByVisita(@Param('visitaId') visitaId: string) {
    return this.service.findByVisita(visitaId);
  }

  @ApiOperation({ summary: 'Obtener foto por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Eliminar foto' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

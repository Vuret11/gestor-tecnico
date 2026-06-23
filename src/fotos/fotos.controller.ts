import {
  Controller, Get, Post, Body, Param, Delete, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FotosService } from './fotos.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const uploadsDir = join(process.cwd(), 'uploads');
const useCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

@ApiTags('fotos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fotos')
export class FotosController {
  constructor(private readonly service: FotosService) {}

  @ApiOperation({ summary: 'Subir foto de visita (multipart) o registrar URL' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: useCloudinary
        ? memoryStorage()
        : diskStorage({
            destination: (req, file, cb) => {
              if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
              cb(null, uploadsDir);
            },
            filename: (req, file, cb) => {
              const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
              cb(null, `foto-${unique}${extname(file.originalname)}`);
            },
          }),
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateFotoDto,
  ) {
    let url = dto.url ?? '';

    if (file) {
      if (useCloudinary) {
        const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'gestor-tecnico', resource_type: 'auto' },
            (error, res) => {
              if (error || !res) reject(error ?? new Error('Cloudinary upload failed'));
              else resolve(res);
            },
          );
          stream.end(file.buffer);
        });
        url = result.secure_url;
      } else {
        url = `/uploads/${file.filename}`;
      }
    }

    const nombre = dto.nombre ?? file?.originalname ?? undefined;
    const tipo = dto.tipo ?? (file?.mimetype?.startsWith('image/') ? 'foto' : 'documento');
    return this.service.create({ ...dto, url, nombre, tipo });
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

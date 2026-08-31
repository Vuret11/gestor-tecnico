import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { Foto } from './entities/foto.entity';
import { CreateFotoDto } from './dto/create-foto.dto';

// Extrae public_id y resource_type de una URL de Cloudinary
// Ejemplo: https://res.cloudinary.com/mycloud/image/upload/v123/gestor-tecnico/foto-abc.jpg
//   → { publicId: 'gestor-tecnico/foto-abc', resourceType: 'image' }
function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } | null {
  const match = url.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;
  return {
    resourceType: match[1],
    publicId: match[2].replace(/\.[^.]+$/, ''),
  };
}

@Injectable()
export class FotosService {
  constructor(
    @InjectRepository(Foto) private repo: Repository<Foto>,
  ) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  create(dto: CreateFotoDto): Promise<Foto> {
    return this.repo.save(this.repo.create(dto));
  }

  findByVisita(visita_id: string, soloVisiblesTecnico = false): Promise<Foto[]> {
    return this.repo.find({
      where: soloVisiblesTecnico ? { visita_id, visibleTecnico: true } : { visita_id },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Foto> {
    const foto = await this.repo.findOne({ where: { id } });
    if (!foto) throw new NotFoundException(`Foto ${id} no encontrada`);
    return foto;
  }

  async remove(id: string): Promise<void> {
    const foto = await this.findOne(id);
    await this.deleteStoredFile(foto.url);
    await this.repo.remove(foto);
  }

  private async deleteStoredFile(url: string): Promise<void> {
    if (!url) return;

    const cloudInfo = parseCloudinaryUrl(url);
    if (cloudInfo) {
      await cloudinary.uploader
        .destroy(cloudInfo.publicId, { resource_type: cloudInfo.resourceType as any })
        .catch(() => {});
      return;
    }

    if (url.startsWith('/uploads/')) {
      await unlink(join(process.cwd(), url)).catch(() => {});
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { RepoCarpeta } from './entities/repo-carpeta.entity';
import { RepoArchivo } from './entities/repo-archivo.entity';
import { CreateCarpetaDto } from './dto/create-carpeta.dto';

function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } | null {
  const match = url.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;
  return { resourceType: match[1], publicId: match[2].replace(/\.[^.]+$/, '') };
}

@Injectable()
export class RepositorioService {
  constructor(
    @InjectRepository(RepoCarpeta) private carpetaRepo: Repository<RepoCarpeta>,
    @InjectRepository(RepoArchivo) private archivoRepo: Repository<RepoArchivo>,
  ) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  // ── Carpetas ──────────────────────────────────────────────────────────────

  findAllCarpetas(): Promise<RepoCarpeta[]> {
    return this.carpetaRepo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  createCarpeta(dto: CreateCarpetaDto): Promise<RepoCarpeta> {
    return this.carpetaRepo.save(this.carpetaRepo.create(dto));
  }

  async updateCarpeta(id: string, dto: Partial<CreateCarpetaDto>): Promise<RepoCarpeta> {
    const carpeta = await this.carpetaRepo.findOne({ where: { id } });
    if (!carpeta) throw new NotFoundException(`Carpeta ${id} no encontrada`);
    Object.assign(carpeta, dto);
    return this.carpetaRepo.save(carpeta);
  }

  async removeCarpeta(id: string): Promise<void> {
    const archivos = await this.archivoRepo.find({ where: { carpeta_id: id } });
    for (const a of archivos) await this.deleteCloudinaryFile(a.url);
    await this.archivoRepo.delete({ carpeta_id: id });
    await this.carpetaRepo.delete(id);
  }

  // ── Archivos ──────────────────────────────────────────────────────────────

  findByCarpeta(carpeta_id: string): Promise<RepoArchivo[]> {
    return this.archivoRepo.find({
      where: { carpeta_id },
      relations: { subidoPor: true },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadArchivo(
    carpeta_id: string,
    file: Express.Multer.File,
    subidoPor_id?: string,
  ): Promise<RepoArchivo> {
    const carpeta = await this.carpetaRepo.findOne({ where: { id: carpeta_id } });
    if (!carpeta) throw new NotFoundException(`Carpeta ${carpeta_id} no encontrada`);

    let url: string;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      // Cloudinary bloquea por seguridad la entrega de PDF/ZIP subidos como 'image' o 'auto';
      // 'raw' sirve el archivo tal cual y evita el bloqueo.
      const resourceType = file.mimetype?.startsWith('image/') ? 'auto' : 'raw';
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'gestor-tecnico/repositorio', resource_type: resourceType },
          (error, res) => {
            if (error || !res) reject(error ?? new Error('Upload failed'));
            else resolve(res);
          },
        );
        stream.end(file.buffer);
      });
      url = result.secure_url;
    } else {
      url = `/uploads/${Date.now()}-${file.originalname}`;
    }

    return this.archivoRepo.save(this.archivoRepo.create({
      carpeta_id,
      nombre: file.originalname,
      url,
      tipo: file.mimetype,
      tamaño: file.size,
      subidoPor_id: subidoPor_id ?? undefined,
    }));
  }

  async removeArchivo(id: string): Promise<void> {
    const archivo = await this.archivoRepo.findOne({ where: { id } });
    if (!archivo) throw new NotFoundException(`Archivo ${id} no encontrado`);
    await this.deleteCloudinaryFile(archivo.url);
    await this.archivoRepo.remove(archivo);
  }

  private async deleteCloudinaryFile(url: string): Promise<void> {
    const info = parseCloudinaryUrl(url);
    if (info) {
      await cloudinary.uploader.destroy(info.publicId, { resource_type: info.resourceType as any }).catch(() => {});
    }
  }
}

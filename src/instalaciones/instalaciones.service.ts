import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { Instalacion } from './entities/instalacion.entity';
import { CreateInstalacionDto } from './dto/create-instalacion.dto';
import { UpdateInstalacionDto } from './dto/update-instalacion.dto';

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalacion) private repo: Repository<Instalacion>,
    private dataSource: DataSource,
  ) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  async create(dto: CreateInstalacionDto): Promise<Instalacion> {
    const saved = await this.repo.save(this.repo.create(dto));
    return this.findOne(saved.id);
  }

  findAll(): Promise<Instalacion[]> {
    return this.repo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<Instalacion> {
    const inst = await this.repo.findOne({ where: { id } });
    if (!inst) throw new NotFoundException(`Instalación ${id} no encontrada`);
    return inst;
  }

  async update(id: string, dto: UpdateInstalacionDto): Promise<Instalacion> {
    const inst = await this.findOne(id);
    Object.assign(inst, dto);
    await this.repo.save(inst);
    return this.findOne(id);
  }

  findByCliente(clienteId: string): Promise<Instalacion[]> {
    return this.repo.find({ where: { clienteId, activo: true }, order: { nombre: 'ASC' } });
  }

  async uploadMemoriaTecnica(id: string, file: Express.Multer.File): Promise<Instalacion> {
    const inst = await this.findOne(id);

    let url: string;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'gestor-tecnico/instalaciones', resource_type: 'auto' },
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

    inst.memoriaTecnicaUrl = url;
    inst.memoriaTecnicaNombre = file.originalname;
    await this.repo.save(inst);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.dataSource.transaction(async em => {
      // Visitas vinculadas
      const visitas: { id: string }[] = await em.query(
        'SELECT id FROM visitas WHERE instalacion_id = $1', [id],
      );
      if (visitas.length > 0) {
        const vIds = visitas.map(v => v.id);
        await em.query('DELETE FROM fotos WHERE visita_id = ANY($1)', [vIds]);
        await em.query(
          'DELETE FROM visita_checklists WHERE "visitaId" = ANY($1::varchar[])',
          [vIds.map(String)],
        );
        await em.query('DELETE FROM informes WHERE visita_id = ANY($1)', [vIds]);
        await em.query('DELETE FROM visitas WHERE instalacion_id = $1', [id]);
      }

      // Plan-obras vinculadas: soft-delete para conservar historial de planificación
      const obras: { id: string }[] = await em.query(
        'SELECT id FROM plan_obras WHERE instalacion_id = $1 AND activo = true', [id],
      );
      if (obras.length > 0) {
        const oIds = obras.map(o => o.id);
        // Eliminar asignaciones futuras pendientes de esas obras
        await em.query(
          'DELETE FROM plan_asignaciones WHERE obra_id = ANY($1) AND fecha >= CURRENT_DATE',
          [oIds],
        );
        // Marcar obras como inactivas en lugar de borrarlas
        await em.query('UPDATE plan_obras SET activo = false WHERE instalacion_id = $1', [id]);
      }

      // Incidencias vinculadas
      await em.query('DELETE FROM incidencias WHERE instalacion_id = $1', [id]);

      await em.query('DELETE FROM instalaciones WHERE id = $1', [id]);
    });
  }
}

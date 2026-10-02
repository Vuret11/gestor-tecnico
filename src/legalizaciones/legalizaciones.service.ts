import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Legalizacion, EstadoLegalizacion } from './entities/legalizacion.entity';
import { CreateLegalizacionDto, UpdateLegalizacionDto } from './dto/legalizacion.dto';

@Injectable()
export class LegalizacionesService {
  constructor(@InjectRepository(Legalizacion) private repo: Repository<Legalizacion>) {}

  findAll(f: { estado?: EstadoLegalizacion; responsable?: string }) {
    const where: any = { activo: true };
    if (f.estado) where.estado = f.estado;
    if (f.responsable) where.responsable = f.responsable;
    return this.repo.find({ where, order: { id_externo: 'ASC' } });
  }

  async findOne(id: string): Promise<Legalizacion> {
    const l = await this.repo.findOne({ where: { id } });
    if (!l) throw new NotFoundException(`Legalización ${id} no encontrada`);
    return l;
  }

  create(dto: CreateLegalizacionDto): Promise<Legalizacion> {
    // FECHA_INICIO_AUTOMATICA: el tramite empieza el dia que se crea (no se teclea)
    if (!dto.fecha_inicio) dto.fecha_inicio = new Date().toISOString().slice(0, 10);
    const l = new Legalizacion();
    Object.assign(l, dto);
    return this.repo.save(l);
  }

  async update(id: string, dto: UpdateLegalizacionDto): Promise<Legalizacion> {
    const l = await this.findOne(id);
    Object.assign(l, dto);
    return this.repo.save(l);
  }

  async remove(id: string): Promise<void> {
    const l = await this.findOne(id);
    l.activo = false;
    await this.repo.save(l);
  }

  /** Resumen para el cuadro de mando del apartado. */
  async resumen() {
    const todas = await this.repo.find({ where: { activo: true } });
    const porEstado: Record<string, number> = {};
    const porProvincia: Record<string, number> = {};
    const porResponsable: Record<string, number> = {};
    let docsListos = 0, docsTotal = 0, parados = 0;
    for (const l of todas) {
      porEstado[l.estado] = (porEstado[l.estado] ?? 0) + 1;
      const p = l.provincia || 'Sin provincia';
      porProvincia[p] = (porProvincia[p] ?? 0) + 1;
      const r = l.responsable || 'Sin asignar';
      porResponsable[r] = (porResponsable[r] ?? 0) + 1;
      docsListos += l.n_listo ?? 0;
      docsTotal += l.n_total ?? 0;
      if (l.parado) parados++;
    }
    return {
      total: todas.length,
      porEstado, porProvincia, porResponsable,
      documentos: { listos: docsListos, total: docsTotal },
      parados,
    };
  }

  /** Sincroniza una lista de expedientes del CRM por id_externo (crea o actualiza). */
  async sincronizar(lista: CreateLegalizacionDto[]) {
    let creados = 0, actualizados = 0;
    for (const dto of lista) {
      if (dto.id_externo == null) continue;
      const existe = await this.repo.findOne({ where: { id_externo: dto.id_externo } });
      if (existe) {
        Object.assign(existe, dto);
        await this.repo.save(existe);
        actualizados++;
      } else {
        const l = new Legalizacion();
        Object.assign(l, dto);
        await this.repo.save(l);
        creados++;
      }
    }
    return { creados, actualizados, total: lista.length };
  }
}

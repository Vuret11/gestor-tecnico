import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Tarea, EstadoTarea } from './entities/tarea.entity';
import { CreateTareaDto, UpdateTareaDto } from './dto/tarea.dto';

@Injectable()
export class TareasService {
  constructor(@InjectRepository(Tarea) private repo: Repository<Tarea>) {}

  findAll(f: { proyecto_id?: string; operario_id?: string; estado?: EstadoTarea; abiertas?: boolean }) {
    const where: any = {};
    if (f.proyecto_id) where.proyecto_id = f.proyecto_id;
    if (f.operario_id) where.operario_id = f.operario_id;
    if (f.estado) where.estado = f.estado;
    if (f.abiertas) where.estado = Not(EstadoTarea.HECHA);
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Tarea> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Tarea ${id} no encontrada`);
    return t;
  }

  create(dto: CreateTareaDto): Promise<Tarea> {
    const t = new Tarea();
    Object.assign(t, dto);
    if (t.estado === EstadoTarea.HECHA) t.completada_en = new Date();
    return this.repo.save(t);
  }

  async update(id: string, dto: UpdateTareaDto): Promise<Tarea> {
    const t = await this.findOne(id);
    Object.assign(t, dto);
    if (t.estado === EstadoTarea.HECHA && !t.completada_en) t.completada_en = new Date();
    if (t.estado !== EstadoTarea.HECHA) t.completada_en = null as any;
    if (dto.operario_id) t.operario = { id: dto.operario_id } as any;
    return this.repo.save(t);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(await this.findOne(id));
  }

  /** Carga de trabajo: tareas abiertas y hechas por operario. */
  async resumenOperarios() {
    const tareas = await this.repo.find();
    const mapa = new Map<string, { operario_id: string | null; nombre: string; abiertas: number; hechas: number; total: number }>();
    for (const t of tareas) {
      const nombres = (t.responsables ?? []).length
        ? t.responsables
        : [t.operario?.nombre ?? 'Sin asignar'];
      for (const nombre of nombres) {
        if (!mapa.has(nombre)) {
          mapa.set(nombre, { operario_id: null, nombre, abiertas: 0, hechas: 0, total: 0 });
        }
        const f = mapa.get(nombre)!;
        f.total++;
        if (t.estado === EstadoTarea.HECHA) f.hechas++; else f.abiertas++;
      }
    }
    return [...mapa.values()].sort((a, b) => b.abiertas - a.abiertas || b.total - a.total);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistPlantilla } from './entities/checklist-plantilla.entity';
import { VisitaChecklist } from './entities/visita-checklist.entity';
import { VisitaRespuesta } from './entities/visita-respuesta.entity';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { GuardarRespuestasDto } from './dto/guardar-respuestas.dto';

const PLANTILLA_RELATIONS = { secciones: { items: true } } as const;
const VC_RELATIONS = {
  plantilla: { secciones: { items: true } },
  respuestas: { item: true },
} as const;

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(ChecklistPlantilla) private plantillasRepo: Repository<ChecklistPlantilla>,
    @InjectRepository(VisitaChecklist) private vcRepo: Repository<VisitaChecklist>,
    @InjectRepository(VisitaRespuesta) private respRepo: Repository<VisitaRespuesta>,
  ) {}

  findAllPlantillas() {
    return this.plantillasRepo.find({
      where: { activo: true },
      relations: PLANTILLA_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  async findOnePlantilla(id: string) {
    const p = await this.plantillasRepo.findOne({
      where: { id },
      relations: PLANTILLA_RELATIONS,
    });
    if (!p) throw new NotFoundException('Plantilla no encontrada');
    return p;
  }

  async createPlantilla(dto: CreatePlantillaDto) {
    const secciones = dto.secciones.map((s, si) => ({
      titulo: s.titulo,
      orden: s.orden ?? si,
      items: s.items.map((item, ii) => ({
        etiqueta: item.etiqueta,
        tipo: item.tipo as any,
        opciones: item.opciones ?? null,
        unidad: item.unidad ?? null,
        obligatorio: item.obligatorio ?? false,
        orden: item.orden ?? ii,
      })),
    }));

    const p = this.plantillasRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
    } as any);
    (p as any).secciones = secciones;
    return this.plantillasRepo.save(p);
  }

  async deletePlantilla(id: string) {
    const p = await this.findOnePlantilla(id);
    p.activo = false;
    return this.plantillasRepo.save(p);
  }

  async createForVisita(visitaId: string, plantillaId: string): Promise<VisitaChecklist> {
    const existing = await this.vcRepo.findOne({ where: { visitaId } });
    if (existing) return existing;
    const vc = this.vcRepo.create({ visitaId, plantillaId });
    return this.vcRepo.save(vc);
  }

  async findByVisita(visitaId: string) {
    return this.vcRepo.findOne({
      where: { visitaId },
      relations: VC_RELATIONS,
    });
  }

  async guardarRespuestas(visitaId: string, dto: GuardarRespuestasDto) {
    const vc = await this.findByVisita(visitaId);
    if (!vc) throw new NotFoundException('Checklist no encontrado para esta visita');

    for (const r of dto.respuestas) {
      const existing = await this.respRepo.findOne({
        where: { checklistId: vc.id, itemId: r.itemId },
      });
      if (existing) {
        existing.valor = r.valor ?? null;
        await this.respRepo.save(existing);
      } else {
        const nueva = this.respRepo.create();
        nueva.checklistId = vc.id;
        nueva.itemId = r.itemId;
        nueva.valor = r.valor ?? null;
        await this.respRepo.save(nueva);
      }
    }

    if (dto.firmante) {
      vc.firmante = dto.firmante;
      await this.vcRepo.save(vc);
    }

    return this.findByVisita(visitaId);
  }

  async completar(visitaId: string) {
    const vc = await this.findByVisita(visitaId);
    if (!vc) throw new NotFoundException('Checklist no encontrado');
    vc.completadoEn = new Date();
    return this.vcRepo.save(vc);
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Visita } from './entities/visita.entity';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { EstadoVisita } from '../common/enums/estado-visita.enum';
import { NotificationsGateway, VisitaNotificacion } from '../notifications/notifications.gateway';
import { buildCsv, formatDate } from '../common/utils/csv.util';
import { PlanTecnico } from '../planificacion/entities/plan-tecnico.entity';
import { PlanObra } from '../planificacion/entities/plan-obra.entity';
import { PlanAsignacion } from '../planificacion/entities/plan-asignacion.entity';

const TIPO_LABELS: Record<string, string> = {
  visita_tecnica_fv: 'Visita Técnica FV',
  visita_tecnica_aerotermia: 'V.T. Rite',
  instalacion_nueva_fv: 'Instalación Nueva FV',
  instalacion_nueva_aerotermia: 'Inst. Nueva Rite',
};

const RELATIONS = { instalacion: true, tecnico: true } as const;

@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(Visita) private repo: Repository<Visita>,
    @InjectRepository(PlanTecnico) private planTecnicoRepo: Repository<PlanTecnico>,
    @InjectRepository(PlanObra) private planObraRepo: Repository<PlanObra>,
    @InjectRepository(PlanAsignacion) private planAsignacionRepo: Repository<PlanAsignacion>,
    private readonly notifications: NotificationsGateway,
  ) {}

  private async syncAsignacion(visita: Visita): Promise<void> {
    if (!visita.tecnico_id) return;
    const planTecnico = await this.planTecnicoRepo.findOne({ where: { user_id: visita.tecnico_id } });
    if (!planTecnico) return;

    const fecha = new Date(visita.fechaProgramada).toISOString().split('T')[0];
    const planObra = visita.instalacion_id
      ? await this.planObraRepo.findOne({ where: { instalacion_id: visita.instalacion_id, activo: true } })
      : null;

    const existente = await this.planAsignacionRepo.findOne({
      where: { tecnico_id: planTecnico.id, fecha },
    });

    if (existente) {
      await this.planAsignacionRepo.save(Object.assign(existente, {
        obra_id: planObra?.id ?? existente.obra_id,
        viaja: visita.viaja ?? existente.viaja,
      }));
    } else {
      await this.planAsignacionRepo.save(this.planAsignacionRepo.create({
        tecnico_id: planTecnico.id,
        obra_id: planObra?.id ?? undefined,
        fecha,
        viaja: visita.viaja ?? false,
        observaciones: `Visita automática: ${TIPO_LABELS[visita.tipo] ?? visita.tipo}`,
      }));
    }
  }

  private async removeAsignacion(visita: Visita): Promise<void> {
    if (!visita.tecnico_id) return;
    const planTecnico = await this.planTecnicoRepo.findOne({ where: { user_id: visita.tecnico_id } });
    if (!planTecnico) return;
    const fecha = new Date(visita.fechaProgramada).toISOString().split('T')[0];
    const existente = await this.planAsignacionRepo.findOne({
      where: { tecnico_id: planTecnico.id, fecha },
    });
    if (existente) await this.planAsignacionRepo.remove(existente);
  }

  async create(dto: CreateVisitaDto): Promise<Visita> {
    if (dto.tecnico_id) {
      const fecha = new Date(dto.fechaProgramada);
      const desde = new Date(fecha.getTime() - 2 * 60 * 60 * 1000);
      const hasta = new Date(fecha.getTime() + 2 * 60 * 60 * 1000);
      const conflicto = await this.repo
        .createQueryBuilder('v')
        .where('v.tecnico_id = :tid', { tid: dto.tecnico_id })
        .andWhere('v.fechaProgramada BETWEEN :desde AND :hasta', { desde, hasta })
        .andWhere("v.estado != 'cancelada'")
        .getOne();
      if (conflicto) {
        throw new ConflictException('El técnico ya tiene una visita asignada en esa franja horaria');
      }
    }
    const saved = await this.repo.save(this.repo.create(dto));
    const visita = await this.repo.findOne({ where: { id: saved.id }, relations: RELATIONS }) as Visita;
    if (dto.tecnico_id) {
      this.notifications.notifyUser(dto.tecnico_id, 'nueva-visita', this.buildPayload(visita));
    }
    await this.syncAsignacion(visita);
    return visita;
  }

  private buildPayload(visita: Visita): VisitaNotificacion {
    return {
      visitaId: visita.id,
      instalacionNombre: visita.instalacion?.nombre ?? '—',
      instalacionDireccion: visita.instalacion?.direccion ?? '',
      fechaProgramada: visita.fechaProgramada.toISOString(),
      tipo: TIPO_LABELS[visita.tipo] ?? visita.tipo,
    };
  }

  findAll(): Promise<Visita[]> {
    return this.repo.find({ relations: RELATIONS, order: { fechaProgramada: 'DESC' } });
  }

  findSemana(desde: Date, hasta: Date): Promise<Visita[]> {
    return this.repo.find({
      where: { fechaProgramada: Between(desde, hasta) },
      relations: RELATIONS,
      order: { fechaProgramada: 'ASC' },
    });
  }

  findByTecnico(tecnico_id: string): Promise<Visita[]> {
    return this.repo.find({ where: { tecnico_id }, relations: RELATIONS, order: { fechaProgramada: 'ASC' } });
  }

  findHoy(): Promise<Visita[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    return this.repo.find({
      where: { fechaProgramada: Between(hoy, manana) },
      relations: RELATIONS,
      order: { fechaProgramada: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Visita> {
    const visita = await this.repo.findOne({ where: { id }, relations: RELATIONS });
    if (!visita) throw new NotFoundException(`Visita ${id} no encontrada`);
    return visita;
  }

  async update(id: string, dto: UpdateVisitaDto): Promise<Visita> {
    const anterior = await this.findOne(id);
    const tecnicoCambia = dto.tecnico_id !== undefined && dto.tecnico_id !== anterior.tecnico_id;
    const fechaCambia = !!dto.fechaProgramada &&
      new Date(dto.fechaProgramada).getTime() !== new Date(anterior.fechaProgramada).getTime();
    const tecnicoAnteriorId = anterior.tecnico_id;

    Object.assign(anterior, dto);
    // Clear eager relations so TypeORM uses the FK columns directly
    if (dto.tecnico_id) anterior.tecnico = { id: dto.tecnico_id } as any;
    else if (dto.tecnico_id === null) anterior.tecnico = undefined;
    if (dto.instalacion_id) anterior.instalacion = { id: dto.instalacion_id } as any;
    if (dto.almacen_id) anterior.almacen = { id: dto.almacen_id } as any;
    await this.repo.save(anterior);
    const visita = await this.findOne(id);
    await this.syncAsignacion(visita);
    const payload = this.buildPayload(visita);

    if (tecnicoCambia) {
      if (tecnicoAnteriorId) this.notifications.notifyUser(tecnicoAnteriorId, 'visita-cancelada', payload);
      if (visita.tecnico_id) this.notifications.notifyUser(visita.tecnico_id, 'nueva-visita', payload);
    } else if (fechaCambia && visita.tecnico_id) {
      this.notifications.notifyUser(visita.tecnico_id, 'visita-actualizada', payload);
    }

    return visita;
  }

  async checkin(id: string): Promise<Visita> {
    return this.update(id, {
      estado: EstadoVisita.EN_CURSO,
      fechaInicio: new Date().toISOString(),
    });
  }

  async checkout(id: string): Promise<Visita> {
    return this.update(id, {
      estado: EstadoVisita.COMPLETADA,
      fechaFin: new Date().toISOString(),
    });
  }

  async exportCsv(desde?: Date, hasta?: Date): Promise<string> {
    const qb = this.repo.createQueryBuilder('v')
      .leftJoinAndSelect('v.instalacion', 'i')
      .leftJoinAndSelect('v.tecnico', 't')
      .orderBy('v.fechaProgramada', 'DESC');

    if (desde && hasta) {
      qb.where('v.fechaProgramada BETWEEN :desde AND :hasta', { desde, hasta });
    }

    const visitas = await qb.getMany();
    const rows = visitas.map(v => ({
      id: v.id,
      fecha_programada: formatDate(v.fechaProgramada),
      tipo: TIPO_LABELS[v.tipo] ?? v.tipo,
      estado: v.estado,
      tecnico: v.tecnico?.nombre ?? '',
      tecnico_email: v.tecnico?.email ?? '',
      instalacion: v.instalacion?.nombre ?? '',
      direccion: v.instalacion?.direccion ?? '',
      ciudad: v.instalacion?.ciudad ?? '',
      inicio_real: formatDate(v.fechaInicio),
      fin_real: formatDate(v.fechaFin),
      notas: v.notas ?? '',
    }));

    return buildCsv(rows, [
      { key: 'id',              label: 'ID' },
      { key: 'fecha_programada', label: 'Fecha Programada' },
      { key: 'tipo',            label: 'Tipo' },
      { key: 'estado',          label: 'Estado' },
      { key: 'tecnico',         label: 'Técnico' },
      { key: 'tecnico_email',   label: 'Email Técnico' },
      { key: 'instalacion',     label: 'Instalación' },
      { key: 'direccion',       label: 'Dirección' },
      { key: 'ciudad',          label: 'Ciudad' },
      { key: 'inicio_real',     label: 'Inicio Real' },
      { key: 'fin_real',        label: 'Fin Real' },
      { key: 'notas',           label: 'Notas' },
    ]);
  }

  async remove(id: string): Promise<void> {
    const visita = await this.findOne(id);
    visita.estado = EstadoVisita.CANCELADA;
    await this.repo.save(visita);
    if (visita.tecnico_id) {
      this.notifications.notifyUser(visita.tecnico_id, 'visita-cancelada', this.buildPayload(visita));
    }
    await this.removeAsignacion(visita);
  }
}

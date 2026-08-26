import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incidencia } from './entities/incidencia.entity';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';
import { UpdateIncidenciaDto } from './dto/update-incidencia.dto';
import { EstadoIncidencia } from '../common/enums/prioridad.enum';
import { NotificationsGateway, IncidenciaNotificacion } from '../notifications/notifications.gateway';

@Injectable()
export class IncidenciasService {
  constructor(
    @InjectRepository(Incidencia) private repo: Repository<Incidencia>,
    private readonly notifications: NotificationsGateway,
  ) {}

  async create(dto: CreateIncidenciaDto, creadoPorId: string): Promise<Incidencia> {
    const saved = await this.repo.save(this.repo.create({ ...dto, creado_por_id: creadoPorId }));
    const inc = await this.findOne(saved.id);
    if (inc.asignado_a_id) {
      this.notifications.notifyUser(inc.asignado_a_id, 'incidencia-asignada', this.buildPayload(inc));
    }
    return inc;
  }

  findAll(): Promise<Incidencia[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findAbiertas(): Promise<Incidencia[]> {
    return this.repo.find({
      where: [
        { estado: EstadoIncidencia.ABIERTA },
        { estado: EstadoIncidencia.EN_PROGRESO },
      ],
      order: { prioridad: 'DESC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Incidencia> {
    const inc = await this.repo.findOne({ where: { id } });
    if (!inc) throw new NotFoundException(`Incidencia ${id} no encontrada`);
    return inc;
  }

  async update(id: string, dto: UpdateIncidenciaDto): Promise<Incidencia> {
    const anterior = await this.findOne(id);
    const tecnicoCambia = !!dto.asignado_a_id && dto.asignado_a_id !== anterior.asignado_a_id;
    const tecnicoAnteriorId = anterior.asignado_a_id;

    Object.assign(anterior, dto);
    await this.repo.save(anterior);
    const inc = await this.findOne(id);

    if (tecnicoCambia) {
      if (tecnicoAnteriorId) {
        this.notifications.notifyUser(tecnicoAnteriorId, 'incidencia-desasignada', this.buildPayload(inc));
      }
      this.notifications.notifyUser(inc.asignado_a_id!, 'incidencia-asignada', this.buildPayload(inc));
    }

    return inc;
  }

  async cerrar(id: string, resolucion: string): Promise<Incidencia> {
    return this.update(id, { estado: EstadoIncidencia.CERRADA, resolucion });
  }

  private buildPayload(inc: Incidencia): IncidenciaNotificacion {
    return {
      incidenciaId: inc.id,
      titulo: inc.titulo,
      prioridad: inc.prioridad,
      instalacionNombre: inc.instalacion?.nombre ?? '—',
    };
  }
}

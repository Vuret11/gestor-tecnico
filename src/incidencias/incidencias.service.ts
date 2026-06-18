import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incidencia } from './entities/incidencia.entity';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';
import { UpdateIncidenciaDto } from './dto/update-incidencia.dto';
import { EstadoIncidencia } from '../common/enums/prioridad.enum';

@Injectable()
export class IncidenciasService {
  constructor(
    @InjectRepository(Incidencia) private repo: Repository<Incidencia>,
  ) {}

  create(dto: CreateIncidenciaDto, creadoPorId: string): Promise<Incidencia> {
    return this.repo.save(this.repo.create({ ...dto, creado_por_id: creadoPorId }));
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
    const inc = await this.findOne(id);
    Object.assign(inc, dto);
    return this.repo.save(inc);
  }

  async cerrar(id: string, resolucion: string): Promise<Incidencia> {
    return this.update(id, { estado: EstadoIncidencia.CERRADA, resolucion });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Visita } from './entities/visita.entity';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { EstadoVisita } from '../common/enums/estado-visita.enum';

@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(Visita) private repo: Repository<Visita>,
  ) {}

  async create(dto: CreateVisitaDto): Promise<Visita> {
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
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<Visita[]> {
    return this.repo.find({ order: { fechaProgramada: 'DESC' } });
  }

  findSemana(desde: Date, hasta: Date): Promise<Visita[]> {
    return this.repo.find({
      where: { fechaProgramada: Between(desde, hasta) },
      order: { fechaProgramada: 'ASC' },
    });
  }

  findByTecnico(tecnico_id: string): Promise<Visita[]> {
    return this.repo.find({ where: { tecnico_id }, order: { fechaProgramada: 'ASC' } });
  }

  findHoy(): Promise<Visita[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    return this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.instalacion', 'i')
      .leftJoinAndSelect('v.tecnico', 't')
      .where('v.fechaProgramada >= :hoy AND v.fechaProgramada < :manana', { hoy, manana })
      .orderBy('v.fechaProgramada', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Visita> {
    const visita = await this.repo.findOne({ where: { id } });
    if (!visita) throw new NotFoundException(`Visita ${id} no encontrada`);
    return visita;
  }

  async update(id: string, dto: UpdateVisitaDto): Promise<Visita> {
    const visita = await this.findOne(id);
    Object.assign(visita, dto);
    return this.repo.save(visita);
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

  async remove(id: string): Promise<void> {
    const visita = await this.findOne(id);
    visita.estado = EstadoVisita.CANCELADA;
    await this.repo.save(visita);
  }
}

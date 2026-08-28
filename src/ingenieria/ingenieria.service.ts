import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProyectoIngenieria } from './entities/proyecto-ingenieria.entity';
import { CreateProyectoDto } from './dto/create-proyecto.dto';

@Injectable()
export class IngenieriaService {
  constructor(
    @InjectRepository(ProyectoIngenieria) private repo: Repository<ProyectoIngenieria>,
  ) {}

  findAll(incluirInactivos = false): Promise<ProyectoIngenieria[]> {
    return this.repo.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ProyectoIngenieria> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return p;
  }

  create(dto: CreateProyectoDto): Promise<ProyectoIngenieria> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<CreateProyectoDto>): Promise<ProyectoIngenieria> {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async remove(id: string): Promise<void> {
    const p = await this.findOne(id);
    p.activo = false;
    await this.repo.save(p);
  }
}

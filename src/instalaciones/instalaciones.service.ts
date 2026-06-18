import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instalacion } from './entities/instalacion.entity';
import { CreateInstalacionDto } from './dto/create-instalacion.dto';
import { UpdateInstalacionDto } from './dto/update-instalacion.dto';

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalacion) private repo: Repository<Instalacion>,
  ) {}

  create(dto: CreateInstalacionDto): Promise<Instalacion> {
    return this.repo.save(this.repo.create(dto));
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
    return this.repo.save(inst);
  }

  async remove(id: string): Promise<void> {
    const inst = await this.findOne(id);
    inst.activo = false;
    await this.repo.save(inst);
  }
}

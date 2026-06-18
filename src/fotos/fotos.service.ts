import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Foto } from './entities/foto.entity';
import { CreateFotoDto } from './dto/create-foto.dto';

@Injectable()
export class FotosService {
  constructor(
    @InjectRepository(Foto) private repo: Repository<Foto>,
  ) {}

  create(dto: CreateFotoDto): Promise<Foto> {
    return this.repo.save(this.repo.create(dto));
  }

  findByVisita(visita_id: string): Promise<Foto[]> {
    return this.repo.find({ where: { visita_id }, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Foto> {
    const foto = await this.repo.findOne({ where: { id } });
    if (!foto) throw new NotFoundException(`Foto ${id} no encontrada`);
    return foto;
  }

  async remove(id: string): Promise<void> {
    const foto = await this.findOne(id);
    await this.repo.remove(foto);
  }
}

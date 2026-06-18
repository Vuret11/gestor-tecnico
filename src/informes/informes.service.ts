import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Informe } from './entities/informe.entity';
import { CreateInformeDto } from './dto/create-informe.dto';

@Injectable()
export class InformesService {
  constructor(
    @InjectRepository(Informe) private repo: Repository<Informe>,
  ) {}

  async create(dto: CreateInformeDto): Promise<Informe> {
    const existe = await this.repo.findOne({ where: { visita_id: dto.visita_id } });
    if (existe) {
      Object.assign(existe, dto);
      return this.repo.save(existe);
    }
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<Informe[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Informe> {
    const informe = await this.repo.findOne({ where: { id } });
    if (!informe) throw new NotFoundException(`Informe ${id} no encontrado`);
    return informe;
  }

  async findByVisita(visita_id: string): Promise<Informe | null> {
    return this.repo.findOne({ where: { visita_id } });
  }

  async update(id: string, dto: Partial<CreateInformeDto>): Promise<Informe> {
    const informe = await this.findOne(id);
    Object.assign(informe, dto);
    return this.repo.save(informe);
  }
}

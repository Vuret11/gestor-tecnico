import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maquina } from './entities/maquina.entity';

@Injectable()
export class MaquinasService {
  constructor(@InjectRepository(Maquina) private repo: Repository<Maquina>) {}

  async listar(fabricante?: string) {
    return this.repo.find({
      where: fabricante ? { fabricante } : {},
      order: { fabricante: 'ASC', modelo: 'ASC' },
    });
  }

  // Fabricantes distintos, para el primer desplegable
  async fabricantes() {
    const filas = await this.repo
      .createQueryBuilder('m')
      .select('m.fabricante', 'fabricante')
      .addSelect('COUNT(*)', 'cuantas')
      .where('m.fabricante IS NOT NULL')
      .groupBy('m.fabricante')
      .orderBy('m.fabricante', 'ASC')
      .getRawMany();
    return filas.map(f => ({ fabricante: f.fabricante, cuantas: Number(f.cuantas) }));
  }

  async crear(dto: any) {
    const m = new Maquina();
    Object.assign(m, dto);
    return this.repo.save(m);
  }

  async borrar(id: number) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('No existe esa maquina');
    await this.repo.remove(m);
    return { borrada: true };
  }
}

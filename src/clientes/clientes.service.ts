import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente) private repo: Repository<Cliente>,
  ) {}

  create(dto: CreateClienteDto): Promise<Cliente> {
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<Cliente[]> {
    return this.repo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<Cliente> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return c;
  }

  async update(id: string, dto: UpdateClienteDto): Promise<Cliente> {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string): Promise<void> {
    const c = await this.findOne(id);
    c.activo = false;
    await this.repo.save(c);
  }
}

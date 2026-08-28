import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventarioArticulo } from './entities/inventario-articulo.entity';
import { VisitaArticulo } from './entities/visita-articulo.entity';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { AddVisitaArticuloDto } from './dto/add-visita-articulo.dto';

@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(InventarioArticulo) private artRepo: Repository<InventarioArticulo>,
    @InjectRepository(VisitaArticulo) private vaRepo: Repository<VisitaArticulo>,
  ) {}

  // ── Artículos ─────────────────────────────────────────────────────────────

  findAll(): Promise<InventarioArticulo[]> {
    return this.artRepo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  findAllIncludingInactivos(): Promise<InventarioArticulo[]> {
    return this.artRepo.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<InventarioArticulo> {
    const art = await this.artRepo.findOne({ where: { id } });
    if (!art) throw new NotFoundException(`Artículo ${id} no encontrado`);
    return art;
  }

  create(dto: CreateArticuloDto): Promise<InventarioArticulo> {
    return this.artRepo.save(this.artRepo.create({
      ...dto,
      unidad: dto.unidad ?? 'ud',
      stockActual: dto.stockActual ?? 0,
      stockMinimo: dto.stockMinimo ?? 0,
    }));
  }

  async update(id: string, dto: Partial<CreateArticuloDto>): Promise<InventarioArticulo> {
    const art = await this.findOne(id);
    Object.assign(art, dto);
    return this.artRepo.save(art);
  }

  async remove(id: string): Promise<void> {
    const art = await this.findOne(id);
    art.activo = false;
    await this.artRepo.save(art);
  }

  // ── Artículos por visita ──────────────────────────────────────────────────

  findByVisita(visita_id: string): Promise<VisitaArticulo[]> {
    return this.vaRepo.find({ where: { visita_id }, order: { createdAt: 'ASC' } });
  }

  async addToVisita(visita_id: string, dto: AddVisitaArticuloDto): Promise<VisitaArticulo> {
    const art = await this.findOne(dto.articulo_id);

    const cantNum = Number(dto.cantidad);
    if (Number(art.stockActual) < cantNum) {
      throw new BadRequestException(
        `Stock insuficiente: disponible ${art.stockActual} ${art.unidad}`,
      );
    }

    art.stockActual = Number(art.stockActual) - cantNum;
    await this.artRepo.save(art);

    return this.vaRepo.save(this.vaRepo.create({
      visita_id,
      articulo_id: dto.articulo_id,
      cantidad: cantNum,
      precioUnitario: dto.precioUnitario ?? art.precioUnitario,
      notas: dto.notas,
    }));
  }

  async removeFromVisita(id: string): Promise<void> {
    const va = await this.vaRepo.findOne({ where: { id }, relations: { articulo: true } });
    if (!va) throw new NotFoundException(`Línea ${id} no encontrada`);

    // Devolver stock
    va.articulo.stockActual = Number(va.articulo.stockActual) + Number(va.cantidad);
    await this.artRepo.save(va.articulo);
    await this.vaRepo.remove(va);
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  async ajustarStock(id: string, cantidad: number): Promise<InventarioArticulo> {
    const art = await this.findOne(id);
    art.stockActual = Number(art.stockActual) + cantidad;
    if (art.stockActual < 0) throw new BadRequestException('Stock no puede ser negativo');
    return this.artRepo.save(art);
  }
}

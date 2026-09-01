import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventarioArticulo } from './entities/inventario-articulo.entity';
import { InventarioStock } from './entities/inventario-stock.entity';
import { Almacen } from './entities/almacen.entity';
import { VisitaArticulo } from './entities/visita-articulo.entity';
import { Visita } from '../visitas/entities/visita.entity';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { AddVisitaArticuloDto } from './dto/add-visita-articulo.dto';

@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(InventarioArticulo) private artRepo: Repository<InventarioArticulo>,
    @InjectRepository(InventarioStock) private stockRepo: Repository<InventarioStock>,
    @InjectRepository(Almacen) private almacenRepo: Repository<Almacen>,
    @InjectRepository(VisitaArticulo) private vaRepo: Repository<VisitaArticulo>,
    @InjectRepository(Visita) private visitaRepo: Repository<Visita>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  // ── Almacenes ─────────────────────────────────────────────────────────────

  findAlmacenes(): Promise<Almacen[]> {
    return this.almacenRepo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  createAlmacen(dto: CreateAlmacenDto): Promise<Almacen> {
    return this.almacenRepo.save(this.almacenRepo.create(dto));
  }

  // ── Artículos ─────────────────────────────────────────────────────────────

  findAll(): Promise<InventarioArticulo[]> {
    return this.artRepo.find({
      where: { activo: true },
      relations: { stocks: { almacen: true } },
      order: { nombre: 'ASC' },
    });
  }

  findAllIncludingInactivos(): Promise<InventarioArticulo[]> {
    return this.artRepo.find({ relations: { stocks: { almacen: true } }, order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<InventarioArticulo> {
    const art = await this.artRepo.findOne({ where: { id }, relations: { stocks: { almacen: true } } });
    if (!art) throw new NotFoundException(`Artículo ${id} no encontrado`);
    return art;
  }

  async create(dto: CreateArticuloDto): Promise<InventarioArticulo> {
    const art = await this.artRepo.save(this.artRepo.create({
      ...dto,
      unidad: dto.unidad ?? 'ud',
    }));
    const almacenes = await this.findAlmacenes();
    if (almacenes.length > 0) {
      await this.stockRepo.save(almacenes.map(al => this.stockRepo.create({
        articulo_id: art.id,
        almacen_id: al.id,
        stockActual: 0,
        stockMinimo: 0,
      })));
    }
    return this.findOne(art.id);
  }

  async update(id: string, dto: Partial<CreateArticuloDto>): Promise<InventarioArticulo> {
    const art = await this.findOne(id);
    Object.assign(art, dto);
    await this.artRepo.save(art);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const art = await this.findOne(id);
    art.activo = false;
    await this.artRepo.save(art);
  }

  // ── Stock por almacén ─────────────────────────────────────────────────────

  async ajustarStock(articulo_id: string, almacen_id: string, delta?: number, stockMinimo?: number): Promise<InventarioArticulo> {
    await this.dataSource.transaction(async manager => {
      const stock = await this.lockOrCreateStock(manager, articulo_id, almacen_id);
      if (delta != null) {
        const nuevo = Number(stock.stockActual) + Number(delta);
        if (nuevo < 0) throw new BadRequestException('Stock no puede ser negativo');
        stock.stockActual = nuevo;
      }
      if (stockMinimo != null) {
        stock.stockMinimo = Number(stockMinimo);
      }
      await manager.save(stock);
    });
    return this.findOne(articulo_id);
  }

  // Bloquea la fila de stock (FOR UPDATE) dentro de una transacción para evitar
  // que dos peticiones concurrentes lean el mismo stockActual y una pise a la otra.
  // Si la fila no existe todavía se crea sin lock (no hay nada que bloquear);
  // el índice único (articulo_id, almacen_id) evita duplicados en ese caso raro.
  private async lockOrCreateStock(
    manager: import('typeorm').EntityManager,
    articulo_id: string,
    almacen_id: string,
  ): Promise<InventarioStock> {
    let stock = await manager.findOne(InventarioStock, {
      where: { articulo_id, almacen_id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!stock) {
      stock = await manager.save(manager.create(InventarioStock, { articulo_id, almacen_id, stockActual: 0, stockMinimo: 0 }));
    }
    return stock;
  }

  // ── Artículos por visita ──────────────────────────────────────────────────

  findByVisita(visita_id: string): Promise<VisitaArticulo[]> {
    return this.vaRepo.find({ where: { visita_id }, order: { createdAt: 'ASC' } });
  }

  findByInstalacion(instalacion_id: string): Promise<VisitaArticulo[]> {
    return this.vaRepo.createQueryBuilder('va')
      .innerJoin('va.visita', 'v')
      .leftJoinAndSelect('va.articulo', 'articulo')
      .leftJoinAndSelect('va.almacen', 'almacen')
      .where('v.instalacion_id = :instalacion_id', { instalacion_id })
      .orderBy('va.createdAt', 'ASC')
      .getMany();
  }

  async addToVisita(visita_id: string, dto: AddVisitaArticuloDto): Promise<VisitaArticulo> {
    const visita = await this.visitaRepo.findOne({ where: { id: visita_id } });
    if (!visita) throw new NotFoundException(`Visita ${visita_id} no encontrada`);
    if (!visita.almacen_id) {
      throw new BadRequestException('Esta visita no tiene almacén de origen asignado');
    }

    const art = await this.findOne(dto.articulo_id);
    const cantNum = Number(dto.cantidad);

    const nuevaLinea = await this.dataSource.transaction(async manager => {
      const stock = await this.lockOrCreateStock(manager, dto.articulo_id, visita.almacen_id!);
      if (Number(stock.stockActual) < cantNum) {
        throw new BadRequestException(
          `Stock insuficiente en ${stock.almacen?.nombre ?? 'el almacén'}: disponible ${stock.stockActual} ${art.unidad}`,
        );
      }
      stock.stockActual = Number(stock.stockActual) - cantNum;
      await manager.save(stock);

      return manager.save(manager.create(VisitaArticulo, {
        visita_id,
        articulo_id: dto.articulo_id,
        almacen_id: visita.almacen_id!,
        cantidad: cantNum,
        precioUnitario: dto.precioUnitario ?? art.precioUnitario,
        notas: dto.notas,
      }));
    });

    return nuevaLinea;
  }

  async removeFromVisita(id: string): Promise<void> {
    const va = await this.vaRepo.findOne({ where: { id } });
    if (!va) throw new NotFoundException(`Línea ${id} no encontrada`);

    await this.dataSource.transaction(async manager => {
      if (va.almacen_id) {
        const stock = await this.lockOrCreateStock(manager, va.articulo_id, va.almacen_id);
        stock.stockActual = Number(stock.stockActual) + Number(va.cantidad);
        await manager.save(stock);
      }
      await manager.remove(va);
    });
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  historial(desde?: Date, hasta?: Date): Promise<VisitaArticulo[]> {
    const qb = this.vaRepo.createQueryBuilder('va')
      .leftJoinAndSelect('va.articulo', 'art')
      .leftJoinAndSelect('va.almacen', 'almacen')
      .leftJoinAndSelect('va.visita', 'v')
      .leftJoinAndSelect('v.instalacion', 'inst')
      .leftJoinAndSelect('v.tecnico', 'tec')
      .orderBy('va.createdAt', 'DESC');
    if (desde && hasta) {
      qb.where('va.createdAt BETWEEN :desde AND :hasta', { desde, hasta });
    }
    return qb.getMany();
  }
}

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PlanProvincia } from './entities/plan-provincia.entity';
import { PlanTecnico } from './entities/plan-tecnico.entity';
import { PlanCliente } from './entities/plan-cliente.entity';
import { PlanObra } from './entities/plan-obra.entity';
import { PlanAsignacion } from './entities/plan-asignacion.entity';

@Injectable()
export class PlanificacionService {
  constructor(
    @InjectRepository(PlanProvincia) private provincias: Repository<PlanProvincia>,
    @InjectRepository(PlanTecnico) private tecnicos: Repository<PlanTecnico>,
    @InjectRepository(PlanCliente) private clientes: Repository<PlanCliente>,
    @InjectRepository(PlanObra) private obras: Repository<PlanObra>,
    @InjectRepository(PlanAsignacion) private asignaciones: Repository<PlanAsignacion>,
  ) {}

  // ── Provincias ──────────────────────────────────────────────────────────────
  getProvincias() { return this.provincias.find({ order: { nombre: 'ASC' } }); }

  createProvincia(data: Partial<PlanProvincia>) {
    return this.provincias.save(this.provincias.create(data));
  }

  async updateProvincia(id: string, data: Partial<PlanProvincia>) {
    const p = await this.provincias.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    return this.provincias.save(Object.assign(p, data));
  }

  // ── Técnicos ────────────────────────────────────────────────────────────────
  getTecnicos(provinciaId?: string) {
    const where: any = { activo: true };
    if (provinciaId) where.provincia_id = provinciaId;
    return this.tecnicos.find({ where, order: { nombre: 'ASC' } });
  }

  createTecnico(data: Partial<PlanTecnico>) {
    return this.tecnicos.save(this.tecnicos.create(data));
  }

  async updateTecnico(id: string, data: Partial<PlanTecnico>) {
    const t = await this.tecnicos.findOne({ where: { id } });
    if (!t) throw new NotFoundException();
    return this.tecnicos.save(Object.assign(t, data));
  }

  async removeTecnico(id: string) {
    const t = await this.tecnicos.findOne({ where: { id } });
    if (!t) throw new NotFoundException();
    t.activo = false;
    return this.tecnicos.save(t);
  }

  // ── Clientes ────────────────────────────────────────────────────────────────
  getClientes() { return this.clientes.find({ where: { activo: true }, order: { nombre: 'ASC' } }); }

  createCliente(data: Partial<PlanCliente>) {
    return this.clientes.save(this.clientes.create(data));
  }

  async updateCliente(id: string, data: Partial<PlanCliente>) {
    const c = await this.clientes.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    return this.clientes.save(Object.assign(c, data));
  }

  async removeCliente(id: string) {
    const c = await this.clientes.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    c.activo = false;
    return this.clientes.save(c);
  }

  // ── Obras ────────────────────────────────────────────────────────────────────
  getObras(provinciaId?: string, clienteId?: string) {
    const where: any = { activo: true };
    if (provinciaId) where.provincia_id = provinciaId;
    if (clienteId) where.cliente_id = clienteId;
    return this.obras.find({ where, order: { numeroObra: 'ASC' } });
  }

  createObra(data: Partial<PlanObra>) {
    return this.obras.save(this.obras.create(data));
  }

  async updateObra(id: string, data: Partial<PlanObra>) {
    const o = await this.obras.findOne({ where: { id } });
    if (!o) throw new NotFoundException();
    return this.obras.save(Object.assign(o, data));
  }

  async removeObra(id: string) {
    const o = await this.obras.findOne({ where: { id } });
    if (!o) throw new NotFoundException();
    o.activo = false;
    return this.obras.save(o);
  }

  // ── Asignaciones ─────────────────────────────────────────────────────────────
  async getAsignacionesSemana(desde: string, hasta: string, provinciaId?: string) {
    const qb = this.asignaciones.createQueryBuilder('a')
      .leftJoinAndSelect('a.tecnico', 'tecnico')
      .leftJoinAndSelect('tecnico.provincia', 'provTecnico')
      .leftJoinAndSelect('a.obra', 'obra')
      .leftJoinAndSelect('obra.cliente', 'cliente')
      .leftJoinAndSelect('a.provinciatrabajo', 'provTrabajo')
      .where('a.fecha BETWEEN :desde AND :hasta', { desde, hasta });

    if (provinciaId) {
      qb.andWhere('(tecnico.provincia_id = :pid OR a.provincia_trabajo_id = :pid)', { pid: provinciaId });
    }

    return qb.orderBy('a.fecha', 'ASC').addOrderBy('tecnico.nombre', 'ASC').getMany();
  }

  async getAsignacionesMes(year: number, month: number, provinciaId?: string) {
    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const hasta = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return this.getAsignacionesSemana(desde, hasta, provinciaId);
  }

  async createAsignacion(data: Partial<PlanAsignacion>) {
    // Verificar conflicto: mismo técnico, misma fecha, ya tiene asignación con obra
    if (data.obra_id && data.tecnico_id && data.fecha) {
      const existente = await this.asignaciones.findOne({
        where: { tecnico_id: data.tecnico_id, fecha: data.fecha },
      });
      if (existente && !existente.estadoEspecial) {
        throw new ConflictException(
          `El técnico ya tiene una asignación el ${data.fecha}`,
        );
      }
    }
    return this.asignaciones.save(this.asignaciones.create(data));
  }

  async updateAsignacion(id: string, data: Partial<PlanAsignacion>) {
    const a = await this.asignaciones.findOne({ where: { id } });
    if (!a) throw new NotFoundException();
    return this.asignaciones.save(Object.assign(a, data));
  }

  async removeAsignacion(id: string) {
    const a = await this.asignaciones.findOne({ where: { id } });
    if (!a) throw new NotFoundException();
    return this.asignaciones.remove(a);
  }

  // ── Conflictos ───────────────────────────────────────────────────────────────
  async getConflictos(desde: string, hasta: string) {
    const asigs = await this.getAsignacionesSemana(desde, hasta);
    const conflictos: any[] = [];

    // Agrupar por técnico + fecha
    const porTecnicoFecha = new Map<string, PlanAsignacion[]>();
    asigs.forEach(a => {
      const key = `${a.tecnico_id}::${a.fecha}`;
      if (!porTecnicoFecha.has(key)) porTecnicoFecha.set(key, []);
      porTecnicoFecha.get(key)!.push(a);
    });

    porTecnicoFecha.forEach((lista, key) => {
      const obras = lista.filter(a => a.obra_id);
      if (obras.length > 1) {
        conflictos.push({
          tipo: 'doble_asignacion',
          mensaje: `${lista[0].tecnico.nombre} tiene ${obras.length} obras el ${lista[0].fecha}`,
          tecnico: lista[0].tecnico,
          fecha: lista[0].fecha,
          asignaciones: obras,
        });
      }
    });

    return conflictos;
  }

  // ── Importación masiva ────────────────────────────────────────────────────────
  async importarAsignaciones(rows: {
    tecnicoNombre: string;
    fecha: string;
    contenido: string;
    provinciaId: string;
  }[]) {
    const ESTADOS_ESPECIALES: Record<string, string> = {
      vacaciones: 'vacaciones', baja: 'baja', 'comp. horas': 'comp_horas',
      libre: 'libre', 'libre por horas': 'libre', 'fiesta nacional': 'fiesta_nacional',
      medico: 'medico', sancion: 'sancion', reconocimiento: 'reconocimiento',
      recon: 'reconocimiento', otros: 'otros', aldeas: 'otros',
    };

    const created: PlanAsignacion[] = [];

    for (const row of rows) {
      const contenidoLower = row.contenido.toLowerCase().trim();
      const estadoEspecial = Object.keys(ESTADOS_ESPECIALES).find(k =>
        contenidoLower.startsWith(k),
      );

      // Buscar o crear técnico
      let tecnico = await this.tecnicos.findOne({
        where: { nombre: row.tecnicoNombre, activo: true },
      });

      if (!tecnico) continue; // skip si no existe el técnico

      const asig: Partial<PlanAsignacion> = {
        tecnico_id: tecnico.id,
        fecha: row.fecha,
        provincia_trabajo_id: row.provinciaId,
        estadoEspecial: estadoEspecial
          ? (ESTADOS_ESPECIALES[estadoEspecial] as any)
          : null,
        observaciones: estadoEspecial ? undefined : row.contenido,
      };

      // Intentar crear — ignorar conflictos
      try {
        const a = await this.asignaciones.save(this.asignaciones.create(asig));
        created.push(a);
      } catch (_) {}
    }

    return { importadas: created.length };
  }
}

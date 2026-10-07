import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ProyectoIngenieria } from './entities/proyecto-ingenieria.entity';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { FASE_FINALIZACION, FASES_OBRA, FaseObra } from './entities/fase-obra.entity';
import { Retencion } from './entities/retencion.entity';
import { MedicionDesviacion } from './entities/medicion-desviacion.entity';
import { DocumentoObra } from './entities/documento-obra.entity';
import { HITOS_OBRA, HitoObra } from './entities/hito-obra.entity';
import { NotaObra } from './entities/nota-obra.entity';
import { GuardarMedicionesDto, MedicionDto, RetencionDto, UpdateFaseDto } from './dto/ficha.dto';
import { CreateHitoDto, HitoDto } from './dto/hito.dto';
import { CreateNotaDto, NotaDto } from './dto/nota.dto';

/** Todo lo que necesita la ficha de una obra: sus fases, hitos, retenciones, mediciones, papeles y notas. */
export interface FichaObra {
  obra: ProyectoIngenieria;
  fases: FaseObra[];
  hitos: HitoObra[];
  retenciones: Retencion[];
  mediciones: MedicionDesviacion[];
  documentos: DocumentoObra[];
  /** El bloc de notas de la obra, la más reciente primero. */
  notas: NotaObra[];
  /** FINALIZADA = la fase «Finalización obra» tiene fecha_fin_real (aunque la retención siga pendiente). */
  finalizada: boolean;
  /** La primera fase sin fecha_fin_real, o null si ya están las 7 terminadas. */
  fase_actual: string | null;
}

/** Lo que se pinta en la tabla y en el Gantt: en qué punto está la obra. */
export interface EstadoObra {
  finalizada: boolean;
  fase_actual: string | null;
  fases_hechas: number;
  /** Fecha real en que terminó la fase «Finalización obra» (la que manda la obra a Finalizadas). */
  fecha_finalizacion: string | null;
  /** Las 7 fases en orden, con lo mínimo para poder marcarlas desde la tabla. */
  fases: { id: string; fase: string; orden: number; fecha_inicio_real: string | null; fecha_fin_real: string | null }[];
}

/** Los indicadores de la cabecera de la pantalla. */
export interface ResumenObras {
  clientes_activos: number;
  obras_activas: number;
  /** Media de los márgenes reales de las obras en curso (null si todavía no hay ninguno). */
  margen_real_medio: number | null;
  /** Suma del impacto de las mediciones de las obras en curso (null si no hay mediciones). */
  desviacion_total: number | null;
  obras_finalizadas: number;
  obras_totales: number;
}

@Injectable()
export class IngenieriaService {
  constructor(
    @InjectRepository(ProyectoIngenieria) private repo: Repository<ProyectoIngenieria>,
    @InjectRepository(FaseObra) private fases: Repository<FaseObra>,
    @InjectRepository(Retencion) private retenciones: Repository<Retencion>,
    @InjectRepository(MedicionDesviacion) private mediciones: Repository<MedicionDesviacion>,
    @InjectRepository(DocumentoObra) private documentos: Repository<DocumentoObra>,
    @InjectRepository(HitoObra) private hitos: Repository<HitoObra>,
    @InjectRepository(NotaObra) private notas: Repository<NotaObra>,
  ) {}

  // ── Obras ─────────────────────────────────────────────────────────────────────────────────────

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

  /**
   * Crea la obra con su número (OB-AAAA-NNN si no se le pone otro) y le siembra las 7 fases, para
   * que el Gantt y la fase actual tengan siempre de dónde tirar. También le siembra los 4 hitos de
   * siempre (sin fecha), para que el diagrama traiga su fila de hitos desde el primer día.
   */
  async create(dto: CreateProyectoDto): Promise<ProyectoIngenieria> {
    const p = this.repo.create(dto);
    if (!p.num_obra) p.num_obra = await this.siguienteNumObra();
    const guardada = await this.repo.save(p);
    await this.sembrarFases(guardada.id);
    await this.sembrarHitos(guardada.id);
    return this.repo.findOne({ where: { id: guardada.id } }) as Promise<ProyectoIngenieria>;
  }

  async update(id: string, dto: Partial<CreateProyectoDto>): Promise<ProyectoIngenieria> {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    // Limpiar la relación eager para que TypeORM use la columna FK recién asignada
    if (dto.tecnico_id) p.tecnico = { id: dto.tecnico_id } as any;
    else if (dto.tecnico_id === null) p.tecnico = undefined as any;
    return this.repo.save(p);
  }

  async remove(id: string): Promise<void> {
    const p = await this.findOne(id);
    p.activo = false;
    await this.repo.save(p);
  }

  /** OB-AAAA-NNN con el año en curso y el siguiente número libre de ese año. */
  async siguienteNumObra(): Promise<string> {
    const prefijo = `OB-${new Date().getFullYear()}-`;
    const filas = await this.repo.createQueryBuilder('o')
      .select('o.num_obra', 'num_obra')
      .where('o.num_obra LIKE :p', { p: `${prefijo}%` })
      .getRawMany<{ num_obra: string }>();
    const ultimo = filas.reduce((max, f) => {
      const n = parseInt(String(f.num_obra).slice(prefijo.length), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return `${prefijo}${String(ultimo + 1).padStart(3, '0')}`;
  }

  // ── Fases ─────────────────────────────────────────────────────────────────────────────────────

  /** Siembra las 7 fases de una obra (si ya las tiene, no toca nada). Devuelve cuántas hay. */
  async sembrarFases(obraId: string): Promise<number> {
    const ya = await this.fases.count({ where: { obra_id: obraId } });
    if (ya > 0) return ya;
    await this.fases.save(FASES_OBRA.map((f, i) => this.fases.create({
      obra_id: obraId, fase: f.slug, orden: i + 1,
    })));
    return FASES_OBRA.length;
  }

  /** Siembra las fases de TODAS las obras que aún no las tengan (las que venían de antes). */
  async sembrarFasesDeTodas(): Promise<{ obras: number; fases_creadas: number }> {
    const obras = await this.repo.find({ select: { id: true } });
    let creadas = 0;
    for (const o of obras) {
      const antes = await this.fases.count({ where: { obra_id: o.id } });
      if (antes === 0) {
        await this.sembrarFases(o.id);
        creadas += FASES_OBRA.length;
      }
    }
    return { obras: obras.length, fases_creadas: creadas };
  }

  // ── Hitos ─────────────────────────────────────────────────────────────────────────────────────

  /**
   * Siembra los hitos de siempre en una obra, sin fecha. Es idempotente y respetuoso: solo añade los
   * que faltan POR NOMBRE, así que a una obra que ya tenía «Inicio» o «Puesta en marcha» (con su
   * fecha puesta a mano) no le toca nada. Devuelve cuántos hitos tiene la obra al terminar.
   */
  async sembrarHitos(obraId: string): Promise<number> {
    const ya = await this.hitos.find({ where: { obra_id: obraId } });
    const puestos = new Set(ya.map(h => String(h.nombre).trim().toLowerCase()));
    const faltan = HITOS_OBRA.filter(n => !puestos.has(n.toLowerCase()));
    if (faltan.length) {
      await this.hitos.save(faltan.map(nombre => this.hitos.create({ obra_id: obraId, nombre })));
    }
    return ya.length + faltan.length;
  }

  /** Siembra los hitos de siempre en TODAS las obras (las que venían de antes se quedaron sin ellos). */
  async sembrarHitosDeTodas(): Promise<{ obras: number; hitos_creados: number }> {
    const obras = await this.repo.find({ select: { id: true } });
    let creados = 0;
    for (const o of obras) {
      const antes = await this.hitos.count({ where: { obra_id: o.id } });
      const despues = await this.sembrarHitos(o.id);
      creados += despues - antes;
    }
    return { obras: obras.length, hitos_creados: creados };
  }

  async actualizarFase(faseId: string, dto: UpdateFaseDto): Promise<FaseObra> {
    const f = await this.fases.findOne({ where: { id: faseId } });
    if (!f) throw new NotFoundException(`Fase ${faseId} no encontrada`);
    // Se asigna campo a campo: así una fecha vacía deja el dato a null (deshacer) y no se cuela
    // una cadena vacía en una columna de tipo fecha.
    if (dto.fecha_inicio_prevista !== undefined) f.fecha_inicio_prevista = this.fecha(dto.fecha_inicio_prevista);
    if (dto.fecha_fin_prevista !== undefined) f.fecha_fin_prevista = this.fecha(dto.fecha_fin_prevista);
    if (dto.fecha_inicio_real !== undefined) f.fecha_inicio_real = this.fecha(dto.fecha_inicio_real);
    if (dto.fecha_fin_real !== undefined) f.fecha_fin_real = this.fecha(dto.fecha_fin_real);
    return this.fases.save(f);
  }

  /** 'aaa-mm-dd' → Date; vacío o nulo → null. */
  private fecha(v?: string | null): Date | null {
    if (v == null || v === '') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Número; vacío o nulo → null (nunca 0 por error). */
  private numero(v?: number | string | null): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** La ficha completa de una obra (lo que abre el panel al pulsar «Ver ficha»). */
  async ficha(id: string): Promise<FichaObra> {
    const obra = await this.findOne(id);
    const [fases, hitos, retenciones, mediciones, documentos, notas] = await Promise.all([
      this.fases.find({ where: { obra_id: id }, order: { orden: 'ASC' } }),
      this.hitos.find({ where: { obra_id: id }, order: { fecha: 'ASC', createdAt: 'ASC' } }),
      this.retenciones.find({ where: { obra_id: id }, order: { createdAt: 'DESC' } }),
      this.mediciones.find({ where: { obra_id: id }, order: { createdAt: 'ASC' } }),
      this.documentos.find({ where: { obra_id: id }, order: { fecha_subida: 'DESC' } }),
      this.notas.find({ where: { obra_id: id }, order: { createdAt: 'DESC' } }),
    ]);
    // El estado trae un resumen ligero de las fases; en la ficha manda la lista completa.
    const estado = this.estadoDe(fases);
    return { ...estado, obra, fases, hitos, retenciones, mediciones, documentos, notas };
  }

  /** Estado (finalizada / fase actual / fases hechas) de todas las obras, para pintar las tablas. */
  async estados(): Promise<Record<string, EstadoObra>> {
    const fases = await this.fases.find();
    const porObra = new Map<string, FaseObra[]>();
    fases.forEach(f => porObra.set(f.obra_id, [...(porObra.get(f.obra_id) ?? []), f]));
    const salida: Record<string, EstadoObra> = {};
    porObra.forEach((fs, obraId) => { salida[obraId] = this.estadoDe(fs); });
    return salida;
  }

  /** En qué punto está la obra, mirando sus fases. */
  private estadoDe(fases: FaseObra[]): EstadoObra {
    const ordenadas = [...fases].sort((a, b) => a.orden - b.orden);
    const fin = fases.find(f => f.fase === FASE_FINALIZACION);
    const actual = ordenadas.find(f => !f.fecha_fin_real);
    return {
      finalizada: !!fin?.fecha_fin_real,
      fase_actual: actual?.fase ?? null,
      fases_hechas: fases.filter(f => !!f.fecha_fin_real).length,
      fecha_finalizacion: this.soloDia(fin?.fecha_fin_real),
      fases: ordenadas.map(f => ({
        id: f.id,
        fase: f.fase,
        orden: f.orden,
        fecha_inicio_real: this.soloDia(f.fecha_inicio_real),
        fecha_fin_real: this.soloDia(f.fecha_fin_real),
      })),
    };
  }

  /** Una fecha → 'aaaa-mm-dd' (lo que esperan los <input type="date">). */
  private soloDia(v?: Date | string | null): string | null {
    if (!v) return null;
    return String(v).slice(0, 10);
  }

  // ── Hitos de la obra (los rombos del Gantt) ───────────────────────────────────────────────────

  async crearHito(obraId: string, dto: CreateHitoDto): Promise<HitoObra> {
    await this.findOne(obraId);
    return this.hitos.save(this.hitos.create({
      obra_id: obraId,
      nombre: dto.nombre,
      fecha: this.fecha(dto.fecha),
      hecho: dto.hecho ?? false,
    }));
  }

  async actualizarHito(id: string, dto: HitoDto): Promise<HitoObra> {
    const h = await this.hitos.findOne({ where: { id } });
    if (!h) throw new NotFoundException(`Hito ${id} no encontrado`);
    if (dto.nombre !== undefined) h.nombre = dto.nombre;
    if (dto.fecha !== undefined) h.fecha = this.fecha(dto.fecha);
    if (dto.hecho !== undefined) h.hecho = dto.hecho;
    return this.hitos.save(h);
  }

  async borrarHito(id: string): Promise<void> {
    const h = await this.hitos.findOne({ where: { id } });
    if (!h) throw new NotFoundException(`Hito ${id} no encontrado`);
    await this.hitos.remove(h);
  }

  // ── Notas de la obra ──────────────────────────────────────────────────────────────────────────

  async crearNota(obraId: string, dto: CreateNotaDto): Promise<NotaObra> {
    await this.findOne(obraId);
    const texto = (dto.texto ?? '').trim();
    if (!texto) throw new BadRequestException('La nota no puede estar vacía');
    return this.notas.save(this.notas.create({
      obra_id: obraId,
      texto,
      autor: dto.autor?.trim() || null,
      autor_id: dto.autor_id ?? null,
    }));
  }

  async actualizarNota(id: string, dto: NotaDto): Promise<NotaObra> {
    const n = await this.notas.findOne({ where: { id } });
    if (!n) throw new NotFoundException(`Nota ${id} no encontrada`);
    if (dto.texto !== undefined) {
      const texto = dto.texto.trim();
      if (!texto) throw new BadRequestException('La nota no puede estar vacía');
      n.texto = texto;
    }
    if (dto.autor !== undefined) n.autor = dto.autor?.trim() || null;
    if (dto.autor_id !== undefined) n.autor_id = dto.autor_id ?? null;
    return this.notas.save(n);
  }

  async borrarNota(id: string): Promise<void> {
    const n = await this.notas.findOne({ where: { id } });
    if (!n) throw new NotFoundException(`Nota ${id} no encontrada`);
    await this.notas.remove(n);
  }

  // ── Retenciones ───────────────────────────────────────────────────────────────────────────────

  async crearRetencion(obraId: string, dto: RetencionDto): Promise<Retencion> {
    await this.findOne(obraId);
    return this.retenciones.save(this.retenciones.create({
      ...this.datosRetencion(dto), obra_id: obraId,
    }));
  }

  async actualizarRetencion(id: string, dto: RetencionDto): Promise<Retencion> {
    const r = await this.retenciones.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Retención ${id} no encontrada`);
    Object.assign(r, this.datosRetencion(dto));
    return this.retenciones.save(r);
  }

  /** Normaliza lo que llega del panel: números de verdad o null, fechas Date o null. */
  private datosRetencion(dto: RetencionDto) {
    const datos: Partial<Retencion> = {};
    if (dto.importe !== undefined) datos.importe = this.numero(dto.importe);
    if (dto.plazo !== undefined) datos.plazo = dto.plazo ?? null;
    if (dto.fecha_vencimiento !== undefined) datos.fecha_vencimiento = this.fecha(dto.fecha_vencimiento);
    if (dto.estado !== undefined) datos.estado = dto.estado;
    if (dto.fecha_liberacion !== undefined) datos.fecha_liberacion = this.fecha(dto.fecha_liberacion);
    return datos;
  }

  async borrarRetencion(id: string): Promise<void> {
    const r = await this.retenciones.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Retención ${id} no encontrada`);
    await this.retenciones.remove(r);
  }

  // ── Mediciones vs planos ──────────────────────────────────────────────────────────────────────

  /** Guarda el informe de mediciones de una obra: lo que hubiera se reemplaza por lo nuevo. */
  async guardarMediciones(obraId: string, dto: GuardarMedicionesDto): Promise<MedicionDesviacion[]> {
    await this.findOne(obraId);
    await this.mediciones.delete({ obra_id: obraId });
    const filas = (dto.mediciones ?? []).map(m => this.mediciones.create({
      ...this.datosMedicion(m), obra_id: obraId,
    }));
    return this.mediciones.save(filas);
  }

  async anadirMedicion(obraId: string, dto: MedicionDto): Promise<MedicionDesviacion> {
    await this.findOne(obraId);
    return this.mediciones.save(this.mediciones.create({
      ...this.datosMedicion(dto), obra_id: obraId,
    }));
  }

  /** Normaliza una partida del informe de mediciones. */
  private datosMedicion(m: MedicionDto): Partial<MedicionDesviacion> {
    const datos: Partial<MedicionDesviacion> = {};
    if (m.partida !== undefined) datos.partida = m.partida ?? null;
    if (m.unidad !== undefined) datos.unidad = m.unidad ?? null;
    if (m.cantidad_excel !== undefined) datos.cantidad_excel = this.numero(m.cantidad_excel);
    if (m.cantidad_plano !== undefined) datos.cantidad_plano = this.numero(m.cantidad_plano);
    if (m.diferencia_pct !== undefined) datos.diferencia_pct = this.numero(m.diferencia_pct);
    if (m.impacto_eur !== undefined) datos.impacto_eur = this.numero(m.impacto_eur);
    return datos;
  }

  async borrarMedicion(id: string): Promise<void> {
    const m = await this.mediciones.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`Medición ${id} no encontrada`);
    await this.mediciones.remove(m);
  }

  // ── Documentación de la obra ──────────────────────────────────────────────────────────────────

  /** Guarda el archivo que ha subido multer y lo apunta en la obra (XLSX, PDF, DWG u otro). */
  async guardarDocumento(obraId: string, file?: Express.Multer.File): Promise<DocumentoObra> {
    if (!file) throw new BadRequestException('No ha llegado ningún archivo');
    await this.findOne(obraId);
    return this.documentos.save(this.documentos.create({
      obra_id: obraId,
      nombre: file.originalname,
      tipo: this.tipoDeDocumento(file.originalname),
      fichero: file.filename,
      ruta: `/uploads/obras/${obraId}/${file.filename}`,
      bytes: file.size,
    }));
  }

  async borrarDocumento(obraId: string, docId: string): Promise<void> {
    const d = await this.documentos.findOne({ where: { id: docId, obra_id: obraId } });
    if (!d) throw new NotFoundException(`Documento ${docId} no encontrado`);
    if (d.fichero) {
      const ruta = join(process.cwd(), 'uploads', 'obras', obraId, d.fichero);
      try {
        if (existsSync(ruta)) unlinkSync(ruta);
      } catch {
        // Si el fichero ya no está en el disco, el registro se borra igual: no se bloquea por eso.
      }
    }
    await this.documentos.remove(d);
  }

  /** La etiqueta del documento (la que se pinta en el panel) según su extensión. */
  private tipoDeDocumento(nombre: string): string {
    const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
    if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) return 'XLSX';
    if (ext === 'pdf') return 'PDF';
    if (['dwg', 'dxf'].includes(ext)) return 'DWG';
    return 'OTRO';
  }

  // ── Indicadores de la pantalla ────────────────────────────────────────────────────────────────

  /** Los cuatro números de la cabecera. Lo que no existe sale null (el panel pinta «—»). */
  async resumenObras(): Promise<ResumenObras> {
    const obras = await this.repo.find({ where: { activo: true } });
    const fases = await this.fases.find();
    const porObra = new Map<string, FaseObra[]>();
    fases.forEach(f => porObra.set(f.obra_id, [...(porObra.get(f.obra_id) ?? []), f]));

    const activas = obras.filter(o => !this.estadoDe(porObra.get(o.id) ?? []).finalizada);
    const idsActivas = new Set(activas.map(o => o.id));

    const clientes = new Set(activas.map(o => o.cliente_id ?? o.cliente).filter(Boolean));
    const margenes = activas
      .map(o => (o.margen_real == null ? null : Number(o.margen_real)))
      .filter((v): v is number => v != null && Number.isFinite(v));
    const impactos = (await this.mediciones.find())
      .filter(m => idsActivas.has(m.obra_id))
      .map(m => (m.impacto_eur == null ? null : Number(m.impacto_eur)))
      .filter((v): v is number => v != null && Number.isFinite(v));

    const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    return {
      clientes_activos: clientes.size,
      obras_activas: activas.length,
      margen_real_medio: media(margenes),
      desviacion_total: impactos.length ? impactos.reduce((a, b) => a + b, 0) : null,
      obras_finalizadas: obras.length - activas.length,
      obras_totales: obras.length,
    };
  }
}

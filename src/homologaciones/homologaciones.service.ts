import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  ArchivoObra, EstadoHomologacion, Homologacion, InstalacionHomologacion,
} from './entities/homologacion.entity';
import { CreateHomologacionDto, UpdateHomologacionDto } from './dto/homologacion.dto';
import { ProyectoIngenieria } from '../ingenieria/entities/proyecto-ingenieria.entity';
import { AnalizadorService } from './analizador.service';
import { InformePdfService } from './informe-pdf.service';

/** Los cinco tipos, en el orden en que se enseñan (y con el que se cuentan). */
const TIPOS: InstalacionHomologacion[] = [
  InstalacionHomologacion.CLIMA,
  InstalacionHomologacion.FONTANERIA,
  InstalacionHomologacion.PCI,
  InstalacionHomologacion.TELECO,
  InstalacionHomologacion.ELECTRICIDAD,
];

/**
 * Disciplinas del registro de obras → instalaciones de homologación. Es lo que permite proponer
 * solo lo que tiene la obra: un trámite de una obra de clima + PCI no debe pedir teleco.
 * (Ventilación y aerotermia son parte de la instalación térmica; saneamiento, del agua.)
 */
const DISCIPLINA_A_TIPO: Record<string, InstalacionHomologacion> = {
  climatizacion: InstalacionHomologacion.CLIMA,
  ventilacion: InstalacionHomologacion.CLIMA,
  aerotermia: InstalacionHomologacion.CLIMA,
  fontaneria: InstalacionHomologacion.FONTANERIA,
  saneamiento: InstalacionHomologacion.FONTANERIA,
  pci: InstalacionHomologacion.PCI,
  telecom: InstalacionHomologacion.TELECO,
  electricidad: InstalacionHomologacion.ELECTRICIDAD,
};

@Injectable()
export class HomologacionesService {
  constructor(
    @InjectRepository(Homologacion) private repo: Repository<Homologacion>,
    @InjectRepository(ProyectoIngenieria) private obras: Repository<ProyectoIngenieria>,
    private analizador: AnalizadorService,
    private informes: InformePdfService,
  ) {}

  /**
   * Analiza la documentación del trámite (Excel de mediciones, planos PDF y DWG) y guarda el
   * resultado POR INSTALACIÓN en el propio trámite. Es un borrador: lo revisa y firma un técnico.
   */
  async analizar(id: string): Promise<Homologacion> {
    const h = await this.findOne(id);
    if (!(h.archivos ?? []).length) {
      throw new BadRequestException('El trámite no tiene documentación subida: no hay nada que analizar');
    }
    h.resultados = await this.analizador.analizar(h);
    h.analizado_en = new Date();
    return this.repo.save(h);
  }

  /**
   * Los informes en PDF (mediciones vs planos, cumplimiento normativo o los dos en uno) a partir
   * del análisis guardado. Si todavía no se ha analizado, se dice: no se inventa un informe vacío.
   */
  async informePdf(id: string, tipo: string): Promise<{ buffer: Buffer; nombre: string }> {
    const h = await this.findOne(id);
    return this.informes.genera(h, tipo);
  }

  async findAll(f: {
    estado?: EstadoHomologacion; responsable?: string; instalacion?: string; proyecto_id?: string;
  }) {
    const where: any = { activo: true };
    if (f.estado) where.estado = f.estado;
    if (f.responsable) where.responsable = f.responsable;
    if (f.proyecto_id) where.proyecto_id = f.proyecto_id;
    const todas = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    // El filtro por instalación va en memoria: `instalaciones` es jsonb y una obra lleva varias.
    return f.instalacion
      ? todas.filter((h) => (h.instalaciones ?? []).includes(f.instalacion as string))
      : todas;
  }

  async findOne(id: string): Promise<Homologacion> {
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException(`Homologación ${id} no encontrada`);
    return h;
  }

  async create(dto: CreateHomologacionDto): Promise<Homologacion> {
    const h = new Homologacion();
    Object.assign(h, dto);
    // El expediente empieza el día que se da de alta (no se teclea, igual que en legalizaciones).
    if (!h.fecha_inicio) h.fecha_inicio = new Date().toISOString().slice(0, 10);
    await this.atarAObra(h);
    h.instalaciones = this.limpiaInstalaciones(h.instalaciones);
    return this.repo.save(h);
  }

  async update(id: string, dto: UpdateHomologacionDto): Promise<Homologacion> {
    const h = await this.findOne(id);
    Object.assign(h, dto);
    if (dto.instalaciones) h.instalaciones = this.limpiaInstalaciones(dto.instalaciones);
    // Asignar la obra (o cambiarla) vuelve a completar lo que falte y el nombre de la obra.
    if (dto.proyecto_id) await this.atarAObra(h);
    return this.repo.save(h);
  }

  /** Borrado lógico (el expediente se puede recuperar): se marca `activo = false`. */
  async remove(id: string): Promise<void> {
    const h = await this.findOne(id);
    h.activo = false;
    await this.repo.save(h);
  }

  // ── Documentación de la obra (Excel de mediciones, PDF y DWG) ─────────────────────────────
  // Los archivos se guardan en el disco de la Pi (`uploads/homologaciones/<id>/`) y el trámite
  // guarda su ficha (nombre original, tipo, tamaño, fecha y de dónde se descarga).

  /** Guarda el archivo que ha subido multer y lo apunta en el trámite. */
  async guardarArchivo(id: string, file?: Express.Multer.File): Promise<Homologacion> {
    if (!file) throw new BadRequestException('No ha llegado ningún archivo');
    const h = await this.findOne(id);
    const registro: ArchivoObra = {
      nombre: file.originalname,
      tipo: this.tipoDeArchivo(file.originalname),
      bytes: file.size,
      subido: new Date().toISOString().slice(0, 10),
      fichero: file.filename,
      url: `/uploads/homologaciones/${id}/${file.filename}`,
    };
    h.archivos = [...(h.archivos ?? []), registro];
    return this.repo.save(h);
  }

  /** Quita un archivo del trámite y lo borra del disco. */
  async borrarArchivo(id: string, indice: number): Promise<Homologacion> {
    const h = await this.findOne(id);
    const lista = h.archivos ?? [];
    const quitado = lista[indice];
    if (!quitado) throw new NotFoundException(`El trámite ${id} no tiene un archivo en esa posición`);
    if (quitado.fichero) {
      const ruta = join(process.cwd(), 'uploads', 'homologaciones', id, quitado.fichero);
      try {
        if (existsSync(ruta)) unlinkSync(ruta);
      } catch {
        // Si el fichero ya no está, el trámite se actualiza igual: no se bloquea por el disco.
      }
    }
    h.archivos = lista.filter((_, i) => i !== indice);
    return this.repo.save(h);
  }

  /** Qué es cada archivo por su extensión (es lo que decide el analizador después). */
  private tipoDeArchivo(nombre: string): string {
    const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
    if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) return 'excel';
    if (ext === 'pdf') return 'pdf';
    if (['dwg', 'dxf'].includes(ext)) return 'dwg';
    return 'otro';
  }

  /**
   * Ata el trámite a su obra y completa con ella lo que no venga puesto: el titular, el número de
   * obra, la dirección y la provincia son de la obra y no se teclean dos veces. Si el trámite no
   * trae instalaciones, se proponen las que tenga la obra (sus disciplinas).
   */
  private async atarAObra(h: Homologacion): Promise<void> {
    if (!h.proyecto_id) return;
    const obra = await this.obras.findOne({ where: { id: h.proyecto_id } });
    if (!obra) return;
    h.proyecto_nombre = obra.nombre;
    h.cliente = h.cliente || obra.cliente;
    h.num_obra = h.num_obra || obra.num_obra;
    h.direccion = h.direccion || obra.direccion;
    h.provincia = h.provincia || obra.provincia;
    if (!h.responsable && (obra.responsables ?? []).length === 1) h.responsable = obra.responsables[0];
    if ((h.instalaciones ?? []).length === 0) h.instalaciones = this.tiposDeLaObra(obra.disciplinas);
  }

  /** Instalaciones que se deducen de las disciplinas de la obra (sin repetir y en orden). */
  tiposDeLaObra(disciplinas?: string[] | null): string[] {
    const puestas = new Set<string>();
    for (const d of disciplinas ?? []) {
      const t = DISCIPLINA_A_TIPO[String(d).trim().toLowerCase()];
      if (t) puestas.add(t);
    }
    return this.limpiaInstalaciones([...puestas]);
  }

  /** Resumen del apartado: por estado, por instalación, por obra y los totales de los informes. */
  async resumen() {
    const todas = await this.repo.find({ where: { activo: true } });
    const porEstado: Record<string, number> = {};
    const porInstalacion: Record<string, number> = {};
    for (const t of TIPOS) porInstalacion[t] = 0;
    const porResponsable: Record<string, number> = {};
    const porProvincia: Record<string, number> = {};
    const porObra: Record<string, number> = {};

    let incumplimientos = 0, dudas = 0, observaciones = 0, noAsociados = 0;
    let favor = 0, contra = 0, parados = 0, pendientesRevision = 0, sinObra = 0;

    for (const h of todas) {
      porEstado[h.estado] = (porEstado[h.estado] ?? 0) + 1;
      for (const t of h.instalaciones ?? []) porInstalacion[t] = (porInstalacion[t] ?? 0) + 1;
      const r = h.responsable || 'Sin asignar';
      porResponsable[r] = (porResponsable[r] ?? 0) + 1;
      const p = h.provincia || 'Sin provincia';
      porProvincia[p] = (porProvincia[p] ?? 0) + 1;
      // El trámite se cuenta por su OBRA; los que todavía no la tienen, aparte y a la vista.
      const o = h.proyecto_nombre || 'Sin obra vinculada';
      porObra[o] = (porObra[o] ?? 0) + 1;
      if (!h.proyecto_id) sinObra++;

      incumplimientos += h.n_incumplimientos ?? 0;
      dudas += h.n_dudas ?? 0;
      observaciones += h.n_observaciones ?? 0;
      noAsociados += h.n_no_asociados ?? 0;
      favor += Number(h.impacto_favor ?? 0);
      contra += Number(h.impacto_contra ?? 0);
      if (h.parado) parados++;
      // Lo emitido y aún sin firmar por el técnico: es lo que espera revisión.
      if (h.estado === EstadoHomologacion.BORRADOR_EMITIDO) pendientesRevision++;
    }

    return {
      total: todas.length,
      porEstado,
      porInstalacion,
      porResponsable,
      porProvincia,
      porObra,
      sin_obra: sinObra,
      diagnosticos: { incumplimientos, dudas, observaciones, no_asociados: noAsociados },
      impacto: {
        favor: Math.round(favor * 100) / 100,
        contra: Math.round(contra * 100) / 100,
        neto: Math.round((favor - contra) * 100) / 100,
      },
      parados,
      pendientes_revision: pendientesRevision,
    };
  }

  /** Solo los cinco tipos válidos, sin repetir y en el orden del catálogo (el documento no cambia). */
  private limpiaInstalaciones(valor?: string[] | null): string[] {
    if (!valor) return [];
    const puestas = new Set(valor.map((v) => String(v).trim().toLowerCase()));
    return TIPOS.filter((t) => puestas.has(t));
  }
}

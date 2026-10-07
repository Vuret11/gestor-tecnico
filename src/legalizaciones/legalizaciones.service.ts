import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Legalizacion, EstadoLegalizacion } from './entities/legalizacion.entity';
import {
  ETAPAS_LEGALIZACION,
  EtapaLegalizacion,
  RegistroEtapaLegalizacion,
} from './entities/registro-etapa.entity';
import { CreateLegalizacionDto, UpdateLegalizacionDto } from './dto/legalizacion.dto';
import { User } from '../users/entities/user.entity';
import { GeneradorDocumentosService } from './documentos/generador.service';
import { CalcularTramiteService } from './documentos/motor/calcular-tramite.service';
import { TramiteParaDocumentos, datosQueFaltan } from './documentos/armador';

@Injectable()
export class LegalizacionesService {
  constructor(
    @InjectRepository(Legalizacion) private repo: Repository<Legalizacion>,
    @InjectRepository(RegistroEtapaLegalizacion) private etapasRepo: Repository<RegistroEtapaLegalizacion>,
    @InjectRepository(User) private usuarios: Repository<User>,
    private readonly generador: GeneradorDocumentosService,
    private readonly calculo: CalcularTramiteService,
  ) {}

  findAll(f: { estado?: EstadoLegalizacion; responsable?: string }) {
    const where: any = { activo: true };
    if (f.estado) where.estado = f.estado;
    if (f.responsable) where.responsable = f.responsable;
    return this.repo.find({ where, order: { id_externo: 'ASC' } });
  }

  async findOne(id: string): Promise<Legalizacion> {
    const l = await this.repo.findOne({ where: { id } });
    if (!l) throw new NotFoundException(`Legalización ${id} no encontrada`);
    return l;
  }

  async create(dto: CreateLegalizacionDto): Promise<Legalizacion> {
    // FECHA_INICIO_AUTOMATICA: el tramite empieza el dia que se crea (no se teclea)
    if (!dto.fecha_inicio) dto.fecha_inicio = new Date().toISOString().slice(0, 10);
    const l = new Legalizacion();
    Object.assign(l, dto);
    // Los cálculos del CTE (demanda de ACS, Qusable y Eres) los pone el programa, no el instalador.
    Object.assign(l, await this.calculo.calcular(l));
    const guardado = await this.repo.save(l);
    return (await this.generarSiProcede(guardado)) ?? guardado;
  }

  async update(id: string, dto: UpdateLegalizacionDto): Promise<Legalizacion> {
    const l = await this.findOne(id);
    Object.assign(l, dto);
    Object.assign(l, await this.calculo.calcular(l));
    const guardado = await this.repo.save(l);
    return (await this.generarSiProcede(guardado)) ?? guardado;
  }

  /**
   * AUTO-GENERACION DE DOCUMENTOS (pedido de Salva, 2-oct-2026): «cuando se cree una instalacion
   * y se pongan los datos se deben generar los documentos».
   *
   * En cuanto el tramite tiene los datos imprescindibles, los seis documentos se generan y se
   * guardan solos (carpeta `data/documentos-legalizacion/<id>/`). Nunca tumba el alta ni la
   * edicion: si falta configuracion o un documento falla, el tramite se guarda igual y se puede
   * regenerar desde la ficha del tramite.
   */
  private async generarSiProcede(tramite: Legalizacion): Promise<Legalizacion | null> {
    if (datosQueFaltan(tramite as unknown as TramiteParaDocumentos).length > 0) return null;
    try {
      await this.generador.generarYGuardarTodos(tramite.id);
      return await this.repo.findOne({ where: { id: tramite.id } });
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    const l = await this.findOne(id);
    l.activo = false;
    await this.repo.save(l);
  }

  /**
   * Las etapas de un trámite (Inicio, Subida Portal y Finalizado) con su estado actual y TODO su
   * registro. Las tres salen siempre, aunque nadie haya pulsado todavía, para que la ficha no aparezca
   * a medias: sin ninguna fila en el registro, las tres están pendientes.
   */
  async etapas(id: string) {
    await this.findOne(id);
    const filas = await this.etapasRepo.find({
      where: { legalizacionId: id },
      order: { fecha: 'ASC', createdAt: 'ASC' },
    });

    // El estado de una etapa es su ÚLTIMA fila (el registro no se borra nunca).
    const estado = ETAPAS_LEGALIZACION.map(({ etapa, etiqueta, ayuda }) => {
      const ultima = [...filas].reverse().find((f) => f.etapa === etapa);
      const hecha = ultima?.hecha ?? false;
      return {
        etapa,
        etiqueta,
        ayuda,
        hecha,
        // Lo que se enseña en la ficha es cuándo se marcó por última vez y quién.
        fecha: hecha ? ultima!.fecha : null,
        usuario: hecha ? ultima!.usuarioNombre ?? null : null,
      };
    });

    return {
      id,
      etapas: estado,
      registro: filas.map((f) => ({
        etapa: f.etapa,
        etiqueta: ETAPAS_LEGALIZACION.find((e) => e.etapa === f.etapa)?.etiqueta ?? f.etapa,
        hecha: f.hecha,
        fecha: f.fecha,
        usuario: f.usuarioNombre ?? null,
      })),
    };
  }

  /**
   * Marca (o desmarca, con `hecha = false`) una etapa. Añade una fila al registro y **no borra nada**:
   * así queda quién y cuándo, que es lo que hace falta para poder justificar el trámite.
   */
  async marcarEtapa(
    id: string,
    etapa: EtapaLegalizacion,
    hecha: boolean,
    usuario?: { id?: string; nombre?: string },
  ) {
    await this.findOne(id);
    if (!ETAPAS_LEGALIZACION.some((e) => e.etapa === etapa)) {
      throw new BadRequestException(
        `Etapa «${etapa}» no existe. Las etapas son: ${ETAPAS_LEGALIZACION.map((e) => e.etapa).join(', ')}`,
      );
    }
    // El token lleva el id y el rol, pero no el nombre: se busca en la tabla para poder decir QUIÉN
    // marcó la etapa (y que se siga leyendo dentro de un año aunque cambie la cuenta).
    let nombre = usuario?.nombre ?? null;
    if (!nombre && usuario?.id) {
      const u = await this.usuarios.findOne({ where: { id: usuario.id } });
      nombre = u?.nombre ?? null;
    }
    await this.etapasRepo.save(
      this.etapasRepo.create({
        legalizacionId: id,
        etapa,
        hecha,
        usuarioId: usuario?.id ?? null,
        usuarioNombre: nombre,
      }),
    );
    return this.etapas(id);
  }

  /** Resumen para el cuadro de mando del apartado. */
  async resumen() {
    const todas = await this.repo.find({ where: { activo: true } });
    const porEstado: Record<string, number> = {};
    const porProvincia: Record<string, number> = {};
    const porResponsable: Record<string, number> = {};
    let docsListos = 0, docsTotal = 0, parados = 0;
    for (const l of todas) {
      porEstado[l.estado] = (porEstado[l.estado] ?? 0) + 1;
      const p = l.provincia || 'Sin provincia';
      porProvincia[p] = (porProvincia[p] ?? 0) + 1;
      const r = l.responsable || 'Sin asignar';
      porResponsable[r] = (porResponsable[r] ?? 0) + 1;
      docsListos += l.n_listo ?? 0;
      docsTotal += l.n_total ?? 0;
      if (l.parado) parados++;
    }
    return {
      total: todas.length,
      porEstado, porProvincia, porResponsable,
      documentos: { listos: docsListos, total: docsTotal },
      parados,
    };
  }

  /** Sincroniza una lista de expedientes del CRM por id_externo (crea o actualiza). */
  async sincronizar(lista: CreateLegalizacionDto[]) {
    let creados = 0, actualizados = 0;
    for (const dto of lista) {
      if (dto.id_externo == null) continue;
      const existe = await this.repo.findOne({ where: { id_externo: dto.id_externo } });
      if (existe) {
        Object.assign(existe, dto);
        Object.assign(existe, await this.calculo.calcular(existe));
        await this.repo.save(existe);
        actualizados++;
      } else {
        const l = new Legalizacion();
        Object.assign(l, dto);
        Object.assign(l, await this.calculo.calcular(l));
        await this.repo.save(l);
        creados++;
      }
    }
    return { creados, actualizados, total: lista.length };
  }
}

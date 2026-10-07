import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Legalizacion, EstadoLegalizacion } from './entities/legalizacion.entity';
import { CreateLegalizacionDto, UpdateLegalizacionDto } from './dto/legalizacion.dto';
import { GeneradorDocumentosService } from './documentos/generador.service';
import { CalcularTramiteService } from './documentos/motor/calcular-tramite.service';
import { TramiteParaDocumentos, datosQueFaltan } from './documentos/armador';

@Injectable()
export class LegalizacionesService {
  constructor(
    @InjectRepository(Legalizacion) private repo: Repository<Legalizacion>,
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

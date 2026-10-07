/**
 * GENERADOR de los seis documentos de legalización, dentro del gestor (Pi).
 *
 * Usa EXACTAMENTE los mismos mapeos y plantillas oficiales que el CRM:
 *   - autorizacion / declaracion-responsable -> pdfkit (texto, como en el CRM)
 *   - mod-315 / mod-318 / certificado-rsif / if-190 -> plantilla AcroForm rellenada (pdf-lib)
 *
 * El contexto lo arma `armador.ts` desde el trámite + la config fija + el catálogo de máquinas.
 * Los PDFs se guardan en `data/documentos-legalizacion/<id del trámite>/` y se apunta en la
 * columna `documentos_generados` del trámite.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import { Legalizacion } from '../entities/legalizacion.entity';
import { Maquina } from '../../maquinas/entities/maquina.entity';
import { rellenarPlantilla } from './pdf-lib-form-filler';
import { generarAutorizacion } from './autorizacion';
import { generarDeclaracionResponsable } from './declaracion-responsable';
import { MAPEO_MOD_315 } from './mapeos/mod-315.mapeo';
import { MAPEO_MOD_318 } from './mapeos/mod-318.mapeo';
import { MAPEO_CERTIFICADO_RSIF } from './mapeos/certificado-rsif.mapeo';
import { MAPEO_IF_190 } from './mapeos/if-190.mapeo';
import { ConfigDocumentos } from './config-documentos.entity';
import {
  CatalogoMaquinas,
  ConfigFija, NOMBRE_DOCUMENTO, TIPOS_DOCUMENTO, TipoDocumento, TramiteParaDocumentos,
  contextoIf190, contextoMod315, contextoMod318, contextoRsif, datosQueFaltan, documentosDelTramite,
  expedienteDeTramite, maquinasDeTramite,
} from './armador';
import type { Maquina as MaquinaDelCatalogo } from './crm/tipos';
import { ScopDhwOrigen, TipoUsoMaquina } from './crm/tipos';

/** Plantillas oficiales: viven junto al proyecto (no en node_modules). */
const RUTA_PLANTILLAS =
  process.env.RUTA_PLANTILLAS ?? path.join(__dirname, '../../../data/plantillas-legalizacion');
const RUTA_SALIDA = process.env.RUTA_DOCUMENTOS ?? path.join(__dirname, '../../../data/documentos-legalizacion');

@Injectable()
export class GeneradorDocumentosService {
  constructor(
    @InjectRepository(Legalizacion) private readonly tramites: Repository<Legalizacion>,
    @InjectRepository(Maquina) private readonly maquinas: Repository<Maquina>,
    @InjectRepository(ConfigDocumentos) private readonly config: Repository<ConfigDocumentos>,
  ) {}

  /** Config fija (empresa + personas), con un error claro si aún no se ha cargado. */
  async configFija(): Promise<ConfigFija> {
    const fila = await this.config.findOne({ where: { id: 1 } });
    if (!fila?.empresa || !fila?.personas?.length) {
      throw new BadRequestException(
        'Falta la configuración de documentos (empresa y personas). Cárgala con PUT /legalizaciones/config-documentos',
      );
    }
    return { empresa: fila.empresa, personas: fila.personas };
  }

  async guardarConfigFija(datos: ConfigFija): Promise<ConfigDocumentos> {
    const fila = (await this.config.findOne({ where: { id: 1 } })) ?? this.config.create({ id: 1 });
    fila.empresa = datos.empresa;
    fila.personas = datos.personas;
    return this.config.save(fila);
  }

  /**
   * El catálogo, en DOS mapas: por id del gestor y por id del CRM (cada trámite guarda uno u otro).
   *
   * Van separados a propósito: con un solo mapa el id del CRM PISA al id del gestor que coincide en
   * número (pasa en 183 de las 191 máquinas) y el documento salía con OTRA máquina — su potencia, su
   * refrigerante, su GWP y sus COP/EER. Se resuelve primero por id del gestor, que es el que guarda
   * el panel; el id del CRM queda de respaldo para los trámites importados.
   */
  private async catalogo(): Promise<CatalogoMaquinas> {
    const todas = await this.maquinas.find();
    const catalogo: CatalogoMaquinas = { porId: new Map(), porIdExterno: new Map() };
    for (const m of todas) {
      const convertida = aMaquinaDelCatalogo(m);
      catalogo.porId.set(Number(m.id), convertida);
      if (m.id_externo) catalogo.porIdExterno.set(Number(m.id_externo), convertida);
    }
    return catalogo;
  }

  async tramite(id: string): Promise<Legalizacion> {
    const t = await this.tramites.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`No existe el trámite ${id}`);
    return t;
  }

  /** Genera UN documento y devuelve su PDF (sin guardarlo). */
  async generarPdf(id: string, tipo: TipoDocumento): Promise<Buffer> {
    if (!TIPOS_DOCUMENTO.includes(tipo)) {
      throw new BadRequestException(`Documento desconocido: ${tipo}`);
    }
    const tramite = await this.tramite(id);
    const faltan = datosQueFaltan(tramite as unknown as TramiteParaDocumentos);
    if (faltan.length > 0) {
      throw new BadRequestException(`Al trámite ${tramite.num_obra ?? tramite.cliente ?? id} le faltan datos: ${faltan.join(', ')}`);
    }

    const config = await this.configFija();
    const catalogo = await this.catalogo();
    const t = tramite as unknown as TramiteParaDocumentos;

    if (tipo === 'autorizacion') {
      const apoderado = config.personas.find((p) => p.rol === 'APODERADO' && p.activo !== false);
      if (!apoderado) throw new BadRequestException('No hay apoderado en la configuración de documentos');
      return generarAutorizacion(expedienteDeTramite(t), apoderado);
    }
    if (tipo === 'declaracion-responsable') {
      return generarDeclaracionResponsable(expedienteDeTramite(t));
    }

    const items = maquinasDeTramite(t, catalogo);
    if (items.length === 0) {
      throw new BadRequestException('El trámite no tiene máquina: no se puede rellenar el documento');
    }

    const plantilla = await this.leerPlantilla(tipo);
    switch (tipo) {
      case 'mod-315':
        return rellenarPlantilla(plantilla, MAPEO_MOD_315, contextoMod315(t, config, items));
      case 'mod-318':
        return rellenarPlantilla(plantilla, MAPEO_MOD_318, contextoMod318(t, config, items));
      case 'certificado-rsif':
        return rellenarPlantilla(plantilla, MAPEO_CERTIFICADO_RSIF, contextoRsif(t, config, items));
      case 'if-190':
        return rellenarPlantilla(plantilla, MAPEO_IF_190, contextoIf190(t, config, items));
      default:
        throw new BadRequestException(`Documento desconocido: ${tipo}`);
    }
  }

  /**
   * Genera los seis documentos, los guarda en disco y lo apunta en el trámite.
   * Devuelve qué se ha generado y qué falló (un documento que falle no tumba los demás).
   */
  /**
   * Los documentos que le corresponden a este trámite (no siempre son los seis): la declaración
   * responsable solo en reformas y el Certificado RSIF y el IF-190 solo si necesita RSIF. Si no se
   * puede decidir (máquinas sin resolver) devuelve los seis, que es el lado prudente.
   */
  async documentosCorrespondientes(tramite: Legalizacion): Promise<TipoDocumento[]> {
    try {
      const catalogo = await this.catalogo();
      const items = maquinasDeTramite(tramite as unknown as TramiteParaDocumentos, catalogo);
      return documentosDelTramite(tramite as unknown as TramiteParaDocumentos, items);
    } catch {
      return [...TIPOS_DOCUMENTO];
    }
  }

  async generarYGuardarTodos(id: string): Promise<{
    generados: Record<string, string>;
    fallos: Record<string, string>;
    carpeta: string;
  }> {
    const tramite = await this.tramite(id);
    const carpeta = path.join(RUTA_SALIDA, id);
    await fs.mkdir(carpeta, { recursive: true });

    const generados: Record<string, string> = {};
    const fallos: Record<string, string> = {};

    // No a todos los trámites les tocan los seis documentos (repaso del instalador, 5-oct-2026): la
    // declaración responsable solo va en reformas, y el Certificado RSIF y el IF-190 solo si la
    // instalación necesita RSIF (la suma de la carga de refrigerante supera el umbral).
    const corresponden = await this.documentosCorrespondientes(tramite);

    for (const tipo of corresponden) {
      try {
        const pdf = await this.generarPdf(id, tipo);
        await fs.writeFile(path.join(carpeta, `${tipo}.pdf`), pdf);
        generados[tipo] = new Date().toISOString();
      } catch (e) {
        fallos[tipo] = (e as Error)?.message ?? String(e);
      }
    }

    // Los que ya no le corresponden (un trámite que pasa de reforma a nueva, o que baja del umbral)
    // se retiran del trámite y del disco: si no, la ficha seguiría ofreciendo un documento que no toca.
    const previos = { ...(tramite.documentos_generados ?? {}) };
    for (const tipo of TIPOS_DOCUMENTO) {
      if (corresponden.includes(tipo) || !previos[tipo]) continue;
      delete previos[tipo];
      await fs.rm(path.join(carpeta, `${tipo}.pdf`), { force: true });
    }
    tramite.documentos_generados = { ...previos, ...generados };
    await this.tramites.save(tramite);

    return { generados, fallos, carpeta };
  }

  /** Ruta del PDF ya guardado de un documento (para descargarlo). */
  async rutaPdfGuardado(id: string, tipo: TipoDocumento): Promise<string> {
    const ruta = path.join(RUTA_SALIDA, id, `${tipo}.pdf`);
    try {
      await fs.access(ruta);
    } catch {
      throw new NotFoundException(`El documento ${NOMBRE_DOCUMENTO[tipo]} todavía no se ha generado`);
    }
    return ruta;
  }

  private async leerPlantilla(tipo: TipoDocumento): Promise<Buffer> {
    const ruta = path.join(RUTA_PLANTILLAS, `${tipo}.pdf`);
    try {
      return await fs.readFile(ruta);
    } catch {
      throw new BadRequestException(`Falta la plantilla oficial ${tipo}.pdf en ${RUTA_PLANTILLAS}`);
    }
  }
}

/**
 * La fila del catálogo de la Pi, con la forma que esperan los mapeos del CRM.
 * El catálogo se copió del CRM campo a campo, así que la conversión es directa.
 */
export function aMaquinaDelCatalogo(m: Maquina): MaquinaDelCatalogo {
  return {
    id: m.id,
    fabricante: m.fabricante,
    gama: m.gama,
    modelo: m.modelo,
    codigoFabricante: m.codigo_fabricante ?? null,
    tipoUso: (m.tipo_uso as TipoUsoMaquina) ?? TipoUsoMaquina.CLIMATIZACION_ACS,
    refrigerante: m.refrigerante ?? null,
    gwpRefrigerante: m.gwp_refrigerante ?? null,
    cargaRefrigeranteKg: m.carga_refrigerante_kg ?? null,
    alimentacion: m.alimentacion ?? null,
    potenciaCalorificaKW: m.potencia_calorifica_kw ?? null,
    potenciaFrigorificaKW: m.potencia_frigorifica_kw ?? null,
    scopMedio35C: m.scop_medio_35c ?? null,
    scopDhwMedio: m.scop_dhw_medio ?? null,
    scopDhwOrigen: (m.scop_dhw_origen as ScopDhwOrigen) ?? null,
    acsNoDisponibleMotivo: m.acs_no_disponible_motivo ?? null,
    datosVariante: m.datos_variante ?? {},
    datosGama: m.datos_gama ?? {},
    fuenteDocumento: m.fuente_documento ?? null,
    fuenteUrl: m.fuente_url ?? null,
    fuentePaginas: m.fuente_paginas ?? null,
  };
}

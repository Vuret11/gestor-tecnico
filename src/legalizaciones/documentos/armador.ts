/**
 * ARMADOR: convierte un trámite del gestor (fila de `legalizaciones`) en los contextos que
 * esperan los mapeos oficiales del CRM.
 *
 * Los mapeos son los mismos ficheros que usa el CRM (no se toca ni una línea): aquí se les da
 * la misma forma de datos, construida desde la Pi:
 *
 *   - datos del cliente / OCA / obra  -> columnas del trámite
 *   - empresa y personas (técnico, apoderado, instalador habilitado) -> config fija traída del CRM
 *   - máquinas -> catálogo de la Pi (191 máquinas, con carga de refrigerante, GWP y SCOP)
 *
 * Nada se inventa: lo que no está, va en blanco y se lista en `datosQueFaltan()` para que el
 * panel pueda decir qué falta antes de presentar los documentos.
 */
import {
  DatosClienteExpediente, DatosOcaExpediente, Empresa, Expediente, Maquina, Persona,
  RolPersona, TipoUsoMaquina,
} from './crm/tipos';
import { TipoEdificio } from './crm/normativa/dbhe4.types';
import { TipoEmisor } from './crm/normativa/demanda.constants';
import {
  MaquinaConUnidades, TotalesInstalacion, produceAcsConBombaDeCalor, produceCalefaccionConBombaDeCalor,
  requiereMemoriaTecnicaDelExpediente, totalesInstalacion,
} from './maquina-instalacion';
import { ContextoMod315 } from './mapeos/mod-315.types';
import { ContextoMod318, DatosObraMod318 } from './mapeos/mod-318.types';
import { ContextoCertificadoRsif } from './mapeos/certificado-rsif.types';
import { ContextoIf190 } from './mapeos/if-190.types';

/** Lo que el armador necesita de un trámite (subconjunto de la tabla `legalizaciones`). */
export interface TramiteParaDocumentos {
  id: string;
  num_obra?: string | null;
  cliente?: string | null;
  nif?: string | null;
  direccion?: string | null;
  /** Trozos de la dirección: `direccion` es SOLO el nombre de la vía (puntos 1 y 3 del MOD-315). */
  tipo_via?: string | null;
  numero?: string | null;
  bloque?: string | null;
  portal?: string | null;
  escalera?: string | null;
  piso?: string | null;
  puerta?: string | null;
  cp?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  comunidad?: string | null;
  oca?: string | null;
  oca_cif?: string | null;
  email?: string | null;
  telefono?: string | null;
  superficie?: number | null;
  tipo_emisor?: string | null;
  tipo_edificio?: string | null;
  dormitorios?: number | null;
  viviendas?: number | null;
  es_anterior_rd?: boolean | null;
  /** 'AEROTERMIA' | 'GEOTERMIA'. */
  tipo_energia?: string | null;
  /** 'NUEVA' | 'REFORMA'. */
  tipo_instalacion?: string | null;
  maquina_id?: number | null;
  maquinas_instalacion?: { maquina_id: number; unidades: number }[] | null;
  /** Uso declarado ('CLIMATIZACION_ACS', 'SOLO_ACS', 'HIBRIDA_CALDERA'); si no, el de la máquina. */
  tipo_uso?: string | null;
  datos_obra?: Record<string, unknown> | null;
  qusable_anual_kwh?: number | null;
  eres_anual_kwh?: number | null;
  acs_demanda_diaria_60c?: number | null;
  acs_volumen_acumulador_l?: number | null;
  tiene_calefaccion?: boolean | null;
  tiene_acs?: boolean | null;
  requiere_memoria_tecnica?: boolean | null;
  /**
   * Clasificaciones del RSIF (arts. 6 y 7 del RD 552/2019) y sala de máquinas. Son COLUMNAS del
   * trámite en el gestor (así las manda su panel) y datos sueltos de `datosObra` en el CRM: en
   * `expedienteDeTramite` se juntan, porque los mapeos los leen de `datosObra`.
   */
  clasificacion_emplazamiento?: string | null;
  clasificacion_local?: string | null;
  sala_maquinas?: string | null;
}

/** Config fija (una fila): la empresa y las personas con rol, tal como están en el CRM. */
export interface ConfigFija {
  empresa: Empresa;
  personas: Persona[];
}

/**
 * Tipo de energía de la instalación: 'AEROTERMIA' o 'GEOTERMIA' (el instalador lo indicó el
 * 2-oct-2026: «si se trata de una instalación de AEROTERMIA o GEOTERMÍA… nunca ambas»). Sin dato
 * se asume AEROTERMIA, que es lo que instala HomeServe y lo que ya se marcaba antes.
 */
export function tipoEnergiaDelTramite(t: TramiteParaDocumentos): 'AEROTERMIA' | 'GEOTERMIA' {
  const dicho = (t.tipo_energia ?? '').toString().trim().toUpperCase();
  return dicho === 'GEOTERMIA' ? 'GEOTERMIA' : 'AEROTERMIA';
}

/**
 * Tipo de instalación: 'NUEVA' o 'REFORMA'. Manda lo que se diga en el trámite; si no, se deduce
 * de `es_anterior_rd` como se venía haciendo (anterior al RD 1027/2007 = reforma).
 */
export function tipoInstalacionDelTramite(t: TramiteParaDocumentos): 'NUEVA' | 'REFORMA' {
  const dicho = (t.tipo_instalacion ?? '').toString().trim().toUpperCase();
  if (dicho === 'REFORMA' || dicho === 'NUEVA') return dicho;
  return t.es_anterior_rd === true ? 'REFORMA' : 'NUEVA';
}

/**
 * Emisores declarados en el trámite (el campo guarda uno o varios separados por coma).
 */
export function emisoresDelTramite(t: TramiteParaDocumentos): TipoEmisor[] {
  const bruto = (t.tipo_emisor ?? '').toString();
  const valores = Object.values(TipoEmisor) as string[];
  return bruto
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter((v) => valores.includes(v)) as TipoEmisor[];
}

/**
 * Uso declarado en el trámite (los valores del catálogo). Es el «tipo de uso: climatización + ACS»
 * del alta; si no se dice nada, manda el uso con el que el fabricante certifica la máquina.
 */
export function usoDelTramite(t: TramiteParaDocumentos): TipoUsoMaquina | null {
  const dicho = (t.tipo_uso ?? '').toString().trim().toUpperCase();
  const valores = Object.values(TipoUsoMaquina) as string[];
  return valores.includes(dicho) ? (dicho as TipoUsoMaquina) : null;
}

/** Expediente con la forma que esperan los mapeos. */
export function expedienteDeTramite(t: TramiteParaDocumentos): Expediente {
  const datosCliente: DatosClienteExpediente | null = t.cliente
    ? {
        nombreRazonSocial: t.cliente,
        dniCif: t.nif ?? '',
        direccion: t.direccion ?? '',
        codigoPostal: t.cp ?? '',
        municipio: t.municipio ?? '',
        provincia: t.provincia ?? '',
        comunidadAutonoma: t.comunidad ?? '',
        telefono: t.telefono ?? undefined,
        email: t.email ?? undefined,
        // Dirección TROCEADA: `direccion` lleva solo el nombre de la vía y cada trozo va a su
        // casilla de los puntos 1 y 3 del MOD-315. Un trozo que no venga deja su casilla en blanco
        // (no se recorta a ciegas la dirección completa: se decidió no adivinar por regex).
        tipoVia: t.tipo_via ?? undefined,
        numero: t.numero ?? undefined,
        bloque: t.bloque ?? undefined,
        portal: t.portal ?? undefined,
        escalera: t.escalera ?? undefined,
        piso: t.piso ?? undefined,
        puerta: t.puerta ?? undefined,
      }
    : null;

  const datosOca: DatosOcaExpediente | null = t.oca ? { nombre: t.oca, cif: t.oca_cif ?? undefined } : null;

  return {
    id: 0,
    esAnteriorRd1027_2007: t.es_anterior_rd ?? null,
    datosCliente,
    datosOca,
    // Los mapeos leen los datos que facilita el instalador de `datosObra` (el JSON que manda el CRM),
    // pero el panel del gestor guarda las tres clasificaciones del RSIF en COLUMNAS del trámite: se
    // juntan aquí, con el nombre camelCase que esperan los mapeos, y el JSON manda si ya trae el dato.
    // Sin esto, desde el panel las casillas del certificado RSIF y del IF-190 salían sin marcar.
    datosObra: {
      ...(t.clasificacion_emplazamiento ? { clasificacionEmplazamiento: t.clasificacion_emplazamiento } : {}),
      ...(t.clasificacion_local ? { clasificacionLocal: t.clasificacion_local } : {}),
      ...(t.sala_maquinas ? { salaMaquinas: t.sala_maquinas } : {}),
      ...((t.datos_obra ?? {}) as Record<string, unknown>),
    },
    maquinaId: t.maquina_id ?? null,
    maquinas: (t.maquinas_instalacion ?? null)?.map((m) => ({ maquinaId: m.maquina_id, unidades: m.unidades })) ?? null,
  };
}

/** Persona activa por rol (la config de la Pi guarda una lista, como el CRM). */
export function personaPorRol(config: ConfigFija, rol: RolPersona): Persona | null {
  const persona = (config.personas ?? []).find((p) => p.rol === rol && p.activo !== false) ?? null;
  return persona ? { ...persona, datosAdicionales: datosAdicionalesDe(persona) } : null;
}

/**
 * `datosAdicionales` es un objeto en el CRM, pero la config de la Pi lo tiene guardado como TEXTO
 * JSON (`"{\"numeroCarne\":\"26753212A\"}"`). Leído tal cual, `datosAdicionales.numeroCarne` es
 * undefined, así que el «N carné» del MOD-315 y del MOD-318 salían **en blanco** aunque el número
 * estuviera puesto desde el primer día. Aquí se acepta de las dos formas.
 */
function datosAdicionalesDe(persona: Persona): Record<string, unknown> | null {
  const crudo: unknown = persona.datosAdicionales;
  if (typeof crudo === 'string') {
    try {
      const leido = JSON.parse(crudo);
      return leido && typeof leido === 'object' ? (leido as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return (crudo as Record<string, unknown> | null) ?? null;
}

/**
 * Máquinas de la instalación con sus unidades. Si el trámite declara la lista se usa tal cual;
 * si no, la máquina principal con 1 unidad. Lanza si el id no está en el catálogo (no se generaría
 * un documento con datos de otra máquina).
 */
/**
 * El catálogo de máquinas del gestor, indexado DE LAS DOS FORMAS posibles.
 *
 * Van en mapas separados a propósito: en un solo mapa el id del CRM **pisa** al id del gestor que
 * coincide en número (pasa en 183 de las 191 máquinas), y el documento salía con OTRA máquina — su
 * potencia, su refrigerante, su GWP y sus COP/EER. El panel guarda el id del gestor, así que ese
 * manda; el del CRM queda de respaldo para los trámites importados.
 */
export interface CatalogoMaquinas {
  porId: Map<number, Maquina>;
  porIdExterno: Map<number, Maquina>;
}

/**
 * Máquinas de la instalación con sus unidades, resueltas contra el catálogo: primero por id del
 * gestor y, si esa máquina no existe, por el id del CRM.
 */
export function maquinasDeTramite(t: TramiteParaDocumentos, catalogo: CatalogoMaquinas): MaquinaConUnidades[] {
  const declaradas = (t.maquinas_instalacion ?? []).filter((m) => Number(m.unidades) > 0);
  const lista = declaradas.length > 0
    ? declaradas.map((m) => ({ id: Number(m.maquina_id), unidades: Number(m.unidades) }))
    : t.maquina_id
      ? [{ id: t.maquina_id, unidades: 1 }]
      : [];

  return lista.map(({ id, unidades }) => {
    const maquina = catalogo.porId.get(Number(id)) ?? catalogo.porIdExterno.get(Number(id));
    if (!maquina) {
      throw new Error(`La máquina ${id} del trámite no está en el catálogo del gestor`);
    }
    return { maquina, unidades };
  });
}

/** Contexto del MOD-315. */
export function contextoMod315(
  t: TramiteParaDocumentos, config: ConfigFija, items: MaquinaConUnidades[],
): ContextoMod315 {
  const emisores = emisoresDelTramite(t);
  const uso = usoDelTramite(t) ?? items[0]?.maquina?.tipoUso;
  return {
    expediente: expedienteDeTramite(t),
    empresa: config.empresa,
    apoderado: personaPorRol(config, RolPersona.APODERADO),
    instaladorHabilitado: personaPorRol(config, RolPersona.INSTALADOR_HABILITADO),
    maquina: items[0].maquina,
    maquinas: items,
    totales: totalesInstalacion(items),
    tipoEdificio: (t.tipo_edificio ?? null) as unknown as TipoEdificio,
    numeroViviendas: t.viviendas ?? null,
    tieneCalefaccion: t.tiene_calefaccion ?? produceCalefaccionConBombaDeCalor(uso ? { tipoUso: uso } : null),
    tieneAcsPorBombaDeCalor: t.tiene_acs ?? produceAcsConBombaDeCalor(uso ? { tipoUso: uso } : null),
    qusableAnualKWh: t.qusable_anual_kwh ?? null,
    eresAnualKWh: t.eres_anual_kwh ?? null,
    acsDemandaDiaria60C: t.acs_demanda_diaria_60c ?? null,
    acsVolumenAcumuladorLitros: t.acs_volumen_acumulador_l ?? null,
    requiereMemoriaTecnica: t.requiere_memoria_tecnica
      ?? requiereMemoriaTecnicaDelExpediente(expedienteDeTramite(t), items, null),
    esAnteriorRd1027_2007: t.es_anterior_rd ?? null,
    tipoEnergia: tipoEnergiaDelTramite(t),
    tipoInstalacion: tipoInstalacionDelTramite(t),
    tipoEmisor: emisores[0] ?? null,
    tipoEmisores: emisores,
    superficieM2: t.superficie ?? null,
  };
}

/** Contexto del MOD-318 (lleva los datos de pruebas medidos en obra). */
export function contextoMod318(
  t: TramiteParaDocumentos, config: ConfigFija, items: MaquinaConUnidades[],
): ContextoMod318 {
  const emisores = emisoresDelTramite(t);
  const uso = usoDelTramite(t) ?? items[0]?.maquina?.tipoUso;
  return {
    expediente: expedienteDeTramite(t),
    empresa: config.empresa,
    instaladorHabilitado: personaPorRol(config, RolPersona.INSTALADOR_HABILITADO),
    maquina: items[0].maquina,
    maquinas: items,
    tieneCalefaccion: t.tiene_calefaccion ?? produceCalefaccionConBombaDeCalor(uso ? { tipoUso: uso } : null),
    tieneAcsPorBombaDeCalor: t.tiene_acs ?? produceAcsConBombaDeCalor(uso ? { tipoUso: uso } : null),
    tipoEmisor: emisores[0] ?? null,
    tipoEmisores: emisores,
    datosObra: (t.datos_obra ?? {}) as DatosObraMod318,
  };
}

/** Contexto del certificado RSIF. */
export function contextoRsif(
  t: TramiteParaDocumentos, config: ConfigFija, items: MaquinaConUnidades[],
): ContextoCertificadoRsif {
  const emisores = emisoresDelTramite(t);
  return {
    expediente: expedienteDeTramite(t),
    empresa: config.empresa,
    tecnico: personaPorRol(config, RolPersona.TECNICO) as Persona,
    maquina: items[0].maquina,
    maquinas: items,
    tipoEmisor: emisores[0] ?? null,
    tipoEmisores: emisores,
    requiereMemoriaTecnica: t.requiere_memoria_tecnica
      ?? requiereMemoriaTecnicaDelExpediente(expedienteDeTramite(t), items, null),
  };
}

/** Contexto del IF-190. */
export function contextoIf190(
  t: TramiteParaDocumentos, config: ConfigFija, items: MaquinaConUnidades[],
): ContextoIf190 {
  const emisores = emisoresDelTramite(t);
  const totales: TotalesInstalacion = totalesInstalacion(items);
  return {
    expediente: expedienteDeTramite(t),
    empresa: config.empresa,
    tecnico: personaPorRol(config, RolPersona.TECNICO) as Persona,
    apoderado: personaPorRol(config, RolPersona.APODERADO),
    maquina: items[0].maquina,
    maquinas: items,
    totales,
    tipoEmisor: emisores[0] ?? null,
    tipoEmisores: emisores,
    tipoEnergia: tipoEnergiaDelTramite(t),
    tipoInstalacion: tipoInstalacionDelTramite(t),
  };
}

/**
 * Qué datos imprescindibles faltan en el trámite para poder generar los documentos oficiales.
 * Se usa para avisar en el panel (no bloquea los PDFs que no los necesiten).
 */
export function datosQueFaltan(t: TramiteParaDocumentos): string[] {
  const faltan: string[] = [];
  if (!t.cliente?.trim()) faltan.push('nombre del titular');
  if (!t.nif?.trim()) faltan.push('NIF/CIF del titular');
  if (!t.direccion?.trim()) faltan.push('dirección');
  if (!t.cp?.trim()) faltan.push('código postal');
  if (!t.municipio?.trim()) faltan.push('municipio');
  if (!t.provincia?.trim()) faltan.push('provincia');
  if (!t.oca?.trim()) faltan.push('OCA');
  if (!t.maquina_id && !(t.maquinas_instalacion ?? []).length) faltan.push('máquina');
  return faltan;
}

/** Los seis documentos oficiales, en el orden en que se presentan. */
export const TIPOS_DOCUMENTO = [
  'autorizacion',
  'declaracion-responsable',
  'mod-315',
  'mod-318',
  'certificado-rsif',
  'if-190',
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Nombre con el que se guarda/descarga cada documento. */
export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  autorizacion: 'Autorizacion',
  'declaracion-responsable': 'Declaracion responsable',
  'mod-315': 'MOD-315',
  'mod-318': 'MOD-318',
  'certificado-rsif': 'Certificado RSIF',
  'if-190': 'IF-190',
};

/**
 * Los documentos que le corresponden a un trámite, tal como los repasó el instalador el 5-oct-2026:
 *
 *   - Autorización, MOD-315 y MOD-318: SIEMPRE.
 *   - Declaración responsable: **solo si es una reforma** (en instalación nueva no va).
 *   - Certificado RSIF e IF-190: **solo si la instalación necesita RSIF**, es decir, si la SUMA de la
 *     carga de refrigerante por refrigerante de todas las máquinas supera su umbral. Una máquina que
 *     por sí sola no llega sí puede hacer que haga falta al juntarse con otras.
 *
 * Si no se puede decidir (falta la carga o el refrigerante de alguna máquina en la ficha) se generan:
 * un documento de más se descarta al presentar, uno que falta obliga a rehacer el trámite.
 */
export function documentosDelTramite(
  t: TramiteParaDocumentos, items: MaquinaConUnidades[],
): TipoDocumento[] {
  const necesitaRsif = requiereMemoriaTecnicaDelExpediente(expedienteDeTramite(t), items, null) !== false;
  const esReforma = (t.tipo_instalacion ?? '').trim().toUpperCase() === 'REFORMA';

  return TIPOS_DOCUMENTO.filter((tipo) => {
    if (tipo === 'declaracion-responsable') return esReforma;
    if (tipo === 'certificado-rsif' || tipo === 'if-190') return necesitaRsif;
    return true; // autorización, MOD-315 y MOD-318 van siempre
  });
}

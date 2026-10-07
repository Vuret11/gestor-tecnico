/**
 * Tipos locales que sustituyen a las entidades del CRM.
 *
 * El generador de documentos (mapeos oficiales, rellenador de AcroForm, utilidades de máquinas)
 * se trajo tal cual desde `C:/Users/Vuret/Ingeniero/backend/src/legalizacion/documentos`, donde
 * los contextos hablan de las entidades del CRM (`Expediente`, `Empresa`, `Persona`, `Maquina`).
 * En la Pi esas entidades no existen: el trámite vive en la tabla `legalizaciones` del gestor.
 *
 * Aquí se declaran SOLO las formas que usan los mapeos, para que el código traído compile sin
 * tocar una sola línea de los mapeos. El puente entre la fila del gestor y estas formas lo hace
 * `armador.service.ts` (el adaptador).
 */

/** Procedencia del SCOP DHW con el que se valida el ACS (HE4 §3.1.4). */
export type ScopDhwOrigen = 'catalogo' | 'scop_55C' | null;

export enum TipoUsoMaquina {
  CLIMATIZACION_ACS = 'CLIMATIZACION_ACS',
  SOLO_ACS = 'SOLO_ACS',
  HIBRIDA_CALDERA = 'HIBRIDA_CALDERA',
  /**
   * Climatización SOLA, sin ACS (lo pidió Salva el 7-oct-2026: «tienes que dar la opción de
   * climatización solo, sin ACS, también»). Es el caso de la reforma que cambia la caldera por una
   * bomba de calor solo para calefacción/refrigeración y deja el ACS como está.
   *
   * Consecuencias, todas en el motor y en los mapeos (no se deduce nada a mano):
   *  - NO se marcan las casillas de ACS (MOD-315 secciones 1, 5 y 7; MOD-318) — ver
   *    `produceAcsConBombaDeCalor`;
   *  - SÍ se marca la de Calefacción — ver `produceCalefaccionConBombaDeCalor`;
   *  - no se calculan la demanda de ACS, el Qusable ni el Eres, y el bloque de ACS del 315 va en blanco.
   */
  SOLO_CLIMATIZACION = 'SOLO_CLIMATIZACION',
}

export enum RolPersona {
  TECNICO = 'TECNICO',
  APODERADO = 'APODERADO',
  INSTALADOR_HABILITADO = 'INSTALADOR_HABILITADO',
}

/** Dirección ya partida al guardar — nunca se separa por regex al rellenar un PDF. */
export interface DatosClienteExpediente {
  nombreRazonSocial: string;
  dniCif: string;
  direccion: string;
  codigoPostal: string;
  municipio: string;
  provincia: string;
  comunidadAutonoma: string;
  telefono?: string;
  email?: string;
  tipoVia?: string;
  numero?: string;
  bloque?: string;
  portal?: string;
  escalera?: string;
  piso?: string;
  puerta?: string;
}

/** OCA (Organismo de Control Autorizado) — NO es dato maestro, varía por expediente. */
export interface DatosOcaExpediente {
  nombre: string;
  cif?: string;
}

/** Datos medidos en obra por el instalador (pruebas de presión, COP medido in situ…). */
export type DatosObraExpediente = Record<string, unknown>;

/** Una máquina de la instalación: qué modelo del catálogo y cuántas unidades iguales. */
export interface MaquinaInstalacion {
  maquinaId: number;
  unidades: number;
}

export interface Expediente {
  id: number;
  esAnteriorRd1027_2007: boolean | null;
  datosCliente: DatosClienteExpediente | null;
  datosOca: DatosOcaExpediente | null;
  datosObra: DatosObraExpediente | null;
  /** Máquina declarada en el trámite (id del catálogo). */
  maquinaId: number | null;
  /** Máquinas de la instalación con sus unidades (varias o la misma repetida). */
  maquinas: MaquinaInstalacion[] | null;
}

/** Selección del CRM (ranking que eligió la máquina). En la Pi solo hace falta la forma. */
export interface Seleccion {
  id: number;
  entradas?: Record<string, unknown> | null;
  resultados?: Record<string, unknown> | null;
}

export interface Empresa {
  id: number;
  nombre: string;
  cif: string;
  direccion: string | null;
  codigoPostal: string | null;
  localidad: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  numeroRegistroEmpresaInstaladora: string | null;
}

export interface Persona {
  id: number;
  rol: RolPersona;
  nombre: string;
  dni: string;
  direccion: string | null;
  codigoPostal: string | null;
  localidad: string | null;
  provincia: string | null;
  activo: boolean;
  datosAdicionales: Record<string, unknown> | null;
}

export interface Maquina {
  id: number;
  fabricante: string;
  gama: string;
  modelo: string;
  codigoFabricante: string | null;
  tipoUso: TipoUsoMaquina;
  refrigerante: string | null;
  gwpRefrigerante: number | null;
  cargaRefrigeranteKg: number | null;
  alimentacion: string | null;
  potenciaCalorificaKW: number | null;
  potenciaFrigorificaKW: number | null;
  scopMedio35C: number | null;
  scopDhwMedio: number | null;
  scopDhwOrigen: ScopDhwOrigen;
  acsNoDisponibleMotivo: string | null;
  datosVariante: Record<string, unknown>;
  datosGama: Record<string, unknown>;
  fuenteDocumento: string | null;
  fuenteUrl: string | null;
  fuentePaginas: string | null;
}

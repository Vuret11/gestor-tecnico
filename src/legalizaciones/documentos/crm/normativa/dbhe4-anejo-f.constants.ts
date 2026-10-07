/**
 * CTE DB-HE4 — Sección HE4 y Anejo F (demanda de referencia de ACS).
 * Transcrito literalmente de: Documento Básico HE Ahorro de energía,
 * Ministerio de Vivienda y Agenda Urbana,
 * https://www.codigotecnico.org/pdf/Documentos/HE/DBHE.pdf (descargado 2026-09-02).
 * No modificar valores sin volver a verificar contra el texto oficial vigente.
 */
import { FuenteNormativa, UsoNoResidencial } from './dbhe4.types';

const DOCUMENTO = 'Documento Básico HE Ahorro de energía';
const URL_FUENTE = 'https://www.codigotecnico.org/pdf/Documentos/HE/DBHE.pdf';
const FECHA_CONSULTA = '2026-09-02';

export const FUENTE_HE4_AMBITO: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'HE4',
  apartado: '1. Ámbito de aplicación',
  pagina: 28,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

export const FUENTE_HE4_CONTRIBUCION: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'HE4',
  apartado: '3.1 Contribución renovable mínima para ACS y/o climatización de piscina',
  pagina: 28,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

/** Guardado aquí por pertenecer a HE4 §3.1; la comprobación contra una máquina real es de un módulo posterior. */
export const FUENTE_HE4_SCOP_DHW: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'HE4',
  apartado: '3.1.4 Umbral de rendimiento medio estacional (SCOPdhw) de bombas de calor',
  pagina: 28,
  paginaFin: 29,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

export const FUENTE_ANEJO_F_DEMANDA: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'Anejo F',
  apartado: 'Demanda de referencia de ACS',
  pagina: 52,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

export const FUENTE_ANEJO_F_TABLA_A: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'Anejo F',
  apartado: 'Tabla a-Anejo F — Valores mínimos de ocupación de cálculo en uso residencial privado',
  pagina: 52,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

export const FUENTE_ANEJO_F_TABLA_B: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'Anejo F',
  apartado: 'Tabla b-Anejo F — Valor del factor de centralización en viviendas multifamiliares',
  pagina: 52,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

export const FUENTE_ANEJO_F_TABLA_C: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'Anejo F',
  apartado: 'Tabla c-Anejo F — Demanda orientativa de ACS para usos distintos del residencial privado',
  pagina: 52,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

export const FUENTE_ANEJO_F_CORRECCION_TEMP: FuenteNormativa = {
  documento: DOCUMENTO,
  seccion: 'Anejo F',
  apartado: '3. Corrección del consumo de ACS a una temperatura distinta de la de referencia',
  pagina: 53,
  url: URL_FUENTE,
  fechaConsulta: FECHA_CONSULTA,
};

/** Anejo F, pág. 52: "unas necesidades de 28 litros/día·persona (a 60ºC)". */
export const DEMANDA_REFERENCIA_PERSONA_60C = 28;

/** Temperatura de referencia a la que se expresan las demandas del Anejo F. */
export const TEMPERATURA_REFERENCIA_ACS = 60;

/** HE4 §1: aplica a edificios con demanda ACS > 100 l/día calculada según Anejo F. */
export const UMBRAL_AMBITO_HE4_L_DIA = 100;

/** HE4 §3.1: por debajo de esta demanda, la contribución mínima se reduce al 60%. */
export const UMBRAL_DEMANDA_ALTA_L_DIA = 5000;

export const CONTRIBUCION_RENOVABLE_MINIMA_GENERAL = 0.7;
export const CONTRIBUCION_RENOVABLE_MINIMA_REDUCIDA = 0.6;

/** HE4 §3.1.4: SCOPdhw ≥ 2,5 (bombas accionadas eléctricamente). */
export const SCOP_DHW_MINIMO_ELECTRICA = 2.5;
/** HE4 §3.1.4: SCOPdhw ≥ 1,15 (bombas accionadas mediante energía térmica). */
export const SCOP_DHW_MINIMO_TERMICA = 1.15;
/** HE4 §3.1.4: el SCOPdhw se determina para una temperatura de preparación no inferior a esta. */
export const TEMPERATURA_MINIMA_REFERENCIA_SCOP = 45;

/**
 * Tabla a-Anejo F. Clave = número de dormitorios (7 representa "≥7 dormitorios", tal y como
 * publica el documento). Valor = número mínimo de personas de cálculo.
 */
export const OCUPACION_REFERENCIA_TABLA_A: Readonly<Record<number, number>> = {
  1: 1.5,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 6,
  7: 7,
};

/** Máximo número de dormitorios representable directamente en la tabla (7 = "7 o más"). */
export const DORMITORIOS_MAXIMO_TABLA_A = 7;

export interface TramoCentralizacion {
  min: number;
  max: number | null; // null = sin límite superior (N≥101)
  factor: number;
}

/** Tabla b-Anejo F, por número de viviendas N del edificio. */
export const FACTOR_CENTRALIZACION_TABLA_B: readonly TramoCentralizacion[] = [
  { min: 1, max: 3, factor: 1 },
  { min: 4, max: 10, factor: 0.95 },
  { min: 11, max: 20, factor: 0.9 },
  { min: 21, max: 50, factor: 0.85 },
  { min: 51, max: 75, factor: 0.8 },
  { min: 76, max: 100, factor: 0.75 },
  { min: 101, max: null, factor: 0.7 },
];

/**
 * Tabla c-Anejo F. Demanda de referencia a 60°C para usos distintos del residencial privado.
 * El documento oficial usa "persona" como unidad para todas las filas (columna "Litros/día·persona"),
 * no unidades distintas por fila.
 */
export const DEMANDA_REFERENCIA_TABLA_C: Readonly<Record<UsoNoResidencial, number>> = {
  [UsoNoResidencial.HOSPITAL_CLINICA]: 55,
  [UsoNoResidencial.AMBULATORIO_CENTRO_SALUD]: 41,
  [UsoNoResidencial.HOTEL_5_ESTRELLAS]: 69,
  [UsoNoResidencial.HOTEL_4_ESTRELLAS]: 55,
  [UsoNoResidencial.HOTEL_3_ESTRELLAS]: 41,
  [UsoNoResidencial.HOTEL_HOSTAL_2_ESTRELLAS]: 34,
  [UsoNoResidencial.CAMPING]: 21,
  [UsoNoResidencial.HOSTAL_PENSION_1_ESTRELLA]: 28,
  [UsoNoResidencial.RESIDENCIA]: 41,
  [UsoNoResidencial.CENTRO_PENITENCIARIO]: 28,
  [UsoNoResidencial.ALBERGUE]: 24,
  [UsoNoResidencial.VESTUARIOS_DUCHAS_COLECTIVAS]: 21,
  [UsoNoResidencial.ESCUELA_SIN_DUCHA]: 4,
  [UsoNoResidencial.ESCUELA_CON_DUCHA]: 21,
  [UsoNoResidencial.CUARTELES]: 28,
  [UsoNoResidencial.FABRICAS_TALLERES]: 21,
  [UsoNoResidencial.OFICINAS]: 2,
  [UsoNoResidencial.GIMNASIOS]: 21,
  [UsoNoResidencial.RESTAURANTES]: 8,
  [UsoNoResidencial.CAFETERIAS]: 1,
};

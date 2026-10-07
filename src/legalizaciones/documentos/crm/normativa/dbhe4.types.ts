/**
 * Tipos compartidos del módulo normativo CTE DB-HE4.
 * Fuente: Documento Básico HE Ahorro de energía, Ministerio de Vivienda y Agenda Urbana,
 * https://www.codigotecnico.org/pdf/Documentos/HE/DBHE.pdf (descargado 2026-09-02).
 */

export interface FuenteNormativa {
  documento: string;
  seccion: 'HE4' | 'Anejo F' | 'Anejo G';
  apartado: string;
  pagina: number;
  paginaFin?: number;
  url: string;
  fechaConsulta: string; // ISO date
}

export enum TipoEdificio {
  VIVIENDA_UNIFAMILIAR = 'VIVIENDA_UNIFAMILIAR',
  VIVIENDA_PLURIFAMILIAR = 'VIVIENDA_PLURIFAMILIAR',
  NO_RESIDENCIAL = 'NO_RESIDENCIAL',
}

/** Tabla c-Anejo F. La unidad publicada por el documento es "persona" para todas las filas. */
export enum UsoNoResidencial {
  HOSPITAL_CLINICA = 'HOSPITAL_CLINICA',
  AMBULATORIO_CENTRO_SALUD = 'AMBULATORIO_CENTRO_SALUD',
  HOTEL_5_ESTRELLAS = 'HOTEL_5_ESTRELLAS',
  HOTEL_4_ESTRELLAS = 'HOTEL_4_ESTRELLAS',
  HOTEL_3_ESTRELLAS = 'HOTEL_3_ESTRELLAS',
  HOTEL_HOSTAL_2_ESTRELLAS = 'HOTEL_HOSTAL_2_ESTRELLAS',
  CAMPING = 'CAMPING',
  HOSTAL_PENSION_1_ESTRELLA = 'HOSTAL_PENSION_1_ESTRELLA',
  RESIDENCIA = 'RESIDENCIA',
  CENTRO_PENITENCIARIO = 'CENTRO_PENITENCIARIO',
  ALBERGUE = 'ALBERGUE',
  VESTUARIOS_DUCHAS_COLECTIVAS = 'VESTUARIOS_DUCHAS_COLECTIVAS',
  ESCUELA_SIN_DUCHA = 'ESCUELA_SIN_DUCHA',
  ESCUELA_CON_DUCHA = 'ESCUELA_CON_DUCHA',
  CUARTELES = 'CUARTELES',
  FABRICAS_TALLERES = 'FABRICAS_TALLERES',
  OFICINAS = 'OFICINAS',
  GIMNASIOS = 'GIMNASIOS',
  RESTAURANTES = 'RESTAURANTES',
  CAFETERIAS = 'CAFETERIAS',
}

/**
 * Capitales de provincia de la Tabla a-Anejo G (52 filas: 50 provincias + Ceuta + Melilla).
 * El valor del enum es el nombre de display tal y como figura en el documento oficial;
 * la clave es el identificador ASCII-safe usado por la API/DTOs.
 */
export enum ProvinciaCapital {
  A_CORUNA = 'A Coruña',
  ALBACETE = 'Albacete',
  ALICANTE = 'Alicante/Alacant',
  ALMERIA = 'Almería',
  AVILA = 'Ávila',
  BADAJOZ = 'Badajoz',
  BARCELONA = 'Barcelona',
  BILBAO = 'Bilbao/Bilbo',
  BURGOS = 'Burgos',
  CACERES = 'Cáceres',
  CADIZ = 'Cádiz',
  CASTELLON = 'Castellón/Castelló',
  CEUTA = 'Ceuta',
  CIUDAD_REAL = 'Ciudad Real',
  CORDOBA = 'Córdoba',
  CUENCA = 'Cuenca',
  GIRONA = 'Girona',
  GRANADA = 'Granada',
  GUADALAJARA = 'Guadalajara',
  HUELVA = 'Huelva',
  HUESCA = 'Huesca',
  JAEN = 'Jaén',
  LAS_PALMAS = 'Las Palmas de Gran Canaria',
  LEON = 'León',
  LLEIDA = 'Lleida',
  LOGRONO = 'Logroño',
  LUGO = 'Lugo',
  MADRID = 'Madrid',
  MALAGA = 'Málaga',
  MELILLA = 'Melilla',
  MURCIA = 'Murcia',
  OURENSE = 'Ourense',
  OVIEDO = 'Oviedo',
  PALENCIA = 'Palencia',
  PALMA_DE_MALLORCA = 'Palma de Mallorca',
  PAMPLONA = 'Pamplona/Iruña',
  PONTEVEDRA = 'Pontevedra',
  SALAMANCA = 'Salamanca',
  SAN_SEBASTIAN = 'San Sebastián',
  SANTA_CRUZ_DE_TENERIFE = 'Santa Cruz de Tenerife',
  SANTANDER = 'Santander',
  SEGOVIA = 'Segovia',
  SEVILLA = 'Sevilla',
  SORIA = 'Soria',
  TARRAGONA = 'Tarragona',
  TERUEL = 'Teruel',
  TOLEDO = 'Toledo',
  VALENCIA = 'Valencia',
  VALLADOLID = 'Valladolid',
  VITORIA_GASTEIZ = 'Vitoria-Gasteiz',
  ZAMORA = 'Zamora',
  ZARAGOZA = 'Zaragoza',
}

export interface TemperaturaAguaRed {
  provincia: ProvinciaCapital;
  altitud: number; // m, capital de provincia
  /** Ti °C: [enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre] */
  mensual: [number, number, number, number, number, number, number, number, number, number, number, number];
}

export interface PasoTrazabilidad {
  paso: string;
  formula: string;
  entradas: Record<string, unknown>;
  resultado: unknown;
  fuente: FuenteNormativa;
}

export interface DetalleMensualAcs {
  mes: number; // 1-12
  ti: number; // °C, ya corregida por altitud si aplica
  diaria60: number; // L/día a 60°C (constante todo el año)
  diariaT: number; // L/día a la temperatura elegida T
  mensualT: number; // L/mes a T
}

export interface ResultadoAcs {
  ocupacionCalculada: number;
  unidad: string;
  demandaReferenciaDiaria60C: number;
  factorCentralizacion: number;
  temperaturaPreparacion: number;
  demandaAnualCorregida: number;
  detalleMensual: DetalleMensualAcs[];
  ambitoHe4Aplica: boolean;
  contribucionRenovableMinima: number;
  volumenAcumuladorLitros: number | null;
  trazabilidad: PasoTrazabilidad[];
}

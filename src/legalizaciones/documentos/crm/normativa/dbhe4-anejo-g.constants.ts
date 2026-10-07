/**
 * CTE DB-HE4 — Anejo G (temperatura del agua de red).
 * Transcrito literalmente de: Documento Básico HE Ahorro de energía,
 * Ministerio de Vivienda y Agenda Urbana,
 * https://www.codigotecnico.org/pdf/Documentos/HE/DBHE.pdf, Tabla a-Anejo G, págs. 54-55
 * (descargado 2026-09-02). 52 filas = 50 provincias + Ceuta + Melilla.
 * No modificar valores sin volver a verificar contra el texto oficial vigente.
 */
import { ProvinciaCapital, TemperaturaAguaRed, FuenteNormativa } from './dbhe4.types';

export const FUENTE_ANEJO_G: FuenteNormativa = {
  documento: 'Documento Básico HE Ahorro de energía',
  seccion: 'Anejo G',
  apartado: 'Tabla a-Anejo G — Temperatura diaria media mensual de agua fría',
  pagina: 54,
  paginaFin: 55,
  url: 'https://www.codigotecnico.org/pdf/Documentos/HE/DBHE.pdf',
  fechaConsulta: '2026-09-02',
};

export const FUENTE_ANEJO_G_CORRECCION_ALTITUD: FuenteNormativa = {
  documento: 'Documento Básico HE Ahorro de energía',
  seccion: 'Anejo G',
  apartado: '2. Corrección por altitud para localidades distintas de la capital de provincia',
  pagina: 55,
  url: 'https://www.codigotecnico.org/pdf/Documentos/HE/DBHE.pdf',
  fechaConsulta: '2026-09-02',
};

// mensual: [ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic] — °C
export const TEMPERATURA_AGUA_RED: readonly TemperaturaAguaRed[] = [
  { provincia: ProvinciaCapital.A_CORUNA, altitud: 26, mensual: [10, 10, 11, 12, 13, 14, 16, 16, 15, 14, 12, 11] },
  { provincia: ProvinciaCapital.ALBACETE, altitud: 686, mensual: [7, 8, 9, 11, 14, 17, 19, 19, 17, 13, 9, 7] },
  { provincia: ProvinciaCapital.ALICANTE, altitud: 8, mensual: [11, 12, 13, 14, 16, 18, 20, 20, 19, 16, 13, 12] },
  { provincia: ProvinciaCapital.ALMERIA, altitud: 16, mensual: [12, 12, 13, 14, 16, 18, 20, 21, 19, 17, 14, 12] },
  { provincia: ProvinciaCapital.AVILA, altitud: 1131, mensual: [6, 6, 7, 9, 11, 14, 17, 16, 14, 11, 8, 6] },
  { provincia: ProvinciaCapital.BADAJOZ, altitud: 186, mensual: [9, 10, 11, 13, 15, 18, 20, 20, 18, 15, 12, 9] },
  { provincia: ProvinciaCapital.BARCELONA, altitud: 12, mensual: [9, 10, 11, 12, 14, 17, 19, 19, 17, 15, 12, 10] },
  { provincia: ProvinciaCapital.BILBAO, altitud: 6, mensual: [9, 10, 10, 11, 13, 15, 17, 17, 16, 14, 11, 10] },
  { provincia: ProvinciaCapital.BURGOS, altitud: 929, mensual: [5, 6, 7, 9, 11, 13, 16, 16, 14, 11, 7, 6] },
  { provincia: ProvinciaCapital.CACERES, altitud: 459, mensual: [9, 10, 11, 12, 14, 18, 21, 20, 19, 15, 11, 9] },
  { provincia: ProvinciaCapital.CADIZ, altitud: 14, mensual: [12, 12, 13, 14, 16, 18, 19, 20, 19, 17, 14, 12] },
  { provincia: ProvinciaCapital.CASTELLON, altitud: 27, mensual: [10, 11, 12, 13, 15, 18, 19, 20, 18, 16, 12, 11] },
  { provincia: ProvinciaCapital.CEUTA, altitud: 40, mensual: [11, 11, 12, 13, 14, 16, 18, 18, 17, 15, 13, 12] },
  { provincia: ProvinciaCapital.CIUDAD_REAL, altitud: 628, mensual: [7, 8, 10, 11, 14, 17, 20, 20, 17, 13, 10, 7] },
  { provincia: ProvinciaCapital.CORDOBA, altitud: 106, mensual: [10, 11, 12, 14, 16, 19, 21, 21, 19, 16, 12, 10] },
  { provincia: ProvinciaCapital.CUENCA, altitud: 999, mensual: [6, 7, 8, 10, 13, 16, 18, 18, 16, 12, 9, 7] },
  { provincia: ProvinciaCapital.GIRONA, altitud: 70, mensual: [8, 9, 10, 11, 14, 16, 19, 18, 17, 14, 10, 9] },
  { provincia: ProvinciaCapital.GRANADA, altitud: 683, mensual: [8, 9, 10, 12, 14, 17, 20, 19, 17, 14, 11, 8] },
  { provincia: ProvinciaCapital.GUADALAJARA, altitud: 685, mensual: [7, 8, 9, 11, 14, 17, 19, 19, 16, 13, 9, 7] },
  { provincia: ProvinciaCapital.HUELVA, altitud: 30, mensual: [12, 12, 13, 14, 16, 18, 20, 20, 19, 17, 14, 12] },
  { provincia: ProvinciaCapital.HUESCA, altitud: 488, mensual: [7, 8, 10, 11, 14, 16, 19, 18, 17, 13, 9, 7] },
  { provincia: ProvinciaCapital.JAEN, altitud: 568, mensual: [9, 10, 11, 13, 16, 19, 21, 21, 19, 15, 12, 9] },
  { provincia: ProvinciaCapital.LAS_PALMAS, altitud: 13, mensual: [15, 15, 16, 16, 17, 18, 19, 19, 19, 18, 17, 16] },
  { provincia: ProvinciaCapital.LEON, altitud: 838, mensual: [6, 6, 8, 9, 12, 14, 16, 16, 15, 11, 8, 6] },
  { provincia: ProvinciaCapital.LLEIDA, altitud: 182, mensual: [7, 9, 10, 12, 15, 17, 20, 19, 17, 14, 10, 7] },
  { provincia: ProvinciaCapital.LOGRONO, altitud: 385, mensual: [7, 8, 10, 11, 13, 16, 18, 18, 16, 13, 10, 8] },
  { provincia: ProvinciaCapital.LUGO, altitud: 454, mensual: [7, 8, 9, 10, 11, 13, 15, 15, 14, 12, 9, 8] },
  { provincia: ProvinciaCapital.MADRID, altitud: 655, mensual: [8, 8, 10, 12, 14, 17, 20, 19, 17, 13, 10, 8] },
  { provincia: ProvinciaCapital.MALAGA, altitud: 11, mensual: [12, 12, 13, 14, 16, 18, 20, 20, 19, 16, 14, 12] },
  { provincia: ProvinciaCapital.MELILLA, altitud: 15, mensual: [12, 13, 13, 14, 16, 18, 20, 20, 19, 17, 14, 13] },
  { provincia: ProvinciaCapital.MURCIA, altitud: 39, mensual: [11, 11, 12, 13, 15, 17, 19, 20, 18, 16, 13, 11] },
  { provincia: ProvinciaCapital.OURENSE, altitud: 139, mensual: [8, 10, 11, 12, 14, 16, 18, 18, 17, 13, 11, 9] },
  { provincia: ProvinciaCapital.OVIEDO, altitud: 232, mensual: [9, 9, 10, 10, 12, 14, 15, 16, 15, 13, 10, 9] },
  { provincia: ProvinciaCapital.PALENCIA, altitud: 734, mensual: [6, 7, 8, 10, 12, 15, 17, 17, 15, 12, 9, 6] },
  { provincia: ProvinciaCapital.PALMA_DE_MALLORCA, altitud: 15, mensual: [11, 11, 12, 13, 15, 18, 20, 20, 19, 17, 14, 12] },
  { provincia: ProvinciaCapital.PAMPLONA, altitud: 490, mensual: [7, 8, 9, 10, 12, 15, 17, 17, 16, 13, 9, 7] },
  { provincia: ProvinciaCapital.PONTEVEDRA, altitud: 27, mensual: [10, 11, 11, 13, 14, 16, 17, 17, 16, 14, 12, 10] },
  { provincia: ProvinciaCapital.SALAMANCA, altitud: 800, mensual: [6, 7, 8, 10, 12, 15, 17, 17, 15, 12, 8, 6] },
  { provincia: ProvinciaCapital.SAN_SEBASTIAN, altitud: 12, mensual: [9, 9, 10, 11, 12, 14, 16, 16, 15, 14, 11, 9] },
  { provincia: ProvinciaCapital.SANTA_CRUZ_DE_TENERIFE, altitud: 5, mensual: [15, 15, 16, 16, 17, 18, 20, 20, 20, 18, 17, 16] },
  { provincia: ProvinciaCapital.SANTANDER, altitud: 11, mensual: [10, 10, 11, 11, 13, 15, 16, 16, 16, 14, 12, 10] },
  { provincia: ProvinciaCapital.SEGOVIA, altitud: 1002, mensual: [6, 7, 8, 10, 12, 15, 18, 18, 15, 12, 8, 6] },
  { provincia: ProvinciaCapital.SEVILLA, altitud: 11, mensual: [11, 11, 13, 14, 16, 19, 21, 21, 20, 16, 13, 11] },
  { provincia: ProvinciaCapital.SORIA, altitud: 1063, mensual: [5, 6, 7, 9, 11, 14, 17, 16, 14, 11, 8, 6] },
  { provincia: ProvinciaCapital.TARRAGONA, altitud: 69, mensual: [10, 11, 12, 14, 16, 18, 20, 20, 19, 16, 12, 11] },
  { provincia: ProvinciaCapital.TERUEL, altitud: 912, mensual: [6, 7, 8, 10, 12, 15, 18, 17, 15, 12, 8, 6] },
  { provincia: ProvinciaCapital.TOLEDO, altitud: 629, mensual: [8, 9, 11, 12, 15, 18, 21, 20, 18, 14, 11, 8] },
  { provincia: ProvinciaCapital.VALENCIA, altitud: 13, mensual: [10, 11, 12, 13, 15, 17, 19, 20, 18, 16, 13, 11] },
  { provincia: ProvinciaCapital.VALLADOLID, altitud: 698, mensual: [6, 8, 9, 10, 12, 15, 18, 18, 16, 12, 9, 7] },
  { provincia: ProvinciaCapital.VITORIA_GASTEIZ, altitud: 540, mensual: [7, 7, 8, 10, 12, 14, 16, 16, 14, 12, 8, 7] },
  { provincia: ProvinciaCapital.ZAMORA, altitud: 649, mensual: [6, 8, 9, 10, 13, 16, 18, 18, 16, 12, 9, 7] },
  { provincia: ProvinciaCapital.ZARAGOZA, altitud: 199, mensual: [8, 9, 10, 12, 15, 17, 20, 19, 17, 14, 10, 8] },
];

/** Anejo G, pág. 55: B en °C/m. Meses de invierno (correción con mayor coeficiente). */
export const COEFICIENTE_ALTITUD_INVIERNO = 0.0066;
/** Anejo G, pág. 55: B en °C/m para abril-septiembre. */
export const COEFICIENTE_ALTITUD_VERANO = 0.0033;
export const MESES_INVIERNO_ALTITUD: readonly number[] = [10, 11, 12, 1, 2, 3];
export const MESES_VERANO_ALTITUD: readonly number[] = [4, 5, 6, 7, 8, 9];

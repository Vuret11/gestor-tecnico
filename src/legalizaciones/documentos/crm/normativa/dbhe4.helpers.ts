/**
 * Funciones puras de consulta de tablas y fórmulas de CTE DB-HE4 (Anejo F / Anejo G).
 * Sin I/O, sin dependencias de NestJS — testeables de forma aislada.
 */
import {
  OCUPACION_REFERENCIA_TABLA_A,
  FACTOR_CENTRALIZACION_TABLA_B,
  DEMANDA_REFERENCIA_TABLA_C,
  TEMPERATURA_REFERENCIA_ACS,
  DORMITORIOS_MAXIMO_TABLA_A,
} from './dbhe4-anejo-f.constants';
import {
  TEMPERATURA_AGUA_RED,
  COEFICIENTE_ALTITUD_INVIERNO,
  COEFICIENTE_ALTITUD_VERANO,
  MESES_INVIERNO_ALTITUD,
} from './dbhe4-anejo-g.constants';
import { UsoNoResidencial, ProvinciaCapital, TemperaturaAguaRed } from './dbhe4.types';

/** Tabla a-Anejo F: número mínimo de personas de cálculo según dormitorios (7 = "≥7"). */
export function getOcupacionPorDormitorios(dormitorios: number): number {
  const ocupacion = OCUPACION_REFERENCIA_TABLA_A[dormitorios];
  if (ocupacion === undefined) {
    throw new Error(
      `Número de dormitorios no válido para la Tabla a-Anejo F: ${dormitorios} (debe estar entre 1 y ${DORMITORIOS_MAXIMO_TABLA_A}).`,
    );
  }
  return ocupacion;
}

/** Tabla b-Anejo F: factor de centralización según número de viviendas del edificio. */
export function getFactorCentralizacion(numeroViviendas: number): number {
  const tramo = FACTOR_CENTRALIZACION_TABLA_B.find(
    (t) => numeroViviendas >= t.min && (t.max === null || numeroViviendas <= t.max),
  );
  if (!tramo) {
    throw new Error(`Número de viviendas no válido para la Tabla b-Anejo F: ${numeroViviendas}.`);
  }
  return tramo.factor;
}

/** Tabla c-Anejo F: litros/día·persona de referencia a 60°C para un uso no residencial. */
export function getDemandaReferenciaNoResidencial(uso: UsoNoResidencial): number {
  const valor = DEMANDA_REFERENCIA_TABLA_C[uso];
  if (valor === undefined) {
    throw new Error(`Uso no residencial no reconocido en la Tabla c-Anejo F: ${uso}.`);
  }
  return valor;
}

/** Tabla a-Anejo G: fila de temperatura de agua de red de la capital de provincia indicada. */
export function getTemperaturaAguaRed(provincia: ProvinciaCapital): TemperaturaAguaRed {
  const fila = TEMPERATURA_AGUA_RED.find((f) => f.provincia === provincia);
  if (!fila) {
    throw new Error(`Provincia no encontrada en la Tabla a-Anejo G: ${provincia}.`);
  }
  return fila;
}

/**
 * Anejo G, pág. 55: TAFY = TAFCP − B·Δz.
 * B = 0,0066 (oct-mar) o 0,0033 (abr-sep); Δz = altitud_localidad − altitud_capital.
 */
export function corregirTemperaturaPorAltitud(
  tiCapital: number,
  mes: number,
  altitudLocalidad: number,
  altitudCapital: number,
): number {
  const deltaZ = altitudLocalidad - altitudCapital;
  const b = MESES_INVIERNO_ALTITUD.includes(mes) ? COEFICIENTE_ALTITUD_INVIERNO : COEFICIENTE_ALTITUD_VERANO;
  return tiCapital - b * deltaZ;
}

/**
 * Anejo F, pág. 53: Di(T) = Di(60ºC) · (60 − Ti) / (T − Ti).
 * Lanza error si T === Ti (división por cero): la temperatura de preparación debe ser
 * estrictamente superior a la temperatura del agua de red en todos los meses del año.
 */
export function corregirDemandaPorTemperatura(
  di60: number,
  temperaturaObjetivo: number,
  ti: number,
): number {
  if (temperaturaObjetivo === ti) {
    throw new Error(
      `División por cero: la temperatura de preparación (${temperaturaObjetivo}°C) es igual a la temperatura del agua de red (${ti}°C).`,
    );
  }
  return (di60 * (TEMPERATURA_REFERENCIA_ACS - ti)) / (temperaturaObjetivo - ti);
}

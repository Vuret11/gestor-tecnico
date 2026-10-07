/**
 * Estimación de demanda de calefacción por tipo de emisor — Módulo 2. REGLA INTERNA DEL
 * INSTALADOR, NO normativa: no es el cálculo de carga térmica de UNE-EN 12831-1:2017 (norma
 * AENOR de pago, sin acceso — sigue siendo el gap bloqueante ya documentado). El usuario dio
 * esta regla explícitamente (2026-09-03, cita textual: "La demanda va a ser fija según tipo de
 * instalación: 60 kcal/m2 para vivienda. Para radiadores 80 kcal/m2 y para fancoil: 110kcal/m2.
 * Esto será fijo.") y la reconfirmó el 2026-09-04 al preguntarle si las cifras (dadas esa vez
 * como "W/m²") eran las mismas expresadas en otra unidad — respuesta: sí, mismas cifras
 * kcal/m², no vatios literales. Ya existía como ayuda del lado del cliente en el formulario web
 * (backend/public/index.html); este módulo es la versión de backend, persistida y trazable,
 * con la opción explícita de introducir la demanda a mano en su lugar (pedida por el usuario:
 * "pon una opción para ponerlo a manual").
 */
import { FuenteTecnica, PasoTrazabilidadTecnica } from './qusable-eres.types';

export const FUENTE_REGLA_INSTALADOR_DEMANDA: FuenteTecnica = {
  tipo: 'regla_interna',
  documento: 'Regla interna del instalador (Homeserve Solar) — no es UNE-EN 12831-1:2017',
  seccion: 'Estimación de demanda de calefacción por tipo de emisor',
  apartado: '60 kcal/(h·m²) vivienda/suelo radiante/conductos/expansión directa/otros — 80 kcal/(h·m²) radiadores — 110 kcal/(h·m²) fan coil',
  url: '',
  fechaConsulta: '2026-09-04',
};

export enum TipoEmisor {
  SUELO_RADIANTE = 'SUELO_RADIANTE',
  CONDUCTOS = 'CONDUCTOS',
  EXPANSION_DIRECTA = 'EXPANSION_DIRECTA',
  OTROS = 'OTROS',
  RADIADORES = 'RADIADORES',
  FAN_COIL = 'FAN_COIL',
}

export const KCAL_M2_POR_EMISOR: Record<TipoEmisor, number> = {
  [TipoEmisor.SUELO_RADIANTE]: 60,
  [TipoEmisor.CONDUCTOS]: 60,
  [TipoEmisor.EXPANSION_DIRECTA]: 60,
  [TipoEmisor.OTROS]: 60,
  [TipoEmisor.RADIADORES]: 80,
  [TipoEmisor.FAN_COIL]: 110,
};

/** 1 kcal/h = 1,163 W exacto (1 kcal = 4,1868 J exacto ÷ 3600 s) — conversión física, no de catálogo. */
export const KCAL_H_A_W = 1.163;

export interface ResultadoDemanda {
  esManual: boolean;
  tipoEmisor: TipoEmisor | null;
  /** Emisores marcados (varios desde 2026-09-29). Vacío en modo manual. */
  tipoEmisores: TipoEmisor[];
  superficieM2: number | null;
  demandaCalefaccionKW: number;
  trazabilidad: PasoTrazabilidadTecnica[];
}

/**
 * Emisores de un expediente, admitiendo las dos formas: `tipoEmisores` (varios, desde 2026-09-29) y
 * el antiguo `tipoEmisor` (uno solo, expedientes ya calculados). Los expedientes viejos no llevan
 * `tipoEmisores`, así que caen al singular y siguen funcionando igual.
 */
export function emisoresDe(entrada: {
  tipoEmisor?: TipoEmisor | null;
  tipoEmisores?: TipoEmisor[] | null;
}): TipoEmisor[] {
  const lista = (entrada.tipoEmisores ?? []).filter((e): e is TipoEmisor => Boolean(e));
  if (lista.length > 0) return lista;
  return entrada.tipoEmisor ? [entrada.tipoEmisor] : [];
}

/**
 * Factor kcal/(h·m²) más restrictivo (el mayor) de los emisores marcados. Regla del instalador
 * (2026-09-29): con emisores mezclados «toda superficie» va con el factor más restrictivo.
 */
export function factorKcalM2MasRestrictivo(emisores: TipoEmisor[]): number | null {
  if (emisores.length === 0) return null;
  return Math.max(...emisores.map((e) => KCAL_M2_POR_EMISOR[e]));
}

/**
 * Carga (W/m²) de la tabla «RESUMEN DE CARGAS CALORÍFICAS POR LOCAL Y ELEMENTO INSTALADO» del
 * MOD-315 (pág. 11) — regla del instalador del 30-sep-2026: «si es suelo radiante multiplica la
 * superficie 55; si son radiadores o fancoils, 120; si hay combinaciones, el más restrictivo: suelo
 * radiante + fancoil ⇒ superficie × 120».
 *
 * OJO: NO son los kcal/(h·m²) del cálculo de demanda (`KCAL_M2_POR_EMISOR`, que además va en
 * kcal/h) — son los de ESTA tabla del impreso, se aplican tal cual y sin convertir.
 *
 * Solo los tres emisores que el instalador nombró: conductos, expansión directa y «otros» quedan
 * SIN factor a propósito (devolverían una carga inventada); si algún día se legaliza una
 * instalación con esos emisores hay que pedirle el número.
 */
export const CARGA_RESUMEN_W_M2: Partial<Record<TipoEmisor, number>> = {
  [TipoEmisor.SUELO_RADIANTE]: 55,
  [TipoEmisor.RADIADORES]: 80,
  [TipoEmisor.FAN_COIL]: 100,
};

/**
 * ¿La instalación enfría? Solo con suelo radiante o fancoils — regla del instalador (6-oct-2026):
 * «si solo hay radiadores no cojas EER porque no hay nada que enfríe». El COP y el SCOP se declaran
 * siempre; el EER y el SEER, solo si hay refrigeración.
 */
export function tieneRefrigeracion(emisores: TipoEmisor[]): boolean {
  return emisores.includes(TipoEmisor.SUELO_RADIANTE) || emisores.includes(TipoEmisor.FAN_COIL);
}

/** Factor W/m² de la tabla de resumen de cargas, el más restrictivo si hay emisores mezclados. */
export function factorCargaResumenWm2(emisores: TipoEmisor[]): number | null {
  const factores = emisores
    .map((e) => CARGA_RESUMEN_W_M2[e])
    .filter((f): f is number => typeof f === 'number');
  if (factores.length === 0 || factores.length !== emisores.length) return null;
  return Math.max(...factores);
}

/** Régimen de calefacción de la instalación: el punto de ensayo EN 14511 que hay que declarar. */
export type RegimenCalefaccion = 'A7W55' | 'A7W45' | 'A7W35';

/**
 * Régimen de calefacción de la instalación: de toda la combinación de emisores se coge **el más
 * restrictivo**, que es el que da la temperatura de impulsión más alta y el rendimiento más bajo
 * (regla del instalador, 5-oct-2026):
 *
 *   - radiadores .................. 55 °C (A7W55)
 *   - fancoils .................... 45 °C (A7W45) — y 55 °C si la ficha no publica el de 45
 *   - suelo radiante (u otros) .... 35 °C (A7W35)
 *
 * Así, suelo radiante + fancoils se declara a 45 °C (el más restrictivo de los dos) y no a 35; y si
 * además hay radiadores, a 55. El respaldo del fancoil (45 → 55) lo aplica `puntoCalefaccionDe`.
 */
export function regimenCalefaccion(emisores: TipoEmisor[]): RegimenCalefaccion {
  if (emisores.includes(TipoEmisor.RADIADORES)) return 'A7W55';
  if (emisores.includes(TipoEmisor.FAN_COIL)) return 'A7W45';
  return 'A7W35';
}

/**
 * Punto de ensayo EN 14511 de refrigeración (EER). Regla del instalador (2026-09-29): con suelo
 * radiante el agua va SIEMPRE a 18 °C («no se puede condensar el agua»); con fancoils se puede bajar
 * a agua a 7 °C.
 */
export function regimenRefrigeracion(emisores: TipoEmisor[]): 'A35W18' | 'A35W7' {
  if (emisores.includes(TipoEmisor.SUELO_RADIANTE)) return 'A35W18';
  return emisores.includes(TipoEmisor.FAN_COIL) ? 'A35W7' : 'A35W18';
}

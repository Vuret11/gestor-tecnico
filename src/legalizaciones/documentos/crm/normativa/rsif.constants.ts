/**
 * Umbrales de carga de refrigerante (kg) a partir de los cuales una instalación deja de
 * estar exenta de documentación y necesita memoria técnica (o proyecto) según el RSIF
 * (Real Decreto 552/2019, Reglamento de Seguridad para Instalaciones Frigoríficas).
 *
 * Esto es el umbral de "exención total de trámite" para el caso más simple (sistema no
 * compacto tipo split, local no de pública concurrencia) — NO sustituye al cálculo completo
 * de carga máxima admisible por tamaño de local/ventilación de la UNE-EN 378-1, que depende
 * del volumen del recinto y no está automatizado aquí (dato de instalación, no de catálogo).
 */
import { FuenteTecnica } from './qusable-eres.types';

export interface UmbralRefrigerante {
  umbralKg: number;
  fuente: FuenteTecnica;
}

export const FUENTE_RSIF_R32: FuenteTecnica = {
  tipo: 'guia_practica',
  documento: 'Refrigerantes R32 en equipos de Climatización (CNI, junio 2021) — RSIF (RD 552/2019) art. 2.2.b)',
  seccion: 'Documentación adicional con respecto a R410A',
  apartado: 'Por debajo de 1,84 kg de carga: no se exige documentación',
  url: 'https://www.cni-instaladores.com/wp-content/uploads/2021/06/R32-GuiaCNI_final.pdf',
  fechaConsulta: '2026-09-03',
};

export const FUENTE_RSIF_R290: FuenteTecnica = {
  tipo: 'guia_practica',
  documento: 'CNI Instaladores — Refrigerante R290, atención en la instalación y mantenimiento — RSIF (RD 552/2019) art. 21',
  seccion: 'Carga máxima sin documentación',
  apartado: 'Por debajo de 0,5 kg: fuera del ámbito del RSIF. Por encima: instalación de nivel 2 con documentación del art. 21.',
  url: 'https://www.cni-instaladores.com/refrigerante-r290-atencion-en-la-instalacion-y-mantenimiento/',
  fechaConsulta: '2026-09-03',
};

/**
 * Sin cita textual propia del RSIF localizada (la única cifra de "2,5 kg" encontrada en las
 * fuentes consultadas corresponde al antiguo límite pre-RSIF 2019 para locales de pública
 * concurrencia, que la norma amplió a 12 kg específicamente para refrigerantes A2L — coherente
 * con que los A1 se hayan quedado en el valor antiguo, pero no es una cita literal del RSIF
 * para A1). Confirmado explícitamente por el usuario (instalador real, 2026-09-04: "sobre el
 * umbral de R410 está bien") para R410A y R134A, ambos refrigerantes A1 (no inflamables).
 */
export const FUENTE_RSIF_A1_CONFIRMADA_INSTALADOR: FuenteTecnica = {
  tipo: 'guia_practica',
  documento: 'Umbral confirmado por el instalador (sin cita textual propia localizada en el RSIF/RD 552/2019)',
  seccion: 'N/D',
  apartado: 'N/D',
  url: '',
  fechaConsulta: '2026-09-04',
};

/**
 * Coincide por prefijo contra el texto libre de Maquina.refrigerante (p.ej.
 * "R290 (propano, natural)"), no por igualdad exacta — el catálogo no usa un enum cerrado.
 * IMPORTANTE: "R410A" debe comprobarse antes que "R134A" solo importa si hay prefijos
 * ambiguos entre sí — aquí no los hay, cada prefijo es único letra por letra.
 */
export const UMBRALES_LEGALIZACION_REFRIGERANTE: { prefijo: string; umbral: UmbralRefrigerante }[] = [
  { prefijo: 'R32', umbral: { umbralKg: 1.84, fuente: FUENTE_RSIF_R32 } },
  { prefijo: 'R290', umbral: { umbralKg: 0.5, fuente: FUENTE_RSIF_R290 } },
  { prefijo: 'R410A', umbral: { umbralKg: 2.5, fuente: FUENTE_RSIF_A1_CONFIRMADA_INSTALADOR } },
  { prefijo: 'R134A', umbral: { umbralKg: 2.5, fuente: FUENTE_RSIF_A1_CONFIRMADA_INSTALADOR } },
];

export function buscarUmbralRefrigerante(refrigerante: string | null): UmbralRefrigerante | null {
  const prefijo = prefijoRefrigerante(refrigerante);
  if (prefijo === null) return null;
  const encontrado = UMBRALES_LEGALIZACION_REFRIGERANTE.find((u) => u.prefijo === prefijo);
  return encontrado ? encontrado.umbral : null;
}

/**
 * Prefijo normalizado del refrigerante («R290 (propano, natural)» → «R290»). Es la CLAVE con la que
 * se agrupa la carga de varias máquinas para compararla con el umbral: el instalador confirmó
 * (29-sep-2026) que con varias máquinas «se mira la suma» por refrigerante — 2 × R32 de 1,5 kg =
 * 3 kg superan el umbral de 1,84 kg aunque cada máquina por separado no lo supere.
 *
 * Si el refrigerante no está en la tabla se devuelve su propio texto en mayúsculas, para no meter
 * en el mismo grupo dos refrigerantes distintos solo porque los dos son desconocidos (agruparlos
 * daría una suma inventada, y sin umbral el resultado ya se trata como «puede requerir» memoria).
 */
/**
 * Nombre del refrigerante en forma canónica para COMPARAR: mayúsculas y sin espacios ni guiones
 * («R-32» → «R32», «R 410A» → «R410A»). Los catálogos no se ponen de acuerdo en el guion (Midea
 * escribe «R-32», Saunier Duval «R32») y comparar el texto a pelo dejaba el R-32 clasificado como
 * «no fluorado» y sin grupo del RSIF. Se normaliza al comparar; el nombre que va al impreso es el
 * del fabricante, tal cual.
 */
export function normalizarRefrigerante(refrigerante: string | null): string | null {
  if (!refrigerante) return null;
  const limpio = refrigerante.trim().toUpperCase().replace(/[\s-]/g, '');
  return limpio === '' ? null : limpio;
}

export function prefijoRefrigerante(refrigerante: string | null): string | null {
  const limpio = normalizarRefrigerante(refrigerante);
  if (!limpio) return null;
  const encontrado = UMBRALES_LEGALIZACION_REFRIGERANTE.find((u) => limpio.startsWith(u.prefijo));
  return encontrado ? encontrado.prefijo : limpio;
}

/**
 * Grupo de seguridad EN 378 (toxicidad+inflamabilidad) — dato del "Certificado de la
 * Instalación Frigorífica" (RSIF art. 21). No es el mismo umbral de legalización de arriba,
 * es la clasificación del refrigerante en sí; misma correspondencia prefijo→grupo ya usada
 * para los umbrales, ampliada con el grupo de seguridad de cada uno (clasificación pública y
 * estable de EN 378-1, no específica de este proyecto).
 */
export const GRUPO_SEGURIDAD_EN378: { prefijo: string; grupo: string }[] = [
  { prefijo: 'R32', grupo: 'A2L' },
  { prefijo: 'R290', grupo: 'A3' },
  { prefijo: 'R410A', grupo: 'A1' },
  { prefijo: 'R134A', grupo: 'A1' },
];

export function buscarGrupoSeguridadRefrigerante(refrigerante: string | null): string | null {
  const limpio = normalizarRefrigerante(refrigerante);
  if (!limpio) return null;
  const encontrado = GRUPO_SEGURIDAD_EN378.find((g) => limpio.startsWith(g.prefijo));
  return encontrado ? encontrado.grupo : null;
}

/**
 * Grupo de seguridad del RSIF (art. 4 del RD 552/2019) — es lo que piden los formularios
 * ("Clasificación del refrigerante: L1/L2/L3" en el MOD-315 punto 10 y "Grupo de refrigerante"
 * en el certificado RSIF). NO es lo mismo que el grupo EN 378 de arriba: aquel clasifica el
 * refrigerante por toxicidad+inflamabilidad (A1/A2L/A3) y este por el grupo reglamentario:
 * - L1 (alta seguridad): no inflamables y de acción tóxica ligera o nula.
 * - L2 (media seguridad): tóxicos/corrosivos o inflamables con porcentaje en aire ≥ 3,5 %.
 *   El art. 4.2.b) incluye expresamente aquí los A2L (R32).
 * - L3 (baja seguridad): inflamables o explosivos por debajo del 3,5 % en aire (R290).
 */
export const GRUPO_RSIF: { prefijo: string; grupo: string }[] = [
  { prefijo: 'R290', grupo: 'L3' },
  { prefijo: 'R32', grupo: 'L2' },
  { prefijo: 'R410A', grupo: 'L1' },
  { prefijo: 'R134A', grupo: 'L1' },
];

export function buscarGrupoRsif(refrigerante: string | null): string | null {
  const limpio = normalizarRefrigerante(refrigerante);
  if (!limpio) return null;
  const encontrado = GRUPO_RSIF.find((g) => limpio.startsWith(g.prefijo));
  return encontrado ? encontrado.grupo : null;
}

/**
 * Valor con el que se declara el refrigerante en los impresos que piden la «Clasificación del
 * refrigerante» (MOD-315 punto 10) o el «Grupo de refrigerante» (certificado RSIF). Reglas fijadas
 * por el instalador el 30-sep-2026, porque los impresos ofrecen las cuatro casillas L1/L2/L3/A2L:
 * - A2L (R32) → «A2L»: es la casilla que se marca. NO se marca además L2, aunque el art. 4.2.b) del
 *   RD 552/2019 englobe los A2L en el grupo L2 (el instalador lo corrigió expresamente:
 *   «has marcado L2 y A2L, cuando solo es A2L»).
 * - A3 (R290) → «L3»: «ninguna de las máquinas tiene R290, pero en el caso de que lo hubiera se debe
 *   marcar L3» (no hay casilla A3 en el impreso).
 * - A1 (R410A, R134a) → «L1», que es su grupo en el RSIF (tampoco hay casilla A1).
 */
export function clasificacionRefrigeranteImpreso(refrigerante: string | null): string | null {
  const clase = buscarGrupoSeguridadRefrigerante(refrigerante);
  if (clase === 'A2L') return 'A2L';
  return buscarGrupoRsif(refrigerante);
}

/**
 * PCA (potencial de calentamiento atmosférico) en kg de CO2 equivalente por kg de refrigerante
 * — Reglamento (UE) 517/2014, anexo I (valores oficiales AR4/AR5). Sirve para las "toneladas
 * equivalentes de CO2" que piden el MOD-315 (punto 10) y el certificado RSIF. El propano (R290)
 * es un refrigerante natural: PCA 3 y, además, no es un gas fluorado.
 */
export const PCA_REFRIGERANTE: { prefijo: string; pca: number }[] = [
  { prefijo: 'R290', pca: 3 },
  { prefijo: 'R32', pca: 675 },
  { prefijo: 'R410A', pca: 2088 },
  { prefijo: 'R134A', pca: 1430 },
];

export function buscarPcaRefrigerante(refrigerante: string | null): number | null {
  const limpio = normalizarRefrigerante(refrigerante);
  if (!limpio) return null;
  const encontrado = PCA_REFRIGERANTE.find((p) => limpio.startsWith(p.prefijo));
  return encontrado ? encontrado.pca : null;
}

/** Toneladas equivalentes de CO2 = carga (kg) × PCA / 1.000. */
export function toneladasCO2Equivalente(
  refrigerante: string | null,
  cargaKg: number | null | undefined,
): number | null {
  const pca = buscarPcaRefrigerante(refrigerante);
  if (pca === null || cargaKg === null || cargaKg === undefined) return null;
  // 4 decimales: con R290 los valores son del orden de milésimas de tonelada (0,0039 t con 1,3 kg)
  return Math.round(((cargaKg * pca) / 1000) * 10000) / 10000;
}

/**
 * ¿Es un gas fluorado de efecto invernadero (Reglamento UE 517/2014)? El propano (R290) no lo
 * es; R32, R410A y R134A sí. Es la casilla "Refrigerante fluorado: Sí/No" del MOD-315.
 */
export function esRefrigeranteFluorado(refrigerante: string | null): boolean | null {
  const r = normalizarRefrigerante(refrigerante);
  if (!r) return null;
  if (r.startsWith('R290') || r.startsWith('R717') || r.startsWith('R744')) return false;
  return buscarPcaRefrigerante(refrigerante) !== null;
}

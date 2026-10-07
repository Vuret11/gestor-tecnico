/**
 * Estimación del consumo anual de energía y de las emisiones de CO2 de la instalación — apartado
 * "ESTIMACIÓN DEL CONSUMO ANUAL DE ENERGÍA" del MOD-315 (pág. 11 del formulario).
 *
 * REGLA DEL INSTALADOR (30-sep-2026), que es la que se declara:
 *
 *   Primaria   = POTENCIA TOTAL DE LA INSTALACIÓN (kW) × 6 × 7 × 8   [20 kW → 6720]
 *
 *   Y las emisiones de CO2 NO se estiman aquí: se declaran las **toneladas equivalentes de CO2 ya
 *   calculadas en el punto 10 del mismo formulario** (Σ carga de refrigerante × PCA / 1000) con su
 *   etiqueta: «1,89 ton eq CO2». Ver `consumoAnualMod315` en `mod-315.mapeo.ts`.
 *
 * El factor 6 × 7 × 8 = 336 lo dio el instalador tal cual (no es una fórmula del RITE que este
 * programa pueda deducir), así que se aplica literalmente y sin reinterpretarlo: si algún día hay
 * que cambiarlo, se cambia aquí y afecta a todos los expedientes.
 *
 * El MÉTODO NORMATIVO por consumos (el que se usaría si el instalador no hubiera fijado su regla)
 * queda documentado más abajo, disponible pero SIN USAR:
 *
 *   E_final[kWh/año] = Q_ACS / SCOP_dhw  +  Q_calef / SCOP_35C
 *
 *     · Q_ACS   = energía útil anual de ACS calculada por este programa según el CTE DB-HE4
 *                 (Anejo F) — dato ya trazado en el expediente.
 *     · SCOP_dhw = COP de ACS EN 16147 (A7, clima medio) del catálogo del fabricante.
 *     · Q_calef = DEMANDA ANUAL DE CALEFACCIÓN del proyecto en kWh/año (dato del expediente:
 *                 `datosObra.demandaAnualCalefaccionKWh`, p. ej. del cálculo del CTE DB-HE1 o del
 *                 certificado energético). NO se deduce de la demanda de diseño (kW): para pasar de
 *                 potencia a energía anual hacen falta horas equivalentes de funcionamiento, que
 *                 este programa no tiene como dato de origen.
 *     · SCOP_35C = rendimiento estacional declarado (clima medio, 35 °C) del catálogo.
 *
 *   Primaria   = E_final × 2,368 kWh EP(total)/kWh E.final
 *   Emisiones  = E_final × 0,331 kg CO2/kWh E.final
 *
 *   Factores: Documento Reconocido del RITE «Factores de emisión de CO2 y coeficientes de paso a
 *   energía primaria de diferentes fuentes de energía final consumidas en el sector de edificios en
 *   España» (Resolución conjunta de los Ministerios de Industria, Energía y Turismo y de Fomento,
 *   aplicación desde 14/01/2016), electricidad convencional PENINSULAR (el escenario de la
 *   instalación): 2,368 kWh EP total/kWh, 1,954 kWh EP no renovable/kWh y 0,331 kg CO2/kWh.
 *   El departamento decidió el 23/09/2026 declarar el coeficiente de energía primaria TOTAL (2,368)
 *   — ver FACTOR_EP_APLICADO; el documento del RITE publica además el no renovable (1,954) y el
 *   renovable (0,414).
 */

/**
 * Factor de la regla del instalador para la energía primaria del MOD-315: 6 × 7 × 8 = 336 veces la
 * potencia total de la instalación. Se aplica tal cual (dictado el 30-sep-2026).
 */
export const FACTOR_CONSUMO_ANUAL_POTENCIA = 6 * 7 * 8;

/**
 * Energía primaria (kWh/año) que se declara en el MOD-315: potencia total de la instalación × 336.
 * Con 2 × M-Thermon A 10 (20 kW) → 6720. Devuelve null si no se conoce la potencia total.
 */
export function energiaPrimariaEstimadaKWh(
  potenciaTotalKW: number | null | undefined,
): number | null {
  if (typeof potenciaTotalKW !== 'number' || potenciaTotalKW <= 0) return null;
  return Math.round(potenciaTotalKW * FACTOR_CONSUMO_ANUAL_POTENCIA);
}

export interface FuenteFactorEnergia {
  documento: string;
  resolucion: string;
  aplicacionDesde: string;
  zona: 'peninsular' | 'nacional' | 'extrapeninsular';
  url: string;
}

export const FUENTE_FACTORES_RITE: FuenteFactorEnergia = {
  documento:
    'Documento Reconocido del RITE: Factores de emisión de CO2 y coeficientes de paso a energía primaria de diferentes fuentes de energía final consumidas en el sector de edificios en España',
  resolucion: 'Resolución conjunta de los Ministerios de Industria, Energía y Turismo y de Fomento',
  aplicacionDesde: '2016-01-14',
  zona: 'peninsular',
  url: 'https://www.miteco.gob.es/content/dam/miteco/es/energia/files-1/Eficiencia/RITE/documentosreconocidosrite/Otros%20documentos/Factores_emision_CO2.pdf',
};

/** Valores aprobados para electricidad convencional PENINSULAR (cuadros págs. 16 y 17 del documento). */
export const FACTORES_ELECTRICIDAD_PENINSULAR = {
  epRenovableKWhPorKWhFinal: 0.414,
  epNoRenovableKWhPorKWhFinal: 1.954,
  epTotalKWhPorKWhFinal: 2.368,
  kgCO2PorKWhFinal: 0.331,
};

/** Valores aprobados para electricidad convencional NACIONAL (por si algún día se usa fuera de la península). */
export const FACTORES_ELECTRICIDAD_NACIONAL = {
  epRenovableKWhPorKWhFinal: 0.396,
  epNoRenovableKWhPorKWhFinal: 2.007,
  epTotalKWhPorKWhFinal: 2.403,
  kgCO2PorKWhFinal: 0.357,
};

/**
 * Coeficiente de paso a energía primaria que se declara en el MOD-315 ("Primaria"): energía primaria
 * TOTAL de la electricidad convencional peninsular (2,368 kWh EP/kWh). Lo fijó el departamento el
 * 23/09/2026; para pasar al indicador no renovable (1,954) basta cambiar esta constante.
 */
export const FACTOR_EP_APLICADO = FACTORES_ELECTRICIDAD_PENINSULAR.epTotalKWhPorKWhFinal;

/** Coeficiente de emisión aplicado (kg CO2/kWh), mismo documento y escenario. */
export const FACTOR_CO2_APLICADO = FACTORES_ELECTRICIDAD_PENINSULAR.kgCO2PorKWhFinal;

export interface EntradaConsumoAnual {
  /** Energía útil anual de ACS (kWh/año) — CalculoQusable del expediente. */
  qusableAnualKWh: number | null | undefined;
  /** COP de ACS EN 16147 (A7, clima medio) del catálogo. */
  scopDhwMedio: number | null | undefined;
  /** Rendimiento estacional declarado (clima medio, 35 °C) del catálogo. */
  scop35CMedio: number | null | undefined;
  /** Demanda anual de calefacción del proyecto (kWh/año). Si falta, no se estima nada. */
  demandaAnualCalefaccionKWh: number | null | undefined;
}

export interface ResultadoConsumoAnual {
  energiaFinalCalefaccionKWh: number;
  energiaFinalAcsKWh: number;
  energiaFinalKWh: number;
  energiaPrimariaKWh: number;
  emisionesCO2Kg: number;
  factores: typeof FACTORES_ELECTRICIDAD_PENINSULAR;
}

function redondear(valor: number, decimales = 0): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

/**
 * Consumo anual (energía final, energía primaria no renovable y emisiones de CO2).
 * Devuelve null si falta cualquiera de los datos de origen — nunca un valor aproximado.
 */
export function consumoAnual(entrada: EntradaConsumoAnual): ResultadoConsumoAnual | null {
  const { qusableAnualKWh, scopDhwMedio, scop35CMedio, demandaAnualCalefaccionKWh } = entrada;
  if (
    typeof qusableAnualKWh !== 'number' ||
    typeof scopDhwMedio !== 'number' ||
    scopDhwMedio <= 0 ||
    typeof scop35CMedio !== 'number' ||
    scop35CMedio <= 0 ||
    typeof demandaAnualCalefaccionKWh !== 'number'
  ) {
    return null;
  }
  const energiaFinalAcsKWh = qusableAnualKWh / scopDhwMedio;
  const energiaFinalCalefaccionKWh = demandaAnualCalefaccionKWh / scop35CMedio;
  const energiaFinalKWh = energiaFinalAcsKWh + energiaFinalCalefaccionKWh;
  return {
    energiaFinalAcsKWh: redondear(energiaFinalAcsKWh, 1),
    energiaFinalCalefaccionKWh: redondear(energiaFinalCalefaccionKWh, 1),
    energiaFinalKWh: redondear(energiaFinalKWh, 1),
    energiaPrimariaKWh: redondear(energiaFinalKWh * FACTOR_EP_APLICADO),
    emisionesCO2Kg: redondear(energiaFinalKWh * FACTOR_CO2_APLICADO),
    factores: FACTORES_ELECTRICIDAD_PENINSULAR,
  };
}

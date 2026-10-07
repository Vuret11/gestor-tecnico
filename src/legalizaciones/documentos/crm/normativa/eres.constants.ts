/**
 * Balance energético de bombas de calor — Directiva (UE) 2018/2001, Anexo VII, y Decisión de la
 * Comisión 2013/114/UE (metodología de cálculo de η). NIVEL DE AUTORIDAD 1, ámbito UE — misma
 * jerarquía que las citas CTE DB-HE4 de dbhe4-anejo-f.constants.ts, pero legislación europea,
 * no nacional.
 */
import { FuenteTecnica } from './qusable-eres.types';
import { FUENTE_HE4_SCOP_DHW, FUENTE_HE4_CONTRIBUCION } from './dbhe4-anejo-f.constants';

/**
 * Adaptadores de las citas HE4 ya existentes (Módulo 3, tipo `FuenteNormativa`) al tipo
 * `FuenteTecnica` que usa la trazabilidad de Módulo 5 — mismos datos de cita (documento,
 * página, url...), solo se añade `tipo: 'legislacion_nacional'`. No se modifica
 * dbhe4-anejo-f.constants.ts ni su tipo `FuenteNormativa`.
 */
export const FUENTE_HE4_SCOP_DHW_TECNICA: FuenteTecnica = { tipo: 'legislacion_nacional', ...FUENTE_HE4_SCOP_DHW };
export const FUENTE_HE4_CONTRIBUCION_TECNICA: FuenteTecnica = { tipo: 'legislacion_nacional', ...FUENTE_HE4_CONTRIBUCION };

export const FUENTE_ANEXO_VII_BALANCE_ENERGETICO: FuenteTecnica = {
  tipo: 'legislacion_ue',
  documento:
    'Directiva (UE) 2018/2001 del Parlamento Europeo y del Consejo, de 11 de diciembre de 2018, ' +
    'relativa al fomento del uso de energía procedente de fuentes renovables (recast de la Directiva 2009/28/CE)',
  seccion: 'Anexo VII',
  apartado: 'Balance energético de las bombas de calor — ERES = Qusable × (1 − 1/SPF)',
  url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32018L2001',
  fechaConsulta: '2026-09-02',
};

export const FUENTE_DECISION_2013_114_UE: FuenteTecnica = {
  tipo: 'legislacion_ue',
  documento:
    'Decisión de la Comisión 2013/114/UE, de 1 de marzo de 2013, por la que se establecen las ' +
    'directrices para el cálculo de la energía renovable procedente de bombas de calor',
  seccion: 'Metodología de cálculo de η',
  apartado: 'η = 0,455 — criterio de elegibilidad SPF > 1,15 × 1/η',
  url: 'https://www.boe.es/buscar/doc.php?id=DOUE-L-2013-80420',
  fechaConsulta: '2026-09-02',
};

/** Decisión 2013/114/UE: rendimiento medio estacional de referencia de generación eléctrica (UE). */
export const RENDIMIENTO_REFERENCIA_ELECTRICO_UE = 0.455;

/** Directiva (UE) 2018/2001, Anexo VII, punto 1: factor mínimo de mejora exigido sobre 1/η. */
export const FACTOR_MINIMO_ANEXO_VII = 1.15;

/**
 * SOLO INFORMATIVO / trazabilidad: umbral SPF derivado de 1,15 / η ≈ 2,5275. NO se usa en el
 * cálculo — el umbral operativo real es SCOP_DHW_MINIMO_ELECTRICA (=2,5), ya definido y citado
 * en dbhe4-anejo-f.constants.ts, porque es la cifra que CTE DB-HE4 declara textualmente (§3.1.4)
 * y es la que aplica en España. Se expone aquí solo para que la trazabilidad pueda mostrar de
 * dónde sale ese 2,5 a nivel UE.
 */
export const UMBRAL_SPF_DERIVADO_UE = FACTOR_MINIMO_ANEXO_VII / RENDIMIENTO_REFERENCIA_ELECTRICO_UE;

/**
 * Qué documentos de legalización exige cada tipo de instalación — RITE (RD 1027/2007) y,
 * si hay equipos frigoríficos, RSIF (RD 552/2019). Sección 21.4-21.6 del encargo, corregida
 * varias veces tras contrastar con el usuario (instalador real, no solo lectura de los PDF):
 * - MOD-316 descartado: es para potencia >70kW con proyecto de técnico colegiado, no aplica
 *   a instalaciones residenciales de aerotermia (confirmado leyendo el documento oficial).
 * - Autorización, Declaración Responsable, MOD-315 y MOD-318 son SIEMPRE obligatorios
 *   (2026-09-04, confirmado explícitamente por el usuario) — la Declaración Responsable NO es
 *   una alternativa a MOD-315/318, van los cuatro aparte, para toda instalación. La Declaración
 *   Responsable sigue afirmando en su texto "es menor de 70 Kw y su existencia es anterior a la
 *   entrada en vigor del RD 1027/2007" (frase que el usuario pidió explícitamente NO quitar),
 *   pero su generación ya no se restringe a `esAnteriorRd1027_2007===true` — el usuario indicó
 *   textualmente "no tengas en cuenta la potencia del equipo", es decir: se rellena siempre,
 *   sin comprobar si esa frase concreta es cierta para la instalación real. Por eso el campo
 *   `Expediente.esAnteriorRd1027_2007` ya no participa en absoluto en esta función (se deja en
 *   la entidad por si el usuario quiere seguir registrando el dato, pero no condiciona nada).
 * - Certificado RSIF e IF-190 dependen del cálculo automático de carga de refrigerante
 *   (Módulo de legalización de refrigerante, `ChequeoLegalizacionRefrigerante`), NO de un
 *   campo marcado a mano — el usuario pidió explícitamente eliminar el marcado manual
 *   "¿tiene frigoríficas?" que existía antes en el Expediente, ya que duplicaba (y podía
 *   contradecir) el cálculo real por máquina.
 */

export enum TipoDocumentoLegalizacion {
  AUTORIZACION = 'AUTORIZACION',
  DECLARACION_RESPONSABLE = 'DECLARACION_RESPONSABLE',
  MOD_315 = 'MOD_315',
  MOD_318 = 'MOD_318',
  CERTIFICADO_RSIF = 'CERTIFICADO_RSIF',
  IF_190 = 'IF_190',
}

export interface ClasificacionInstalacion {
  /**
   * Resultado YA CALCULADO por máquina (Seleccion.resultados[i].legalizacion.requiereMemoriaTecnica),
   * no un campo marcado a mano. true = supera el umbral RSIF de esa máquina. false = confirmado
   * por debajo del umbral. null = no verificable (refrigerante sin umbral conocido, o máquina sin
   * evaluar todavía) — se trata igual que "sí" (no se omite en silencio un documento que podría
   * hacer falta solo porque el dato de origen falta).
   */
  requiereMemoriaTecnicaFrigorifica: boolean | null;
}

export function documentosRequeridos(c: ClasificacionInstalacion): TipoDocumentoLegalizacion[] {
  const docs: TipoDocumentoLegalizacion[] = [
    TipoDocumentoLegalizacion.AUTORIZACION,
    TipoDocumentoLegalizacion.DECLARACION_RESPONSABLE,
    TipoDocumentoLegalizacion.MOD_315,
    TipoDocumentoLegalizacion.MOD_318,
  ];

  if (c.requiereMemoriaTecnicaFrigorifica !== false) {
    docs.push(TipoDocumentoLegalizacion.CERTIFICADO_RSIF, TipoDocumentoLegalizacion.IF_190);
  }

  return docs;
}

/**
 * Ámbito de potencia del MOD-315: su cabecera declara «IGUAL A 5kW Y MENOR_RB», es decir de 5 a
 * 70 kW. Por encima de 70 kW la instalación va con PROYECTO de técnico titulado (MOD-316, que esta
 * app no emite) y por debajo de 5 kW queda fuera del ámbito de este formulario — en los dos casos
 * el instalador fue claro (29-sep-2026): «no se emiten» los documentos, no se emite un certificado
 * fuera de ámbito.
 */
export const POTENCIA_MINIMA_MOD_315_KW = 5;
export const POTENCIA_MAXIMA_MOD_315_KW = 70;

export type AmbitoPotencia = 'DENTRO' | 'POR_DEBAJO' | 'POR_ENCIMA' | 'SIN_DATO';

export function ambitoPotenciaMod315(potenciaKW: number | null | undefined): AmbitoPotencia {
  if (potenciaKW === null || potenciaKW === undefined || Number.isNaN(potenciaKW)) return 'SIN_DATO';
  if (potenciaKW < POTENCIA_MINIMA_MOD_315_KW) return 'POR_DEBAJO';
  if (potenciaKW > POTENCIA_MAXIMA_MOD_315_KW) return 'POR_ENCIMA';
  return 'DENTRO';
}

/**
 * Datos fijos de HomeServe que van en TODOS los documentos oficiales.
 *
 * Estaban dentro del mapeo del MOD-315 y el resto de documentos no los tenía (de ahí que en el
 * IF-190 los puntos 4, 5, 6 y 7 llevaran la dirección larga metida entera en «Nombre vía» y el
 * Tipo de vía, el Nº y el Bloque en blanco). Ahora viven aquí y los usan los tres formularios.
 *
 * Dictado del instalador, 2-oct-2026:
 *   «En el 315, en los puntos 5 y 7, quiero que pongas la dirección de forma idéntica a la del punto
 *    4: Tipo de vía: Paseo; Nombre vía: del Club Deportivo; Nº: 1; Bloque: Edif 12. En el IF-190
 *    aplícalo también para el 4, 5 y 7. En el certificado RSIF, en la dirección empresa frigorista,
 *    deja solo: Paseo del Club Deportivo 1, Edif 12».
 */

/** Dirección del contacto de tramitación, desglosada (la del punto 4 del MOD-315). */
export const CONTACTO_TRAMITACION = {
  email: 'soportetecnico@homeservesolar.es',
  /** Teléfono fijo del contacto de tramitación (bloque 4, «Teléfono Fijo») — instalador, 30-sep-2026. */
  telefonoFijo: '911774635',
  tipoVia: 'Paseo',
  nombreVia: 'del Club Deportivo',
  numero: '1',
  bloque: 'Edif. 12',
  localidad: 'Pozuelo de Alarcón',
  provincia: 'Madrid',
  codigoPostal: '28223',
} as const;

/**
 * La misma dirección en UNA sola línea, que es como la pide el certificado RSIF para la empresa
 * frigorista (instalador, 2-oct-2026). No lleva el «Calle Parque Empresarial La Finca» que el CRM
 * guarda como dirección completa de la empresa.
 */
export const DIRECCION_EMPRESA_UNA_LINEA = 'Paseo del Club Deportivo 1, Edif. 12';

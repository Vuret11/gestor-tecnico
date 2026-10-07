/**
 * Un campo de un formulario AcroForm oficial, mapeado a cómo se obtiene su valor a partir de
 * los datos de la app. `campoPdf` es el nombre LITERAL del campo en la plantilla — no siempre
 * describe lo que contiene de verdad (un caso real de MOD-318 tenía un campo "TIPO DE CARNET"
 * que en realidad guardaba un DNI) — cada entrada se verifica visualmente contra un ejemplo
 * real antes de escribirse, nunca solo por el nombre.
 */
export type TipoCampoPdf = 'texto' | 'checkbox' | 'radio';

export interface CampoMapeado<TContexto> {
  campoPdf: string;
  tipo: TipoCampoPdf;
  /**
   * Para 'radio': debe devolver el VALOR DE EXPORTACIÓN exacto de la opción a seleccionar
   * (p.ej. "La instalación tiene Circuito Frigorífico Primario_Si_On"), no un booleano —
   * un grupo de radio botones tiene más de dos estados posibles, a diferencia de un checkbox.
   */
  obtener: (ctx: TContexto) => string | number | boolean | null | undefined;
}

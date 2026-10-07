/**
 * Fecha con la que se emite un documento de legalización, en dd/mm/aaaa.
 *
 * Es la MISMA fecha en todos los documentos y en todas las casillas de fecha de un mismo
 * impreso (firmas de la hoja «14.- Firmas» del MOD-315, pruebas IT 3.1.8 del MOD-318…): la del
 * día en que se genera el PDF. Vive en un único sitio a propósito, para que el MOD-315 y el
 * MOD-318 no puedan divergir en el formato ni en el día.
 */
export function fechaDocumento(): string {
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${hoy.getFullYear()}`;
}

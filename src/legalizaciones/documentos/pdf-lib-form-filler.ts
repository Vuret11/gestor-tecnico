import { PDFDocument } from 'pdf-lib';
import { CampoMapeado } from './mapeos/mapeo.types';

/**
 * Número tal y como se escribe en un impreso español: coma decimal («5,38» en vez de «5.38»).
 *
 * Se aplica en el rellenador, que es el único sitio por el que pasan los cuatro PDF, para que no
 * haya documentos con los rendimientos con punto y las presiones con coma (que es como estaban
 * hasta ahora: los números salían con el punto de JavaScript). NO se ponen separadores de millar
 * («15000» sigue siendo «15000»): el impreso no los pide y un punto de millar se confundiría con un
 * decimal. Los valores que ya vienen como texto se dejan tal cual — si alguien escribió «4,5» o
 * «R290/R410A» es porque ya lo formateó a propósito.
 */
export function numeroEspanol(valor: number): string {
  // `toLocaleString` con locale español resuelve de una vez los tres casos: coma decimal, enteros
  // sin decimales de relleno («15», no «15,00»), y los números que JavaScript imprime en notación
  // científica (1e-7 → «0,0000001»). `useGrouping: false` evita el punto de millar.
  const texto = valor.toLocaleString('es-ES', { useGrouping: false, maximumFractionDigits: 20 });

  // Un valor por debajo de 1e-20 se redondearía a «0»: se deja con su exponente antes que declarar
  // un cero en un documento. No pasa con ningún dato de estos impresos (el más pequeño es el CO₂
  // equivalente, del orden de 1e-4), pero el documento no puede decir «0» de algo que no es cero.
  if (valor !== 0 && Number(texto.replace(',', '.')) === 0) return String(valor).replace('.', ',');

  return texto;
}

/**
 * Rellena una plantilla AcroForm real con un mapeo de campos. Función pura, no un servicio
 * (mismo estilo que src/normativa/dbhe4.helpers.ts) — reutilizable por cualquier documento.
 * Un valor `null`/`undefined` en `obtener()` deja el campo tal cual (sin dato, no se fuerza
 * un valor vacío ni un "N/D" — el documento debe reflejar honestamente qué falta).
 */
export async function rellenarPlantilla<TContexto>(plantillaBytes: Buffer, mapeo: CampoMapeado<TContexto>[], ctx: TContexto): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(plantillaBytes);
  const form = pdfDoc.getForm();

  for (const campo of mapeo) {
    const valor = campo.obtener(ctx);
    if (valor === null || valor === undefined) continue;

    if (campo.tipo === 'texto') {
      form.getTextField(campo.campoPdf).setText(typeof valor === 'number' ? numeroEspanol(valor) : String(valor));
    } else if (campo.tipo === 'checkbox') {
      const casilla = form.getCheckBox(campo.campoPdf);
      if (valor) casilla.check();
      else casilla.uncheck();
    } else if (campo.tipo === 'radio') {
      form.getRadioGroup(campo.campoPdf).select(String(valor));
    }
  }

  form.updateFieldAppearances();
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

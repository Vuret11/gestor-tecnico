/**
 * Autorización para presentar la documentación (genera con pdfkit, sin plantilla oficial).
 *
 * Traído del CRM (`autorizacion.service.ts`) y convertido en función pura: en la Pi el trámite
 * vive en la tabla `legalizaciones`, así que el contexto (expediente + apoderado) lo arma el
 * generador. La lógica y los textos son los del CRM, sin cambios.
 */
import { BadRequestException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Expediente, Persona } from './crm/tipos';

export function generarAutorizacion(expediente: Expediente, apoderado: Persona): Promise<Buffer> {
  if (!expediente.datosCliente) {
    throw new BadRequestException(`El trámite ${expediente.id} no tiene datos de cliente — completarlos antes de generar la Autorización`);
  }
  if (!expediente.datosOca) {
    throw new BadRequestException(`El trámite ${expediente.id} no tiene OCA asignada — completarla antes de generar la Autorización`);
  }
  const cliente = expediente.datosCliente;
  const oca = expediente.datosOca;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(15).font('Helvetica-Bold').text('AUTORIZACIÓN A PRESENTAR DOCUMENTACIÓN PARA INSTALACIÓN TÉRMICA', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).font('Helvetica');
    // La dirección que se cita es la de la INSTALACIÓN (datosObra.direccion si el expediente
    // la trae; si no, la del cliente). La OCA no tiene dirección en el modelo
    // (DatosOcaExpediente = nombre + cif), así que NUNCA se le atribuye esta dirección:
    // antes la carta decía «ante OCA Global sita en <calle del cliente>».
    const obra = (expediente.datosObra ?? {}) as Record<string, unknown>;
    const textoOValor = (v: unknown, alt: string) => (typeof v === 'string' && v.trim() ? v : alt);
    const direccionInstalacion = [
      textoOValor(obra['direccion'], cliente.direccion),
      textoOValor(obra['municipio'], cliente.municipio),
      textoOValor(obra['codigoPostal'], cliente.codigoPostal),
      textoOValor(obra['provincia'], cliente.provincia),
    ].join(', ');
    doc.text(
      `Yo, ${cliente.nombreRazonSocial}, con DNI ${cliente.dniCif}, autorizo a ${apoderado.nombre} con DNI ${apoderado.dni}, ` +
        `a presentar la documentación necesaria para la legalización de la instalación térmica (RITE) sita en ` +
        `${direccionInstalacion}, ante ${oca.nombre}`,
      { width: 475 },
    );
    doc.moveDown(2);

    doc.text(`Firmado en Madrid a ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    doc.moveDown(3);
    doc.text(`Fdo ${cliente.nombreRazonSocial}`);

    doc.end();
  });
}

/**
 * Declaración responsable (genera con pdfkit, sin plantilla oficial).
 *
 * Traído del CRM (`declaracion-responsable.service.ts`) y convertido en función pura: el contexto
 * lo arma el generador desde la fila del trámite. Textos idénticos a los del CRM.
 */
import { BadRequestException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Expediente } from './crm/tipos';

export function generarDeclaracionResponsable(expediente: Expediente): Promise<Buffer> {
  if (!expediente.datosCliente) {
    throw new BadRequestException(`El trámite ${expediente.id} no tiene datos de cliente — completarlos antes de generar la Declaración Responsable`);
  }
  const cliente = expediente.datosCliente;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(60, 60, 475, 26).stroke();
    doc.fontSize(13).font('Helvetica-Bold').text('DECLARACIÓN RESPONSABLE', 60, 68, { width: 475, align: 'center' });
    doc.y = 110;

    doc.fontSize(11).font('Helvetica');
    doc.text(`El abajo firmante, D. ${cliente.nombreRazonSocial}, con NIF, ${cliente.dniCif}, que`);
    doc.moveDown(0.5);
    doc.text('ACTÚA: En nombre propio');
    doc.moveDown(1.5);

    doc.text('Y DECLARA:');
    doc.moveDown(0.5);
    doc.text(
      `Que la instalación sita en la calle, ${cliente.direccion}, ${cliente.municipio}, ${cliente.codigoPostal}, ${cliente.provincia} ` +
        `es menor de 70 Kw y su existencia es anterior a la entrada en vigor del RD 1027/2007 de 20 de julio.`,
      { width: 475 },
    );
    doc.moveDown(2);

    doc.text(`En Madrid a ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    doc.moveDown(3);
    doc.text(`Fdo ${cliente.nombreRazonSocial}`);

    doc.end();
  });
}

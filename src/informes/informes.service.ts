import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { v2 as cloudinary } from 'cloudinary';
import { buildCsv, formatDate } from '../common/utils/csv.util';
import { Informe } from './entities/informe.entity';
import { CreateInformeDto } from './dto/create-informe.dto';

const TIPO_LABELS: Record<string, string> = {
  visita_tecnica_fv: 'Visita Técnica FV',
  visita_tecnica_aerotermia: 'Visita Técnica Aerotermia',
  instalacion_nueva_fv: 'Instalación Nueva FV',
  instalacion_nueva_aerotermia: 'Instalación Nueva Aerotermia',
};

@Injectable()
export class InformesService {
  constructor(
    @InjectRepository(Informe) private repo: Repository<Informe>,
  ) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }

  async create(dto: CreateInformeDto): Promise<Informe> {
    const existe = await this.repo.findOne({ where: { visita_id: dto.visita_id } });
    if (existe) {
      Object.assign(existe, dto);
      return this.repo.save(existe);
    }
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<Informe[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Informe> {
    const informe = await this.repo.findOne({ where: { id } });
    if (!informe) throw new NotFoundException(`Informe ${id} no encontrado`);
    return informe;
  }

  async findByVisita(visita_id: string): Promise<Informe | null> {
    return this.repo.findOne({ where: { visita_id } });
  }

  async update(id: string, dto: Partial<CreateInformeDto>): Promise<Informe> {
    const informe = await this.findOne(id);
    Object.assign(informe, dto);
    return this.repo.save(informe);
  }

  async exportCsv(): Promise<string> {
    const informes = await this.repo.find({
      relations: { visita: { instalacion: true, tecnico: true } },
      order: { createdAt: 'DESC' },
    });

    const rows = informes.map(inf => ({
      id: inf.id,
      fecha_visita: formatDate(inf.visita?.fechaProgramada),
      tecnico: inf.visita?.tecnico?.nombre ?? '',
      instalacion: inf.visita?.instalacion?.nombre ?? '',
      cliente: inf.visita?.instalacion?.cliente ?? inf.visita?.instalacion?.clienteData?.nombre ?? '',
      descripcion: inf.descripcion ?? '',
      trabajos: inf.trabajosRealizados ?? '',
      materiales: inf.materialesUsados ?? '',
      tiempo_min: inf.tiempoEmpleado ?? '',
      firmante: inf.nombreFirmante ?? '',
      tiene_pdf: inf.pdfUrl ? 'Sí' : 'No',
      creado: formatDate(inf.createdAt),
    }));

    return buildCsv(rows, [
      { key: 'id',          label: 'ID' },
      { key: 'fecha_visita', label: 'Fecha Visita' },
      { key: 'tecnico',     label: 'Técnico' },
      { key: 'instalacion', label: 'Instalación' },
      { key: 'cliente',     label: 'Cliente' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'trabajos',    label: 'Trabajos Realizados' },
      { key: 'materiales',  label: 'Materiales' },
      { key: 'tiempo_min',  label: 'Tiempo (min)' },
      { key: 'firmante',    label: 'Firmante' },
      { key: 'tiene_pdf',   label: 'PDF Generado' },
      { key: 'creado',      label: 'Fecha Creación' },
    ]);
  }

  async generatePdf(id: string): Promise<Informe> {
    const informe = await this.repo.findOne({
      where: { id },
      relations: { visita: { instalacion: true, tecnico: true } },
    });
    if (!informe) throw new NotFoundException(`Informe ${id} no encontrado`);

    const buffer = await this.buildPdfBuffer(informe);
    const pdfUrl = await this.uploadPdf(buffer, id);

    informe.pdfUrl = pdfUrl;
    return this.repo.save(informe);
  }

  private buildPdfBuffer(informe: Informe): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { visita } = informe;
      const instalacion = visita?.instalacion;
      const tecnico = visita?.tecnico;

      const fmt = (d: Date | string | null | undefined) =>
        d ? new Date(d).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '—';

      const lineY = () =>
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke().moveDown(0.5);

      const section = (title: string) => {
        doc.moveDown(0.5);
        lineY();
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text(title.toUpperCase());
        doc.font('Helvetica').fontSize(10).fillColor('#333333').moveDown(0.3);
      };

      const row = (label: string, value: string | number | null | undefined) =>
        doc.text(`${label}: ${value ?? '—'}`);

      // ── Cabecera ──────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a1a1a')
        .text('INFORME DE VISITA TÉCNICA', { align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor('#666666')
        .text(`Ref: ${informe.id.substring(0, 8).toUpperCase()}  ·  Emitido: ${fmt(new Date())}`, { align: 'center' });

      // ── Visita ────────────────────────────────────────────────────
      section('Datos de la visita');
      row('Fecha programada', fmt(visita?.fechaProgramada));
      row('Tipo', TIPO_LABELS[visita?.tipo ?? ''] ?? visita?.tipo ?? '—');
      row('Estado', visita?.estado ?? '—');
      if (visita?.fechaInicio) row('Inicio real', fmt(visita.fechaInicio));
      if (visita?.fechaFin)    row('Fin real',   fmt(visita.fechaFin));

      // ── Técnico ───────────────────────────────────────────────────
      section('Técnico asignado');
      row('Nombre',   tecnico?.nombre);
      row('Email',    tecnico?.email);
      row('Teléfono', tecnico?.telefono);

      // ── Instalación ───────────────────────────────────────────────
      section('Instalación');
      row('Nombre',    instalacion?.nombre);
      row('Dirección', instalacion ? `${instalacion.direccion}, ${instalacion.ciudad}` : '—');
      if (instalacion?.provincia) row('Provincia', instalacion.provincia);
      row('Cliente', instalacion?.cliente ?? instalacion?.clienteData?.nombre);

      // ── Descripción del trabajo ───────────────────────────────────
      section('Descripción del trabajo');
      doc.text(informe.descripcion ?? '—', { lineGap: 3 });

      if (informe.trabajosRealizados) {
        section('Trabajos realizados');
        doc.text(informe.trabajosRealizados, { lineGap: 3 });
      }

      if (informe.materialesUsados) {
        section('Materiales utilizados');
        doc.text(informe.materialesUsados, { lineGap: 3 });
      }

      if (informe.tiempoEmpleado) {
        section('Tiempo empleado');
        const h = Math.floor(informe.tiempoEmpleado / 60);
        const m = informe.tiempoEmpleado % 60;
        doc.text(h > 0 ? `${h}h ${m}min` : `${m} minutos`);
      }

      if (visita?.notas) {
        section('Notas adicionales');
        doc.text(visita.notas, { lineGap: 3 });
      }

      // ── Firma ─────────────────────────────────────────────────────
      section('Conformidad del cliente');
      if (informe.nombreFirmante) row('Firmante', informe.nombreFirmante);

      if (informe.firmaClienteUrl?.startsWith('data:image/png;base64,') ||
          informe.firmaClienteUrl?.startsWith('data:image/jpeg;base64,')) {
        const imgBuffer = Buffer.from(informe.firmaClienteUrl.split(',')[1], 'base64');
        doc.moveDown(0.5).image(imgBuffer, { width: 200, height: 80 });
      } else if (informe.firmaClienteUrl) {
        doc.moveDown(0.3).font('Helvetica-Oblique').fontSize(9).fillColor('#555555')
          .text('✓ Firma digital recibida');
      } else {
        doc.moveDown(0.3).font('Helvetica-Oblique').fontSize(9).fillColor('#aaaaaa')
          .text('Sin firma del cliente');
      }

      // ── Footer ────────────────────────────────────────────────────
      doc.moveDown(2);
      lineY();
      doc.font('Helvetica').fontSize(8).fillColor('#999999')
        .text('Documento generado automáticamente por el sistema de gestión técnica.', { align: 'center' });

      doc.end();
    });
  }

  private async uploadPdf(buffer: Buffer, informeId: string): Promise<string> {
    const filename = `informe-${informeId}.pdf`;

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'gestor-tecnico/pdfs', resource_type: 'raw', public_id: filename },
          (err, res) => {
            if (err || !res) reject(err ?? new Error('Cloudinary upload failed'));
            else resolve(res.secure_url);
          },
        );
        stream.end(buffer);
      });
    }

    const dir = join(process.cwd(), 'uploads', 'pdfs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    return `/uploads/pdfs/${filename}`;
  }
}

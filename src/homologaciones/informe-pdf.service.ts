import { BadRequestException, Injectable, Logger } from '@nestjs/common';

// pdfkit es CommonJS: se carga con require para no pelearse con los tipos.
const PDFDocument: any = require('pdfkit');

/**
 * Los informes del apartado en PDF: «mediciones vs planos» y «cumplimiento normativo» (o los dos
 * en un solo documento). Se generan EN LA API a partir del análisis guardado (`resultados`) y se
 * devuelven en memoria: no se escriben en disco. El panel los pide y los descarga.
 *
 * Van con el sello BORRADOR bien visible a propósito: el documento bueno es el que revisa y firma
 * el técnico. Aquí lo que se entrega es el borrador que hay que comprobar, con cada punto dudoso
 * dicho y con su artículo de normativa.
 */

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 42;
const ANCHO_UTIL = A4.ancho - 2 * MARGEN;
const TINTA = '#1A1A1A';

/** Un trozo de la tabla: una fila de columnas o una nota a todo el ancho debajo de una fila. */
type Fila = { celdas?: string[]; nota?: string };

@Injectable()
export class InformePdfService {
  private readonly log = new Logger('InformePDF');

  /** Genera el PDF pedido: 'mediciones', 'cumplimiento' o 'completo'. */
  async genera(h: any, tipo: string): Promise<{ buffer: Buffer; nombre: string }> {
    const r = h?.resultados;
    if (!r?.instalaciones?.length) {
      throw new BadRequestException('Todavía no hay análisis: lanza primero «Analizar documentación».');
    }
    const cual = ['mediciones', 'cumplimiento', 'completo'].includes(tipo) ? tipo : 'completo';

    const trozos: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGEN, bottom: 54, left: MARGEN, right: MARGEN },
      bufferPages: true,
      info: { Title: `${this.tituloDe(cual)} · ${this.obraDe(h)}`, Author: 'HomeServe Solar · Departamento de Ingeniería' },
    });
    doc.on('data', (t: Buffer) => trozos.push(t));
    const terminado = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(trozos))));

    this.portada(doc, h, r, cual);
    for (const b of r.instalaciones ?? []) {
      if (cual !== 'cumplimiento') this.bloqueMediciones(doc, b);
      if (cual !== 'mediciones') this.bloqueCumplimiento(doc, b);
    }
    this.cierre(doc, h, r);
    this.pies(doc);
    doc.end();

    const buffer = await terminado;
    const etiqueta = cual === 'mediciones' ? 'Mediciones_vs_planos'
      : cual === 'cumplimiento' ? 'Cumplimiento_normativo' : 'Informe_homologacion';
    this.log.log(`Informe ${cual} de ${h.id}: ${(buffer.length / 1024).toFixed(0)} KB`);
    return { buffer, nombre: `${etiqueta}_${this.slug(this.obraDe(h))}.pdf` };
  }

  // ─── Portada ─────────────────────────────────────────────────────────────────────────────

  private portada(doc: any, h: any, r: any, cual: string) {
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#0B4D3B').text('HOMESERVE SOLAR', MARGEN, MARGEN + 4);
    doc.font('Helvetica').fontSize(8).fillColor('#555555')
      .text('Departamento de Ingeniería · Homologaciones', MARGEN, MARGEN + 24);
    doc.moveTo(MARGEN, MARGEN + 38).lineTo(A4.ancho - MARGEN, MARGEN + 38).lineWidth(1.2).strokeColor('#0B4D3B').stroke();

    doc.y = MARGEN + 58;
    doc.font('Helvetica-Bold').fontSize(19).fillColor(TINTA).text(this.tituloDe(cual).toUpperCase());
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(12).fillColor('#333333').text(`Obra: ${this.obraDe(h)}`);

    // Sello: es lo primero que tiene que leer quien abra el documento.
    doc.moveDown(0.7);
    const y = doc.y;
    doc.roundedRect(MARGEN, y, ANCHO_UTIL, 26, 3).fillAndStroke('#FFF4E0', '#E0A800');
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#8A5A00')
      .text('BORRADOR · PENDIENTE DE REVISIÓN TÉCNICA', MARGEN + 8, y + 8, { width: ANCHO_UTIL - 16 });
    doc.y = y + 36;

    this.seccion(doc, 'Datos del expediente');
    const datos: [string, string][] = [
      ['Obra', this.obraDe(h)],
      ['Cliente / titular', this.txt(h.cliente)],
      ['Nº de obra', this.txt(h.num_obra)],
      ['Emplazamiento', [h.direccion, h.cp, h.municipio, h.provincia].filter(Boolean).join(' · ') || '—'],
      ['Instalaciones de la obra', (h.instalaciones ?? []).map((i: string) => this.INSTALACION[i] ?? i).join(' · ') || '—'],
      ['Responsable', this.txt(h.responsable)],
      ['Estado del expediente', this.txt(h.estado)],
      ['Análisis generado', this.fecha(r.generado ?? h.analizado_en)],
    ];
    for (const [etiqueta, valor] of datos) {
      this.espacio(doc, 14);
      const fila = doc.y;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#555555').text(etiqueta, MARGEN, fila, { width: 118 });
      doc.font('Helvetica').fontSize(8.5).fillColor(TINTA).text(valor, MARGEN + 122, fila, { width: ANCHO_UTIL - 122 });
      doc.y = Math.max(doc.y, fila + 12);
    }

    this.seccion(doc, 'Documentación analizada');
    const docs = r.documentos ?? [];
    if (!docs.length) this.parrafo(doc, 'No hay documentación asociada al análisis.');
    for (const d of docs) {
      this.bullet(doc, `${d.nombre} · ${this.tipoArchivo(d.nombre)}${d.bytes ? ` · ${(d.bytes / 1024 / 1024).toFixed(1)} MB` : ''}${d.subido ? ` · subido el ${this.fecha(d.subido, true)}` : ''}`);
    }
    if (r.hojas_de_plano) this.parrafo(doc, `Hojas de plano leídas: ${r.hojas_de_plano}.`, { menor: true });

    this.seccion(doc, 'Resumen del análisis');
    const t = r.totales ?? {};
    this.parrafo(doc, `${this.num(t.partidas)} partidas del presupuesto · ${this.euros(t.importe)}.`);
    this.parrafo(doc, `${this.num(t.localizadas)} partidas localizadas en los planos · ${this.num(t.a_verificar)} partidas a verificar por el técnico.`);
    for (const b of r.instalaciones ?? []) {
      const m = b.mediciones?.totales ?? {};
      this.bullet(doc, `${this.INSTALACION[b.tipo] ?? b.tipo}: ${this.num(m.partidas)} partidas · ${this.euros(m.importe)} · ${this.num(m.localizadas)} en plano · ${this.num(m.a_verificar)} a verificar`);
    }
    if (cual !== 'cumplimiento') {
      this.parrafo(doc, 'Ojo: este PDF no trae cuadro de mediciones. Las cantidades son las del presupuesto, no las medidas sobre el plano: para contrastar cantidades hacen falta las mediciones o los DWG.', { nota: true });
    }

    const avisos: string[] = r.avisos ?? [];
    if (avisos.length) {
      this.seccion(doc, 'Avisos del análisis');
      for (const a of avisos) this.bullet(doc, a, { nota: true });
    }
  }

  // ─── Bloque de mediciones ────────────────────────────────────────────────────────────────

  private bloqueMediciones(doc: any, b: any) {
    const m = b.mediciones ?? {};
    const tot = m.totales ?? {};
    this.tituloBloque(doc, b);
    this.parrafo(doc, `${this.num(tot.partidas)} partidas · ${this.euros(tot.importe)} · ${this.num(tot.localizadas)} citadas en el plano · ${this.num(tot.a_verificar)} a verificar (${this.euros(tot.importe_a_verificar)})`, { negrita: true });
    const delPresupuesto = (m.partidas ?? []).filter((p: any) => p.verificacion?.alcance).length;
    if (delPresupuesto) {
      this.parrafo(doc, `${delPresupuesto} partidas vienen ya marcadas en el propio presupuesto (no ofertadas o con cambio de marca): van señaladas abajo una por una.`, { nota: true });
    }

    const cols = [
      { titulo: 'Código', ancho: 52 },
      { titulo: 'Ud', ancho: 20 },
      { titulo: 'Cant.', ancho: 40 },
      { titulo: 'Partida', ancho: 182 },
      { titulo: 'Importe', ancho: 58 },
      { titulo: 'En el plano', ancho: ANCHO_UTIL - 352 },
    ];
    const filas: Fila[] = [];
    for (const p of m.partidas ?? []) {
      const localizada = p.estado === 'localizada';
      filas.push({
        celdas: [
          this.txt(p.codigo),
          this.txt(p.unidad),
          this.num(p.cantidad),
          this.txt(p.resumen),
          this.euros(p.importe),
          localizada ? `hoja ${(p.hojas ?? []).slice(0, 4).join(', ')}` : 'a verificar',
        ],
      });
      // El aviso va debajo de la partida si no se localiza o si el presupuesto la marca con «***»
      // (no ofertada / otra marca): esas hay que aclararlas aunque el plano las nombre.
      if (p.verificacion && (!localizada || p.verificacion.alcance)) {
        filas.push({ nota: `Qué mirar: ${p.verificacion.requisito} · Punto de normativa: ${p.verificacion.norma} · Dónde: ${p.verificacion.donde}` });
      }
    }
    this.tabla(doc, cols, filas);
    this.parrafo(doc, `Total ${this.INSTALACION[b.tipo] ?? b.tipo}: ${this.num(tot.partidas)} partidas · ${this.euros(tot.importe)}.`, { negrita: true });
    if (m.aviso) this.parrafo(doc, m.aviso, { nota: true });
  }

  // ─── Bloque de cumplimiento ──────────────────────────────────────────────────────────────

  private bloqueCumplimiento(doc: any, b: any) {
    const c = b.cumplimiento ?? {};
    this.tituloBloque(doc, b);

    const normativa: any[] = b.normativa ?? [];
    if (normativa.length) {
      this.parrafo(doc, 'Normativa que se comprueba', { negrita: true });
      for (const n of normativa) this.bullet(doc, `${n.norma}${n.referencia ? ` · ${n.referencia}` : ''} — ${n.nota}`);
    }

    const comps: any[] = c.comprobaciones ?? [];

    // El veredicto: lo que NO cumple va primero, en rojo y con el artículo que lo dice.
    const ver: any[] = c.verificaciones ?? [];
    const incumple = ver.filter((v) => v.estado === 'no_cumple');
    const resto = ver.filter((v) => v.estado !== 'no_cumple');
    if (ver.length) {
      const res = c.resumen ?? {
        verificadas: ver.length,
        cumple: ver.filter((v) => v.estado === 'cumple').length,
        no_cumple: incumple.length,
        sin_datos: ver.filter((v) => v.estado === 'sin_datos').length,
      };
      this.parrafo(doc, `Resultado de la comprobación: ${res.verificadas} puntos contrastados con el artículo de la normativa · `
        + `${res.cumple} cumplen · ${res.no_cumple} NO CUMPLEN · ${res.sin_datos} sin datos en la documentación para poder comprobarlos.`,
      { negrita: true, rojo: res.no_cumple > 0 });
    }
    if (incumple.length) {
      this.parrafo(doc, `NO CUMPLE — hay que corregirlo o justificarlo (${incumple.length})`, { negrita: true, rojo: true });
      for (const v of incumple) {
        this.parrafo(doc, `• ${v.que}`, { negrita: true, rojo: true });
        this.parrafo(doc, `${v.detalle} Lo dice: ${v.articulo} — ${v.fuente}.`, { menor: true, rojo: true });
        this.parrafo(doc, `Tal como está en la documentación: ${v.evidencia}`, { menor: true, rojo: true });
      }
    }
    if (resto.length) {
      this.parrafo(doc, 'Comprobado uno por uno', { negrita: true });
      for (const v of resto) {
        this.bullet(doc, `[${v.estado === 'cumple' ? 'CUMPLE' : 'SIN DATOS'}] ${v.que} · ${v.articulo} — ${v.detalle} ${v.evidencia}`, { nota: v.estado !== 'cumple' });
      }
    }

    this.parrafo(doc, 'Búsqueda por marca y modelo en la documentación', { negrita: true });
    if (!comps.length) this.parrafo(doc, 'Sin comprobaciones para este tipo de instalación.', { menor: true });
    for (const o of comps) {
      const marca = o.localizada ? 'Sí' : 'No encontrado';
      const hojas = (o.paginas ?? []).length ? ` · hoja${o.paginas.length > 1 ? 's' : ''} ${o.paginas.slice(0, 6).join(', ')}` : '';
      this.bullet(doc, `[${marca}] ${o.que}${o.norma ? ` · ${o.norma}` : ''}${hojas}`, { nota: !o.localizada });
    }

    for (const [titulo, lista, nota] of [
      ['Dudas para el técnico (no son incumplimientos)', c.dudas, true],
      ['Sin datos en la documentación', c.observaciones, true],
    ] as [string, string[], boolean][]) {
      if (!lista?.length) continue;
      this.parrafo(doc, titulo, { negrita: true });
      for (const d of lista) this.bullet(doc, d, { nota });
    }
    if (c.aviso) this.parrafo(doc, c.aviso, { nota: true });
  }

  // ─── Cierre ──────────────────────────────────────────────────────────────────────────────

  private cierre(doc: any, h: any, r: any) {
    this.espacio(doc, 150);
    this.seccion(doc, 'Cómo se ha hecho y qué queda por comprobar');
    this.parrafo(doc, 'Cómo se ha comprobado el cumplimiento', { negrita: true });
    for (const l of [
      'Cada punto se contrasta con el mínimo o el límite que fija el artículo que se cita al lado (ITC-BT del REBT, DB-HS4 y DB-HS5, DB-SI 4, RITE, RIPCI e ICT). Los valores están tomados del texto oficial publicado (BOE, CTE y guías técnicas del ministerio): no se ponen de memoria.',
      'El veredicto es uno de estos tres: CUMPLE (el dato de la documentación respeta el mínimo), NO CUMPLE (está por debajo o no procede, y se dice en rojo con el artículo que lo exige) o SIN DATOS (el dato no aparece en lo entregado, así que no se dictamina y se dice qué falta por saber).',
      'Las cuentas que se ven en el informe (caída de tensión, por ejemplo) se pueden repetir a mano: la fórmula y los datos usados van escritos en cada línea.',
    ]) this.bullet(doc, l);

    this.parrafo(doc, 'Cómo se ha cruzado el presupuesto con los planos', { negrita: true });
    for (const l of [
      'El análisis cruza el presupuesto del Excel (partidas, cantidades e importes) con el texto de los planos en PDF, y reparte cada partida por el capítulo del presupuesto al que pertenece (una respuesta por tipo de instalación).',
      'Una partida «localizada» quiere decir que su marca, modelo, sección o tipo de cable aparece en el texto del plano (se dice en qué hoja). No es un juicio sobre lo bien o mal proyectado que esté.',
      'Las partidas «a verificar» NO son incumplimientos: son puntos que el buscador no ha encontrado (suele ser porque el plano lo escribe de otra forma o porque el dato está en la memoria) y que el técnico tiene que comprobar. Cada una dice qué mirar, con qué punto de normativa y dónde.',
      'Las cantidades son las del presupuesto: para contrastarlas con el plano hacen falta el cuadro de mediciones o los DWG. Sin ellos, este informe no da cantidad medida, pero sí las desviaciones que se pueden ver con lo entregado (importes que no cuadran, metros del unifilar que no coinciden, unidades mal puestas).',
    ]) this.bullet(doc, l);

    this.parrafo(doc, `Documento generado automáticamente por el gestor técnico de HomeServe Solar el ${this.fecha(new Date())} a partir de la documentación subida al expediente. Es un BORRADOR de trabajo: no sustituye al informe revisado y firmado por el técnico competente.`, { nota: true });
  }

  // ─── Herramientas de maquetación ─────────────────────────────────────────────────────────

  private seccion(doc: any, titulo: string) {
    this.espacio(doc, 34);
    doc.moveDown(0.5);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0B4D3B').text(titulo.toUpperCase(), MARGEN, y, { width: ANCHO_UTIL });
    doc.moveTo(MARGEN, doc.y + 1).lineTo(A4.ancho - MARGEN, doc.y + 1).lineWidth(0.5).strokeColor('#BBBBBB').stroke();
    doc.y += 6;
  }

  private tituloBloque(doc: any, b: any) {
    this.espacio(doc, 44);
    doc.moveDown(0.4);
    const nombre = (this.INSTALACION[b.tipo] ?? b.tipo).toUpperCase();
    const y = doc.y;
    doc.rect(MARGEN, y, ANCHO_UTIL, 15).fill('#F1EFE9');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(TINTA).text(nombre, MARGEN + 5, y + 3, { width: ANCHO_UTIL - 10 });
    doc.y = y + 19;
    if (b.resumen) this.parrafo(doc, b.resumen, { menor: true });
  }

  private parrafo(doc: any, texto: string, o: { negrita?: boolean; menor?: boolean; nota?: boolean; rojo?: boolean } = {}) {
    const alto = doc.font(o.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.menor ? 8 : 8.5)
      .heightOfString(String(texto), { width: ANCHO_UTIL });
    this.espacio(doc, Math.min(alto, 60) + 4);
    doc.font(o.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.menor ? 8 : 8.5)
      .fillColor(o.rojo ? '#B91C1C' : o.nota ? '#8A5A00' : o.menor ? '#555555' : TINTA)
      .text(this.limpio(texto), MARGEN, doc.y, { width: ANCHO_UTIL });
    doc.moveDown(0.25);
  }

  private bullet(doc: any, texto: string, o: { menor?: boolean; nota?: boolean; rojo?: boolean } = {}) {
    const sangria = 10;
    doc.font('Helvetica').fontSize(8);
    const alto = doc.heightOfString(`• ${texto}`, { width: ANCHO_UTIL - sangria });
    this.espacio(doc, Math.min(alto, 60) + 3);
    doc.font('Helvetica').fontSize(8).fillColor(o.rojo ? '#B91C1C' : o.nota ? '#8A5A00' : TINTA)
      .text(this.limpio(`• ${texto}`), MARGEN + sangria, doc.y, { width: ANCHO_UTIL - sangria });
    doc.y += 1;
  }

  private tabla(doc: any, cols: { titulo: string; ancho: number }[], filas: Fila[]) {
    const cabecera = () => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#555555');
      let x = MARGEN;
      for (const c of cols) {
        doc.text(this.limpio(c.titulo).toUpperCase(), x + 1, y, { width: c.ancho - 2, lineBreak: false });
        x += c.ancho;
      }
      doc.moveTo(MARGEN, y + 9).lineTo(A4.ancho - MARGEN, y + 9).lineWidth(0.6).strokeColor('#999999').stroke();
      doc.y = y + 12;
    };
    cabecera();
    for (const f of filas) {
      if (f.nota) {
        doc.font('Helvetica-Oblique').fontSize(6.8);
        const alto = doc.heightOfString(f.nota, { width: ANCHO_UTIL - 14 }) + 3;
        this.espacio(doc, alto + 12, cabecera);
        const y = doc.y;
        doc.font('Helvetica-Oblique').fontSize(6.8).fillColor('#8A5A00').text(this.limpio(f.nota), MARGEN + 12, y, { width: ANCHO_UTIL - 14 });
        doc.y = y + alto;
        continue;
      }
      const celdas = f.celdas ?? [];
      doc.font('Helvetica').fontSize(7);
      const altos = celdas.map((t, i) => doc.heightOfString(String(t ?? ''), { width: (cols[i]?.ancho ?? 40) - 4 }));
      const alto = Math.max(...altos, 8) + 3;
      this.espacio(doc, alto + 12, cabecera);
      const y = doc.y;
      let x = MARGEN;
      celdas.forEach((t, i) => {
        const col = cols[i] ?? { ancho: 40 };
        doc.font('Helvetica').fontSize(7)
          .fillColor(t === 'a verificar' ? '#8A5A00' : TINTA)
          .text(this.limpio(t), x + 1, y + 1, { width: col.ancho - 4 });
        x += col.ancho;
      });
      doc.y = y + alto;
      doc.moveTo(MARGEN, doc.y - 1.5).lineTo(A4.ancho - MARGEN, doc.y - 1.5).lineWidth(0.25).strokeColor('#DDDDDD').stroke();
    }
    doc.moveDown(0.4);
  }

  /** Salta de página si lo que viene no cabe; repite la cabecera de la tabla si se pide. */
  private espacio(doc: any, alto: number, alSaltar?: () => void) {
    if (doc.y + alto <= A4.alto - 62) return;
    doc.addPage();
    doc.y = MARGEN;
    if (alSaltar) alSaltar();
  }

  private pies(doc: any) {
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      const y = A4.alto - 38;
      const antes = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // si no, pdfkit añade una página al escribir en el margen
      doc.moveTo(MARGEN, y - 7).lineTo(A4.ancho - MARGEN, y - 7).lineWidth(0.4).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#8A5A00')
        .text('BORRADOR · pendiente de revisión técnica', MARGEN, y, { width: ANCHO_UTIL / 2, lineBreak: false });
      doc.font('Helvetica').fontSize(6.8).fillColor('#666666')
        .text(`HomeServe Solar · Ingeniería · Página ${i + 1} de ${rango.count}`, MARGEN + ANCHO_UTIL / 2, y, { width: ANCHO_UTIL / 2, align: 'right', lineBreak: false });
      doc.page.margins.bottom = antes;
    }
  }

  // ─── Datos y formatos ────────────────────────────────────────────────────────────────────

  private readonly INSTALACION: Record<string, string> = {
    clima: 'Clima y aerotermia',
    fontaneria: 'Fontanería y saneamiento',
    pci: 'Protección contra incendios',
    teleco: 'Telecomunicaciones',
    electricidad: 'Electricidad e iluminación',
  };

  private tituloDe(cual: string): string {
    if (cual === 'mediciones') return 'Informe de mediciones vs planos';
    if (cual === 'cumplimiento') return 'Informe de cumplimiento normativo';
    return 'Informe de homologación';
  }

  private obraDe(h: any): string {
    return this.txt(h?.proyecto_nombre || h?.num_obra || 'obra sin nombre');
  }

  private tipoArchivo(nombre: string): string {
    const n = String(nombre ?? '').toLowerCase();
    if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) return 'presupuesto / mediciones';
    if (n.endsWith('.pdf')) return 'planos o memoria';
    if (n.endsWith('.dwg') || n.endsWith('.dxf')) return 'plano CAD';
    return 'documento';
  }

  /**
   * Deja el texto en caracteres que Helvetica sabe pintar. Sin esto, un caracter que no esta en
   * su codificacion (un triangulo griego o una cruz) rompe la linea entera y salen caracteres de
   * control en el PDF: la formula de la caida de tension salia ilegible.
   */
  private limpio(v: any): string {
    const cambios: [RegExp, string][] = [
      [/Δ/g, 'd'], [/≥/g, '>='], [/≤/g, '<='],
      [/✗|✘/g, '-'], [/✓|✔/g, '-'], [/×/g, 'x'],
      [/‑|–|—/g, '-'], [/‘|’/g, "'"], [/“|”/g, '"'],
      [/…/g, '...'], [/ /g, ' '],
    ];
    let t = String(v ?? '');
    for (const [re, s2] of cambios) t = t.replace(re, s2);
    return t
      .split('')
      .filter((c: string) => c.charCodeAt(0) >= 32 || c === String.fromCharCode(10))
      .join('');
  }

private txt(v: any): string {
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }

  private num(v: any): string {
    const n = Number(v ?? 0);
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n);
  }

  private euros(v: any): string {
    const n = Number(v ?? 0);
    return `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} €`;
  }

  private fecha(v: any, soloDia = false): string {
    const d = v ? new Date(v) : new Date();
    if (Number.isNaN(d.getTime())) return '—';
    const o: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' };
    if (!soloDia) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('es-ES', o);
  }

  private slug(t: string): string {
    return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  }
}

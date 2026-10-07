import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ArchivoObra, Homologacion, InstalacionHomologacion } from './entities/homologacion.entity';
import { Verificacion, VerificadorService } from './verificador.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx');
// pdf-parse v2: el paquete exporta el analizador, no la función de antes.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

/**
 * Analizador de la documentación de un trámite de Homologaciones.
 *
 * Lo que hace HOY, y que es lo único que se puede afirmar sin inventar:
 *  1. Lee las partidas del Excel del proyecto (presupuesto/mediciones).
 *  2. Las reparte por instalación según el capítulo del presupuesto (03 y 15 → fontanería,
 *     16 → electricidad, 17 y 19 → clima, 18 → teleco, 21 → PCI).
 *  3. Busca cada partida en el texto de los planos (PDF) por marca, modelo, tipo de cable y
 *     sección, y apunta en qué hojas aparece.
 *
 * Lo que NO hace (y lo dice a la cara en el resultado): comprobar cantidades. Un PDF de planos no
 * trae cuadro de mediciones — eso sale del Excel de mediciones o del DWG—, así que la cantidad del
 * plano queda «pendiente» y la partida que no se localiza queda «a verificar», NUNCA como
 * incumplimiento. El resultado es un BORRADOR que revisa y firma un técnico.
 */

/** Base normativa por instalación: la acordada con el departamento, ni una más. */
export const NORMATIVA: Record<string, { norma: string; referencia: string; nota: string }[]> = {
  clima: [
    { norma: 'RITE', referencia: 'RD 1027/2007', nota: 'Reglamento de instalaciones térmicas en los edificios' },
    { norma: 'CTE DB-HE', referencia: 'RD 314/2006', nota: 'Ahorro de energía' },
  ],
  fontaneria: [
    { norma: 'CTE DB-HS4', referencia: 'RD 314/2006', nota: 'Suministro de agua' },
    { norma: 'CTE DB-HS5', referencia: 'RD 314/2006', nota: 'Evacuación de aguas' },
    { norma: 'RD 3/2023', referencia: 'RD 3/2023', nota: 'Criterios sanitarios del agua de consumo' },
  ],
  pci: [
    { norma: 'RIPCI', referencia: 'RD 513/2017', nota: 'Reglamento de instalaciones de protección contra incendios' },
    { norma: 'CTE DB-SI', referencia: 'RD 314/2006', nota: 'Seguridad en caso de incendio' },
  ],
  teleco: [
    { norma: 'ICT', referencia: 'RD 346/2011', nota: 'Infraestructuras comunes de telecomunicaciones' },
    { norma: 'Orden ITC/1644/2011', referencia: 'ITC/1644/2011', nota: 'Desarrollo del RD 346/2011' },
  ],
  electricidad: [
    { norma: 'REBT', referencia: 'RD 842/2002', nota: 'Reglamento electrotécnico para baja tensión y sus ITC-BT' },
  ],
};

/**
 * El capítulo del presupuesto manda: dice a qué instalación pertenece cada partida. Los capítulos
 * son los de la base de precios que usa el departamento (03 saneamiento, 15 fontanería,
 * 16 electricidad, 17 aerotermia, 18 teleco, 19 ventilación, 21 PCI).
 */
const CAPITULO_A_TIPO: Record<string, string> = {
  '03': InstalacionHomologacion.FONTANERIA,
  '15': InstalacionHomologacion.FONTANERIA,
  '16': InstalacionHomologacion.ELECTRICIDAD,
  '17': InstalacionHomologacion.CLIMA,
  '18': InstalacionHomologacion.TELECO,
  '19': InstalacionHomologacion.CLIMA,
  '21': InstalacionHomologacion.PCI,
};

/** Nombres de los capítulos, para poder decirlo en el informe sin teclear nada a mano. */
const NOMBRE_CAPITULO: Record<string, string> = {
  '03': 'Saneamiento', '15': 'Fontanería', '16': 'Electricidad e iluminación', '17': 'Clima y aerotermia',
  '18': 'Telecomunicaciones', '19': 'Ventilación', '21': 'Protección contra incendios',
};

/** Palabras que no sirven para buscar (salen en cualquier plano y darían falsos positivos). */
const VACIAS = new Set([
  'SUMINISTRO', 'INSTALACION', 'MONTAJE', 'PARA', 'CON', 'DEL', 'DE', 'LA', 'LAS', 'LOS', 'EN', 'SOBRE',
  'TIPO', 'SEGUN', 'MATERIAL', 'EQUIPO', 'CABLE', 'CABLES', 'CAJA', 'TUBO', 'UNIDAD', 'UNIDADES',
  'SISTEMA', 'PUNTO', 'LINEA', 'RED', 'CANAL', 'CANALIZACION', 'PUESTA', 'TIERRA', 'COLOCACION',
]);

/** Lo que se busca en los planos de cada instalación: si no sale, es una duda para el técnico. */
const COMPROBACIONES: Record<string, { clave: string; que: string; norma: string; busca: RegExp }[]> = {
  clima: [
    { clave: 'rite', que: 'Referencia al RITE o a la IT correspondiente', norma: 'RITE · IT 1.1 y IT 1.2', busca: /RITE|IT ?1[.,]|IT ?2[.,]/ },
    { clave: 'ventilacion', que: 'Sistema de ventilación (mecánica o híbrida)', norma: 'RITE · IT 1.1 · CTE DB-HS3', busca: /VENTILAC|VMC|RECUPERADOR|EXTRA(C|CT)OR/ },
    { clave: 'conductos', que: 'Conductos de aire (material y sección)', norma: 'RITE · IT 1.2', busca: /CONDUCTO|CONDUCTOS/ },
  ],
  fontaneria: [
    { clave: 'acs', que: 'Producción y distribución de A.C.S.', norma: 'CTE DB-HS4 4.5 · RD 3/2023', busca: /A\.?C\.?S\.?|AGUA CALIENTE/ },
    { clave: 'acometida', que: 'Acometida y llave de paso general', norma: 'CTE DB-HS4 4.1', busca: /ACOMETIDA|LLAVE DE PASO|CONTADOR/ },
    { clave: 'evacuacion', que: 'Red de evacuación (bajantes y colectores)', norma: 'CTE DB-HS5 4.1 y 4.2', busca: /BAJANTE|COLECTOR|EVACUAC|FECALES/ },
  ],
  pci: [
    { clave: 'extintores', que: 'Extintores y su ubicación', norma: 'RIPCI anexo I · CTE DB-SI 4', busca: /EXTINTOR/ },
    { clave: 'bie', que: 'BIE o columna seca, si le toca por uso y superficie', norma: 'RIPCI anexo I · CTE DB-SI 4', busca: /B\.?I\.?E\.?|COLUMNA SECA|ROCIADOR|SPRINKLER/ },
    { clave: 'deteccion', que: 'Detección automática de incendios, si le toca', norma: 'RIPCI anexo I · RD 513/2017', busca: /DETECT|CENTRAL DE INCENDIOS|PULSADOR/ },
  ],
  teleco: [
    { clave: 'ict', que: 'Referencia a la ICT y sus recintos', norma: 'ICT · anexo III (RD 346/2011)', busca: /ICT|RITI|RITU|RITS/ },
    { clave: 'pau', que: 'PAU y red de distribución hasta viviendas', norma: 'ICT · anexo I (RD 346/2011)', busca: /PAU|PUNTO DE ACCESO|FIBRA|PAR TRENZADO/ },
  ],
  electricidad: [
    { clave: 'rebt', que: 'Referencia al REBT y sus ITC-BT', norma: 'REBT · RD 842/2002', busca: /REBT|ITC-?BT/ },
    { clave: 'tierra', que: 'Puesta a tierra (red, picas y caja de seccionamiento)', norma: 'REBT · ITC-BT-18', busca: /PUESTA A TIERRA|PICA|TOMA DE TIERRA/ },
    { clave: 'cuadros', que: 'Cuadros y sus esquemas unifilares', norma: 'REBT · ITC-BT-17 / ITC-BT-24 / ITC-BT-25', busca: /CGP|CGBT|CUADRO GENERAL|UNIFILAR|CSIV|CSIII/ },
    { clave: 'di', que: 'Derivaciones individuales a viviendas', norma: 'REBT · ITC-BT-15 / ITC-BT-19', busca: /DERIVACION INDIVIDUAL|D\.?I\.? / },
  ],
};

/**
 * Cuando una partida NO se localiza en los planos, el informe no puede dejarlo en «a verificar» y
 * nada más: hay que decir QUÉ punto de la normativa se está comprobando con esa partida y qué tiene
 * que mirar el técnico. Esto es lo que sale en la columna «En el plano» de cada partida pendiente.
 */
const REGLAS_VERIFICACION: Record<string, { busca: RegExp; requisito: string; norma: string; donde: string }[]> = {
  electricidad: [
    { busca: /FOTOVOLT|PANEL|INVERSOR|STRING|FRONIUS|CANADIAN|SOLAR/i,
      requisito: 'Potencia y configuración de la instalación solar (nº de paneles e inversores, protecciones CC/CA)',
      norma: 'REBT · ITC-BT-40 · RD 244/2019', donde: 'planos de cubierta y esquema unifilar' },
    { busca: /RECARGA|VEH[IÍ]CULOS EL[EÉ]CTRICOS|SAVE|SPDC/i,
      requisito: 'Punto de recarga de vehículo eléctrico: potencia, protecciones y ubicación',
      norma: 'REBT · ITC-BT-52', donde: 'planos de garaje y unifilar' },
    { busca: /CUADRO|CGP|CGBT|CAJA GENERAL|ARMARIO/i,
      requisito: 'Composición del cuadro y sus protecciones (esquema unifilar y relación de circuitos)',
      norma: 'REBT · ITC-BT-17 / ITC-BT-24 / ITC-BT-25', donde: 'esquema unifilar' },
    { busca: /TIERRA|PICA|EQUIPOTENCIAL/i,
      requisito: 'Red de tierra: picas, conductor y caja de seccionamiento',
      norma: 'REBT · ITC-BT-18', donde: 'plano de puesta a tierra' },
    { busca: /EMERGENCIA|NAOS|IZAR|HYDRA|SE[ÑN]ALIZ/i,
      requisito: 'Alumbrado de emergencia y señalización: nivel, autonomía y recorridos',
      norma: 'REBT · ITC-BT-28 / ITC-BT-44 · CTE DB-SUA 4', donde: 'planos de alumbrado y esquemas' },
    { busca: /LUMINARIA|DOWNLIGHT|APLIQUE|LED|CORELINE|ARKOSLIGHT|LUCECO/i,
      requisito: 'Luminarias: modelo, ubicación y circuito al que van',
      norma: 'REBT · ITC-BT-44 · CTE DB-HE3/HE5', donde: 'plano de alumbrado' },
    { busca: /TOMA|MECANISMO|INTERRUPTOR|CONMUTADOR|PULSADOR|NIESSEN|TIMBRE|PRESENCIA/i,
      requisito: 'Nº y ubicación de mecanismos, y circuito al que pertenecen',
      norma: 'REBT · ITC-BT-25', donde: 'planos de planta' },
    { busca: /BANDEJA|CANAL|CANALIZACI|TUBO|PROTECTOR|DERIVACI/i,
      requisito: 'Trazado y dimensionado de canalizaciones y conductores',
      norma: 'REBT · ITC-BT-19 / ITC-BT-20 / ITC-BT-21', donde: 'planos de planta y unifilar' },
  ],
  fontaneria: [
    { busca: /A\.?C\.?S\.?|CALENTADOR|ACUMULADOR|INTERCAMBIADOR|CALDERA/i,
      requisito: 'Producción de A.C.S.: caudal, temperatura y acumulación',
      norma: 'CTE DB-HS4 4.5 · RD 3/2023', donde: 'planos de cuarto de instalaciones y memoria' },
    { busca: /GRUPO.{0,10}PRESI[ÓO]N|CONTADOR|LLAVE|ACOMETIDA|FONTANER/i,
      requisito: 'Acometida, contador y grupo de presión: caudal y presión disponible',
      norma: 'CTE DB-HS4 4.1 y 4.3', donde: 'plano de acometida y cuarto de contadores' },
    { busca: /PEX|UPONOR|TUB|COBRE|PPR|EVOH|POLIETILENO/i,
      requisito: 'Diámetro, material y trazado de las tuberías de suministro',
      norma: 'CTE DB-HS4 4.2', donde: 'planos de planta y esquemas' },
    { busca: /BAJANTE|COLECTOR|ARQUETA|POZO|SEPARADOR|EVACUAC|FECAL|SANEAM|PVC|JIMTEN/i,
      requisito: 'Red de evacuación: diámetros, pendientes, arquetas y acometida a la red',
      norma: 'CTE DB-HS5 4.1 y 4.2', donde: 'planos de saneamiento' },
    { busca: /INODORO|LAVABO|DUCHA|SANITARIO|GRIFO/i,
      requisito: 'Aparatos sanitarios: tipo, número y desagües',
      norma: 'CTE DB-HS4 y DB-HS5', donde: 'planos de planta' },
  ],
  clima: [
    { busca: /AEROTERM|BOMBA DE CALOR|CALOR|R32|MIDEA|PANASONIC|DAIKIN|SAUNIER|VAILLANT/i,
      requisito: 'Potencia y modelo de la bomba de calor, y condiciones de diseño (temperaturas y caudal)',
      norma: 'RITE · IT 1.2 y IT 2.3 · ficha del fabricante', donde: 'planos de cuarto de máquinas y memoria' },
    { busca: /SUELO RADIANTE|ORKLI|TETONES|RADIADOR|FANCOIL|TERMOSTATO|EMISOR/i,
      requisito: 'Emisores: potencia y reparto por estancia',
      norma: 'RITE · IT 1.2 · CTE DB-HE2', donde: 'planos de planta y memoria' },
    { busca: /CONDUCTO|REJILLA|DIFUSOR|VENTILAC|VMC|RECUPERADOR|EXTRA/i,
      requisito: 'Conductos y ventilación: caudal, sección y recorrido',
      norma: 'RITE · IT 1.1 y IT 1.2 · CTE DB-HS3', donde: 'planos de ventilación' },
    { busca: /AISLAM|COQUILLA|CALORIFUG|ESPUMA/i,
      requisito: 'Aislamiento de tuberías y conductos (espesor y material)',
      norma: 'RITE · IT 1.2', donde: 'memoria y detalles' },
  ],
  pci: [
    { busca: /EXTINTOR/i, requisito: 'Nº, tipo y ubicación de extintores según el riesgo y la superficie',
      norma: 'RIPCI anexo I · CTE DB-SI 4', donde: 'planos de planta y memoria' },
    { busca: /B\.?I\.?E|COLUMNA SECA|ROCIADOR|SPRINKLER|HIDRANTE/i,
      requisito: 'BIE, columna seca o rociadores: si le toca por uso y superficie, y su cobertura',
      norma: 'RIPCI anexo I · CTE DB-SI 4', donde: 'planos de PCI' },
    { busca: /DETECT|CENTRAL|PULSADOR|ALARMA|SIRENA/i,
      requisito: 'Detección y alarma: cobertura por estancia y central',
      norma: 'RIPCI anexo I · RD 513/2017', donde: 'planos de PCI' },
    { busca: /SE[ÑN]ALIZ|EVACUAC|SALIDA/i, requisito: 'Señalización de evacuación y recorridos',
      norma: 'CTE DB-SUA 4', donde: 'planos de planta' },
  ],
  teleco: [
    { busca: /RTV|ANTENA|CAPTACI[ÓO]N|CABECERA|DAB|FM/i,
      requisito: 'Captación de RTV y equipo de cabecera: ubicación y canalizaciones',
      norma: 'ICT · anexo I (RD 346/2011)', donde: 'planos de cubierta y telecomunicaciones' },
    { busca: /BAT|PAU|FIBRA|[ÁA]REA DE TELECOMUNIC|PAR TRENZADO|CATEGOR/i,
      requisito: 'PAU y red de distribución hasta las tomas (fibra y pares)',
      norma: 'ICT · anexos I y II', donde: 'planos de telecomunicaciones' },
    { busca: /RITI|RITU|RITS|ARMARIO|RACK|CANALIZACI[ÓO]N PRINCIPAL/i,
      requisito: 'Recintos de instalaciones y canalizaciones principales',
      norma: 'ICT · anexo III', donde: 'planos de telecomunicaciones' },
    { busca: /PORTERO|VIDEOPORTERO|TELEFON|INTERCOM/i,
      requisito: 'Videoportero y servicio de telefonía disponible al público',
      norma: 'ICT · anexo I', donde: 'planos de planta' },
  ],
};

/**
 * Las marcas «***» que trae el presupuesto dicen cosas que hay que verificar ANTES que nada: hay
 * partidas de proyecto que NO se ofertan (quedan fuera del alcance, o las ejecuta otro) y otras que
 * se ofertan con otro modelo o marca. Eso no se puede dejar en un «a verificar» genérico.
 */
const REGLAS_EXCLUIDAS: { busca: RegExp; requisito: string; norma: string; donde: string }[] = [
  { busca: /\*{2,}\s*NO SE OFERT/i,
    requisito: 'El presupuesto la marca como NO OFERTADA: confirmar si queda fuera del alcance de HomeServe y quién la ejecuta',
    norma: 'Alcance del contrato (proyecto contra presupuesto)', donde: 'presupuesto y planos' },
  { busca: /\*{2,}[^*]*SE OFERTT?A/i,
    requisito: 'Se oferta con un modelo o marca distinta a la de proyecto: comprobar que la equivalencia es válida',
    norma: 'Equivalencia técnica · ficha del fabricante', donde: 'presupuesto y ficha del fabricante' },
];

/**
 * Familias que no encajaban en las reglas anteriores (valvulería, canalizaciones de la ICT, vaso de
 * expansión, circuitos de distribución, piscina…). Se comprueban DESPUÉS de las de arriba: lo que ya
 * tenía su regla no pasa por aquí.
 */
const REGLAS_EXTRA: Record<string, { busca: RegExp; requisito: string; norma: string; donde: string }[]> = {
  electricidad: [
    { busca: /CPM|CAJA DE PROTECCI|PROTECCI[ÓO]N Y MEDIDA/i,
      requisito: 'Caja de protección y medida (CPM): tipo, ubicación y acceso',
      norma: 'REBT · ITC-BT-13', donde: 'plano de acometida y cuarto de contadores' },
    { busca: /CIRCUITO DE DISTRIBUCI|CIRCUITO C\d|C\d+\.\d/i,
      requisito: 'Circuitos de distribución: sección de los conductores, protección y trazado de cada uno',
      norma: 'REBT · ITC-BT-25', donde: 'esquema unifilar y planos de planta' },
  ],
  fontaneria: [
    { busca: /V[ÁA]LVUL|FILTRO|VACIADO|RETENCI|ESFERA/i,
      requisito: 'Valvulería y elementos de corte: tipo, diámetro y ubicación',
      norma: 'CTE DB-HS4 4.3 y 4.6', donde: 'esquemas y planos de cuarto húmedo' },
    { busca: /PISCINA|SKIMMER|BOQUILLA|LIMPIAFONDOS|CLORACI|SUMIDERO|PREFILTRO|SELECTORA|POLIESTER/i,
      requisito: 'Piscina: equipos de filtración, depuración y cloración',
      norma: 'RD 742/2013 (piscinas) · CTE DB-HS4', donde: 'planos de piscina y cuarto de máquinas' },
    { busca: /RIEGO/i, requisito: 'Riego: red, llave de corte y programación',
      norma: 'CTE DB-HS4 4.3', donde: 'planos de parcela' },
    { busca: /VENTILACI[ÓO]N|TERMINAL DE VENT|MAN[GH]UITO|CORTAFUEGOS|INSONORIZ|REJILLA/i,
      requisito: 'Red de evacuación: ventilación, pasos por forjado y protección al fuego',
      norma: 'CTE DB-HS5 4.1 y 4.3 · CTE DB-SI', donde: 'planos de saneamiento' },
  ],
  clima: [
    { busca: /LLENADO|EXPANSI[ÓO]N|V[ÁA]LVULA DE SEGURIDAD|PURGA/i,
      requisito: 'Elementos de seguridad y llenado del circuito (vaso de expansión, válvula de seguridad, purgadores)',
      norma: 'RITE · IT 1.2 y IT 2.3 · UNE-EN 12828', donde: 'esquema del cuarto de máquinas y memoria' },
    { busca: /COBRE|MULTICAPA|FRIGOR|REFRIGERANT|TRENZADO|APANTALLADO/i,
      requisito: 'Tuberías hidráulicas y frigoríficas, y alimentación eléctrica de la máquina: diámetro, aislamiento y cableado',
      norma: 'RITE · IT 1.2 · RD 552/2019 (frigoríficas) · REBT ITC-BT-47', donde: 'planos de cuarto de máquinas y esquemas' },
    { busca: /DETECTOR CO|CO 0-|SOBREPRESI|COMPUERTA/i,
      requisito: 'Ventilación y seguridad: compuertas, detección de CO y caudales',
      norma: 'RITE · IT 1.1 · CTE DB-HS3', donde: 'planos de ventilación' },
  ],
  pci: [
    { busca: /CORTAFUEGOS|EI ?\d|SECTOR|REJILLA/i,
      requisito: 'Sectorización y compartimentación: elementos con resistencia al fuego (EI)',
      norma: 'CTE DB-SI 1 · RIPCI', donde: 'planos de sectorización' },
  ],
  teleco: [
    { busca: /ROSETA|MULTIPLEXOR|CABLE 1 FO|ÓPTIC|COAXIAL|CATEGOR|FIBRA/i,
      requisito: 'Red de distribución: cable (fibra, coaxial o par), tomas y elementos de reparto',
      norma: 'ICT · anexos I y II (RD 346/2011)', donde: 'planos de telecomunicaciones' },
    { busca: /CANALIZACI|CANAL\.|REGISTRO|ARQUETA|TENDIDO|HILO GU[ÍI]A|RECINTO|EQUIPAMIENTO/i,
      requisito: 'Canalizaciones y registros de la ICT: trazado, diámetro y ocupación',
      norma: 'ICT · anexo III (RD 346/2011)', donde: 'planos de telecomunicaciones' },
  ],
};

type Partida = {
  codigo: string; unidad: string; resumen: string; cantidad: number; precio: number; importe: number;
  capitulo: string; instalacion: string; estado: string; coincidencias: string[]; hojas: number[];
  /** Si no se localiza en el plano: qué hay que comprobar y con qué punto de la normativa. */
  verificacion?: { requisito: string; norma: string; donde: string; alcance?: boolean };
};

@Injectable()
export class AnalizadorService {
  private readonly log = new Logger(AnalizadorService.name);

  constructor(private readonly verificador: VerificadorService) {}

  /** Analiza la documentación del trámite y devuelve el resultado por instalación (sin guardarlo). */
  async analizar(h: Homologacion) {
    const archivos = (h.archivos ?? []).filter((a) => a.fichero);
    const avisos: string[] = [];

    const excels: ArchivoObra[] = archivos.filter((a) => a.tipo === 'excel');
    const pdfs: ArchivoObra[] = archivos.filter((a) => a.tipo === 'pdf');
    const dwgs: ArchivoObra[] = archivos.filter((a) => a.tipo === 'dwg');

    if (!excels.length) avisos.push('No hay Excel de presupuesto/mediciones subido: sin él no se pueden leer las partidas.');
    if (!pdfs.length) avisos.push('No hay PDF de planos o memoria subido: sin él no hay con qué contrastar las partidas.');
    if (dwgs.length) avisos.push('Los DWG/DXF están subidos pero la conversión DWG→DXF y su medida todavía no está hecha: no se han usado.');

    let partidas: Partida[] = [];
    const descripciones: string[] = [];
    for (const a of excels) {
      const ruta = this.ruta(h.id, a);
      if (!existsSync(ruta)) { avisos.push(`El Excel «${a.nombre}» ya no está en el disco.`); continue; }
      try {
        const fichero = readFileSync(ruta);
        partidas = partidas.concat(this.partidasDeExcel(fichero));
        // Las descripciones largas traen los datos verificables (sección de cada circuito, etc.).
        descripciones.push(...this.descripcionesDeExcel(fichero));
      } catch (e) {
        this.log.error(`Excel ${a.nombre}: ${e}`);
        avisos.push(`No he podido leer el Excel «${a.nombre}».`);
      }
    }

    // Texto de los planos, hoja por hoja (pdf-parse separa las páginas con \f).
    const hojas: string[] = [];
    for (const a of pdfs) {
      const ruta = this.ruta(h.id, a);
      if (!existsSync(ruta)) { avisos.push(`El PDF «${a.nombre}» ya no está en el disco.`); continue; }
      try {
        const parser = new PDFParse({ data: readFileSync(ruta) });
        const datos = await parser.getText();
        for (const p of datos.pages ?? []) hojas.push(this.limpia(String(p.text ?? '')));
        await parser.destroy();
      } catch (e) {
        this.log.error(`PDF ${a.nombre}: ${e}`);
        avisos.push(`No he podido leer el PDF «${a.nombre}».`);
      }
    }
    const todoElPlano = hojas.join(' ');

    // Cada partida, a su instalación y buscada en los planos.
    for (const p of partidas) {
      const claves = this.pistas(p.resumen);
      const encontradas: string[] = [];
      const donde = new Set<number>();
      for (const k of claves) {
        const kn = this.limpia(k);
        if (kn.length < 4 || !todoElPlano.includes(kn)) continue;
        encontradas.push(k);
        hojas.forEach((t, i) => { if (t.includes(kn)) donde.add(i + 1); });
      }
      p.coincidencias = encontradas;
      p.hojas = [...donde].sort((a, b) => a - b);
      p.estado = encontradas.length ? 'localizada' : 'a_verificar';
      // Si no se localiza, el informe dice QUÉ hay que comprobar y con qué artículo de la normativa.
      p.verificacion = this.queVerificar(p);
    }

    // Un bloque por instalación del trámite, en el orden del catálogo (el documento no cambia).
    const pedidas: string[] = (h.instalaciones ?? []).length
      ? (h.instalaciones as string[])
      : [...new Set(partidas.map((p) => p.instalacion))];

    // Lo que se puede comprobar de verdad: los datos declarados y las diferencias que salen.
    const tramos = this.tramosDePlano(hojas);
    const circuitos = this.circuitosDeTexto(descripciones);
    const desviaciones = this.desviaciones(partidas, tramos);
    // Las líneas del unifilar, con su sección, potencia y longitud: con eso se calcula la caída de tensión.
    const unifilar = this.unifilarDePlano(hojas);

    const hechos = { circuitos, tramos_cable: tramos, unifilar };
    const instalaciones = pedidas.map((tipo) => this.bloque(tipo, partidas, hojas, todoElPlano, desviaciones, hechos));

    const totalImporte = partidas.reduce((s, p) => s + p.importe, 0);
    return {
      generado: new Date().toISOString(),
      obra: h.proyecto_nombre ?? null,
      documentos: archivos.map((a) => ({ nombre: a.nombre, tipo: a.tipo, bytes: a.bytes ?? 0, subido: a.subido ?? null })),
      hojas_de_plano: hojas.length,
      avisos,
      instalaciones,
      // Los datos con los que se contrasta la norma, a la vista para poder auditarlos.
      hechos,
      desviaciones,
      totales: {
        partidas: partidas.length,
        importe: this.red(totalImporte),
        localizadas: partidas.filter((p) => p.estado === 'localizada').length,
        a_verificar: partidas.filter((p) => p.estado === 'a_verificar').length,
        con_cantidad: partidas.filter((p) => Number(p.cantidad) !== 0).length,
        desviaciones: desviaciones.length,
        desviaciones_graves: desviaciones.filter((d) => d.gravedad === 'alta').length,
      },
      sello: 'BORRADOR · PENDIENTE DE REVISIÓN TÉCNICA',
    };
  }

  /** El bloque de una instalación: su normativa, sus comprobaciones y sus partidas. */
  private bloque(tipo: string, partidas: Partida[], hojas: string[], todoElPlano: string, desviaciones: any[] = [], hechos: any = {}) {
    const mias = partidas.filter((p) => p.instalacion === tipo);
    const importe = mias.reduce((s, p) => s + p.importe, 0);
    const aVerificar = mias.filter((p) => p.estado === 'a_verificar');
    const mias_desviaciones = desviaciones.filter((d) => d.instalacion === tipo);

    // Comprobaciones en el plano: si algo no aparece, es una DUDA para el técnico, no un incumplimiento.
    const comprobaciones = (COMPROBACIONES[tipo] ?? []).map((c) => {
      const paginas = hojas.map((t, i) => [i + 1, t] as [number, string])
        .filter(([, t]) => c.busca.test(t)).map(([n]) => n);
      return {
        clave: c.clave,
        que: c.que,
        // El punto de la normativa que se está comprobando: es lo que pide el técnico en el informe.
        norma: c.norma,
        localizada: paginas.length > 0,
        estado: paginas.length > 0 ? 'localizada' : 'no_localizada',
        paginas,
      };
    });

    const dudas = comprobaciones.filter((c) => !c.localizada)
      .map((c) => `${c.que} (${c.norma}): no se localiza en la documentación de planos — puede estar en la memoria o nombrarse de otra forma.`);
    if (!mias.length) {
      dudas.push('No hay partidas de esta instalación en el Excel del proyecto: comprobar que el presupuesto subido es el de esta obra.');
    }

    return {
      tipo,
      normativa: NORMATIVA[tipo] ?? [],
      // El contraste de cantidades no se puede hacer con un PDF de planos: se dice tal cual.
      mediciones: {
        partidas: mias.sort((a, b) => a.codigo.localeCompare(b.codigo)),
        totales: {
          partidas: mias.length, importe: this.red(importe),
          localizadas: mias.length - aVerificar.length, a_verificar: aVerificar.length,
          importe_a_verificar: this.red(aVerificar.reduce((s, p) => s + p.importe, 0)),
        },
        capitulos: [...new Set(mias.map((p) => `${p.capitulo} ${NOMBRE_CAPITULO[p.capitulo] ?? ''}`.trim()))],
        // Las diferencias comprobadas en esta instalación (importe que no cuadra, metros del plano…).
        desviaciones: mias_desviaciones,
        aviso: 'Los planos no traen cuadro de mediciones: se comprueba que la partida esté citada en el plano '
          + '(y en qué hoja), no la cantidad. La columna de cantidad del plano queda pendiente del Excel de '
          + 'mediciones o del DWG.',
      },
      cumplimiento: (() => {
        // El verificador contrasta lo declarado con el mínimo de la norma: cumple / no cumple / sin datos.
        const verificaciones: Verificacion[] = this.verificador.verifica(tipo, hechos, mias, hojas);
        const incumple = verificaciones.filter((v) => v.estado === 'no_cumple');
        const sinDatos = verificaciones.filter((v) => v.estado === 'sin_datos');
        const cumple = verificaciones.filter((v) => v.estado === 'cumple');
        return {
          estado: incumple.length ? 'con_incumplimientos' : verificaciones.length ? 'verificado' : 'pendiente_de_verificar',
          // Lo que NO cumple, primero y en rojo: es lo que no se puede escapar del informe.
          incumplimientos: incumple.map((v) => `${v.que} — ${v.detalle} [${v.articulo}]`),
          verificaciones,
          resumen: { verificadas: verificaciones.length, cumple: cumple.length, no_cumple: incumple.length, sin_datos: sinDatos.length },
          requisitos: (NORMATIVA[tipo] ?? []).map((n) => ({ ...n, estado: 'pendiente' })),
          comprobaciones,
          dudas,
          observaciones: sinDatos.map((v) => `${v.que}: ${v.detalle}`),
          aviso: 'El veredicto de cada punto se contrasta con el artículo que se cita: los valores están tomados '
            + 'del texto oficial (BOE, CTE, guías del ministerio), no de memoria. Lo que no aparece en la '
            + 'documentación queda como «sin datos» en vez de darse por bueno. Sigue siendo un BORRADOR que '
            + 'revisa y firma un técnico.',
        };
      })(),
      resumen: mias.length
        ? `${mias.length} partidas · ${this.red(importe).toLocaleString('es-ES')} € · ${mias.length - aVerificar.length} citadas en plano · ${aVerificar.length} a verificar`
        : 'Sin partidas de esta instalación en el presupuesto subido',
    };
  }

  /**
   * Las partidas del libro. El presupuesto de HomeServe trae el mismo listado en varias hojas: la
   * buena (con cantidades y precios) y otras copias sin precio o con otra numeración. Se lee la hoja
   * que trae importes y, de las demás, solo lo que aporte precio o un código que no estuviera: si no,
   * las partidas salían duplicadas y el importe del informe no cuadraba con el presupuesto.
   */
  private partidasDeExcel(fichero: Buffer): Partida[] {
    const libro = XLSX.read(fichero, { type: 'buffer' });
    const hojas = (libro.SheetNames as string[]).map((nombre: string) => ({
      nombre, partidas: this.partidasDeHoja(libro.Sheets[nombre]),
    }));
    if (!hojas.length) return [];
    const conPrecio = (ps: Partida[]) => ps.filter((p) => p.importe !== 0 || p.precio !== 0).length;
    const principal = hojas.slice().sort((a, b) => conPrecio(b.partidas) - conPrecio(a.partidas))[0];
    const mapa = new Map<string, Partida>();
    for (const p of principal.partidas) mapa.set(p.codigo, p);
    for (const hoja of hojas) {
      if (hoja.nombre === principal.nombre) continue;
      for (const p of hoja.partidas) {
        const ya = mapa.get(p.codigo);
        if (!ya) {
          // De las otras hojas solo entra lo que traiga precio: si no, son listados sin valorar.
          if (p.importe !== 0 || p.precio !== 0) mapa.set(p.codigo, p);
        } else if (ya.importe === 0 && p.importe !== 0) {
          mapa.set(p.codigo, p);
        }
      }
    }
    return [...mapa.values()];
  }

  /** Las partidas de una hoja, con la cabecera buscada por sus títulos (no por el número de fila). */
  private partidasDeHoja(hoja: any): Partida[] {
    const filas: any[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });
    const cab = this.filaDeCabecera(filas);
    const fuera: Partida[] = [];
    if (cab < 0) return fuera;
    const cols = this.columnas(filas[cab]);
    if (cols.codigo < 0 || cols.resumen < 0) return fuera;
    for (const fila of filas.slice(cab + 1)) {
      const codigo = String(fila[cols.codigo] ?? '').trim();
      if (!/^\d+(\.\d+)+$/.test(codigo)) continue;
      const resumen = String(fila[cols.resumen] ?? '').trim();
      if (!resumen) continue;
      const cantidad = this.num(cols.cantidad >= 0 ? fila[cols.cantidad] : 0);
      const precio = this.num(cols.precio >= 0 ? fila[cols.precio] : 0);
      const importe = this.num(cols.importe >= 0 ? fila[cols.importe] : 0);
      // Las filas de cabecera de capítulo (sin cantidad, sin precio y sin importe) no son partidas.
      if (!cantidad && !precio && !importe) continue;
      const capitulo = codigo.split('.')[0];
      fuera.push({
        codigo,
        unidad: String(cols.unidad >= 0 ? fila[cols.unidad] ?? '' : '').trim(),
        resumen, cantidad, precio, importe, capitulo,
        instalacion: CAPITULO_A_TIPO[capitulo] ?? 'otra',
        estado: 'a_verificar', coincidencias: [], hojas: [],
      });
    }
    return fuera;
  }

  /** La cabecera es la fila que trae «código» y «resumen» (y, si puede ser, cantidad y precio). */
  private filaDeCabecera(filas: any[][]): number {
    for (let i = 0; i < Math.min(filas.length, 40); i++) {
      const t = (filas[i] ?? []).map((c: any) => this.limpia(String(c ?? '')));
      if (t.some((c: string) => c === 'CODIGO' || c === 'CÓDIGO') && t.some((c: string) => c.startsWith('RESUMEN'))) return i;
    }
    return -1;
  }

  /** En qué columna está cada cosa. El presupuesto de HomeServe trae Cdigo|Ud|Resumen|CanObj|Precio|ImpCont. */
  private columnas(fila: any[]) {
    const t = (fila ?? []).map((c: any) => this.limpia(String(c ?? '')));
    const busca = (pat: RegExp) => t.findIndex((c: string) => pat.test(c));
    return {
      codigo: busca(/^CODIGO/),
      unidad: busca(/^UD$|^UNIDAD/),
      resumen: busca(/^RESUMEN/),
      cantidad: busca(/^CANOBJ|^CANTIDAD|^MEDICI/),
      precio: busca(/^PRECIO/),
      importe: busca(/^IMPCONT|^IMPORTE/),
    };
  }

  // ── Búsqueda de la partida en los planos ────────────────────────────────────────────────
  /** Marcas, modelos, tipos de cable y secciones: lo que de verdad identifica una partida en un plano. */
  private pistas(resumen: string): string[] {
    const r = resumen.toUpperCase();
    const fuera: string[] = [];
    fuera.push(...(r.match(/\b[A-Z]{3,}(?:[ -][A-Z0-9][A-Z0-9./-]{1,}){0,3}\b/g) ?? []));
    fuera.push(...(r.match(/\b[A-Z]*\d+[A-Z][A-Z0-9-]{2,}\b/g) ?? []));
    fuera.push(...(r.match(/\b\d+(?:[.,]\d+)?\s*(?:MM2|MM|W|V|A|M2)\b/g) ?? []));
    return [...new Set(fuera.map((x) => x.trim()).filter((x) => x.length >= 4 && !VACIAS.has(x)))];
  }

  /** Mayúsculas sin acentos y sin saltos raros: así compara igual lo que está escrito distinto. */
  private limpia(t: string): string {
    return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
  }

  /**
   * Qué tiene que mirar el técnico con esta partida y con qué punto de la normativa, cuando el
   * buscador no la ha localizado en los planos. Sale de la familia de la partida (sus marcas,
   * materiales y aparatos), sin inventarse nada: si no encaja en ninguna regla, se dice que se
   * compruebe en los planos y la memoria con la normativa de esa instalación.
   */
  private queVerificar(p: Partida) {
    const deAlcance = REGLAS_EXCLUIDAS.find((r) => r.busca.test(p.resumen));
    const regla = deAlcance
      ?? (REGLAS_VERIFICACION[p.instalacion] ?? []).find((r) => r.busca.test(p.resumen))
      ?? (REGLAS_EXTRA[p.instalacion] ?? []).find((r) => r.busca.test(p.resumen));
    return {
      requisito: regla?.requisito ?? 'Comprobar que la partida está en los planos y en la memoria',
      norma: regla?.norma ?? (NORMATIVA[p.instalacion] ?? []).map((n) => n.norma).join(' · '),
      donde: regla?.donde ?? 'planos y memoria',
      // Las partidas marcadas «***» en el presupuesto se avisan SIEMPRE, aunque estén en el plano:
      // lo que hay que aclarar no es dónde está, sino si entra o no en el alcance de la oferta.
      alcance: !!deAlcance,
    };
  }

  // ── Datos que se extraen para verificar (7-oct-2026) ────────────────────────────────────

  /**
   * Las descripciones largas del presupuesto. No son partidas (no llevan código ni cantidad),
   * pero traen los datos que hay que comprobar: la sección declarada de cada circuito de
   * vivienda, la autonomía de una luminaria de emergencia, el diámetro de un tubo. Se leen todas
   * las hojas y se quitan duplicados.
   */
  private descripcionesDeExcel(fichero: Buffer): string[] {
    const libro = XLSX.read(fichero, { type: 'buffer' });
    const fuera = new Set<string>();
    for (const nombre of libro.SheetNames as string[]) {
      const filas: any[][] = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: true, defval: null });
      for (const fila of filas) {
        for (const celda of fila ?? []) {
          const t = String(celda ?? '').trim();
          if (t.length >= 60 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(t)) fuera.add(t);
        }
      }
    }
    return [...fuera];
  }

  /**
   * Los circuitos de vivienda con su sección, tal como los declara el presupuesto. Es lo que
   * permite comprobar de verdad el ITC-BT-25 (si no, solo se podría decir «míralo»).
   */
  private circuitosDeTexto(descripciones: string[]) {
    const fuera: { codigo: string | null; nombre: string; seccion: number | null; fuente: string; texto: string }[] = [];
    const vistos = new Set<string>();
    for (const d of descripciones) {
      const t = this.limpia(d);
      const m = t.match(/CIRCUITO DE DISTRIBUCION INTERNA,?\s*DESTINADO A (.{5,170}?),?\s*REALIZADO CON (\d+) CONDUCTORES DE COBRE,? DE ([\d,]+)\s?MM2/);
      if (!m) continue;
      const nombre = m[1].trim().toLowerCase();
      const seccion = this.num(m[3]);
      const clave = `${nombre}|${seccion}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      fuera.push({
        codigo: this.codigoDeCircuito(nombre), nombre, seccion,
        fuente: 'presupuesto (descripción de la partida)', texto: d.slice(0, 260),
      });
    }
    return fuera;
  }

  /** Nombre del circuito → código del ITC-BT-25, solo cuando el texto lo dice sin ambigüedad. */
  private codigoDeCircuito(nombre: string): string | null {
    const n = this.limpia(nombre);
    if (/ILUMINACION|PUNTOS DE LUZ/.test(n)) return 'C1';
    if (/USO GENERAL|FRIGORIFICO|EXTRACTOR/.test(n)) return 'C2';
    if (/COCINA/.test(n) && /HORNO/.test(n)) return 'C3';
    if (/LAVADORA|LAVAVAJILLAS|TERMO ELECTRICO|ELECTROVALVULAS/.test(n)) return 'C4';
    if (/CUARTOS DE BANO|BASES AUXILIARES/.test(n)) return 'C5';
    if (/CALEFACCION|SUELO RADIANTE|BOMBA DE CALOR|AEROTERMIA|AEROTERMICA|RESISTENCIA DE APOYO|APOYO ACS/.test(n)) return 'C8';
    if (/AIRE ACONDICIONADO|CLIMATIZACION/.test(n)) return 'C9';
    if (/SECADORA/.test(n)) return 'C10';
    if (/AUTOMATIZACION|DOMOTICA/.test(n)) return 'C11';
    if (/VEHICULO ELECTRICO|RECARGA/.test(n)) return 'C13';
    return null;
  }

  /**
   * Los tramos de cable del unifilar con su longitud declarada («… 3x(1x1,5) ES07Z1-K (AS)MM2
   * 2.300W. L= 20 M»). Es la única medida real que trae un PDF de planos: sin esto no hay nada
   * que comparar con las mediciones del presupuesto.
   */
  private tramosDePlano(hojas: string[]) {
    const fuera: { tipo: string; conductores: number; seccion: number; metros: number; hojas: number[] }[] = [];
    const indice = new Map<string, { tipo: string; conductores: number; seccion: number; metros: number; hojas: number[] }>();
    hojas.forEach((t, i) => {
      const re = /AEBTUPVC(\d+)X\((\d+)X([\d,]+)\)\s*([A-Z0-9-]+)[^\n]*?L=\s*([\d.,]+)\s*M/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const n1 = Number(m[1]);
        const n2 = Number(m[2]);
        const seccion = this.num(m[3]);
        const metros = this.num(m[5].replace(',', '.'));
        const tipo = m[4];
        const conductores = n2 > 1 ? n2 : n1;
        const clave = `${tipo}|${conductores}|${seccion}`;
        const ya = indice.get(clave);
        if (ya) {
          ya.metros += metros;
          if (!ya.hojas.includes(i + 1)) ya.hojas.push(i + 1);
        } else {
          const nuevo = { tipo, conductores, seccion, metros, hojas: [i + 1] };
          indice.set(clave, nuevo);
          fuera.push(nuevo);
        }
      }
    });
    for (const t of fuera) t.metros = this.red(t.metros);
    return fuera;
  }

  /**
   * Las líneas del cuadro de vivienda tal y como las declara el unifilar del plano:
   * «R M20 AeBtuPVC3x(1x2,5) ES07Z1-K (AS)mm2 3.450W. L= 25 m». De aquí salen los tres datos con
   * los que se comprueba de verdad una instalación interior: tubo, sección y longitud para la caída
   * de tensión y la potencia prevista. No se inventa nada: si el plano no lo dice, no hay línea.
   */
  private unifilarDePlano(hojas: string[]) {
    const fuera: { hoja: number; tubo: string; cable?: string; seccion: number; potencia_w: number; longitud_m: number; vivienda: boolean }[] = [];
    hojas.forEach((t, i) => {
      // Los cuadros de vivienda van en la misma hoja que el rótulo «CUADRO TIPO VIVIENDA»; a los
      // circuitos de comunidad les aplica otro límite de caída de tensión, así que hay que distinguirlos.
      const vivienda = /TIPO VIVIENDA/i.test(t);
      const re = /R\s+(M\s?\d+)\s+[A-Z]*?AEBTUPVC[A-Z]*?(\d+)X\((\d+)X([\d,]+)\)\s*([A-Z0-9.\-+]+)[^\n]*?([\d.,]+)\s*W[\s.]*L=\s*([\d.,]+)\s*M/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const seccion = this.num(m[4]);
        const w = this.num(m[6].replace(/\./g, ''));
        const largo = this.num(m[7].replace(',', '.'));
        if (!seccion || !w || !largo) continue;
        fuera.push({
          hoja: i + 1, tubo: m[1].toUpperCase().replace(/\s/g, ''), cable: m[5].toUpperCase(),
          seccion, potencia_w: w, longitud_m: largo, vivienda,
        });
      }
    });
    return fuera;
  }

  /** La especificación de un cable según el texto del presupuesto o del plano (para cruzarlos). */
  private specDeCable(t: string): { tipo: string; conductores: number; seccion: number } | null {
    const limpio = this.limpia(t);
    const tipo = (limpio.match(/\b(ES07Z1-K|ESO7Z1-K|RZ1-K|SZ1-K|H1Z2Z2-K|ES0721-K)\b/) ?? [])[1];
    if (!tipo) return null;
    const multi = limpio.match(/(\d+)X\((\d+)X([\d,]+)\)/);
    if (multi) {
      const n1 = Number(multi[1]);
      const n2 = Number(multi[2]);
      return { tipo: tipo.replace('ESO7Z1-K', 'ES07Z1-K'), conductores: n2 > 1 ? n2 : n1, seccion: this.num(multi[3]) };
    }
    const simple = limpio.match(/(\d+)X([\d,]+)\s*MM2/);
    if (simple) return { tipo: tipo.replace('ESO7Z1-K', 'ES07Z1-K'), conductores: Number(simple[1]), seccion: this.num(simple[2]) };
    return null;
  }

  /**
   * Las desviaciones que se pueden comprobar de verdad. Dos familias:
   *  · las del propio presupuesto (importe que no es cantidad × precio, partidas sin precio,
   *    cantidades con decimales imposibles), y
   *  · el contraste con los planos: la longitud de cada cable del unifilar frente a los metros
   *    de la partida del mismo tipo y sección.
   * Lo que no se puede comprobar, no se inventa: se queda fuera.
   */
  private desviaciones(partidas: Partida[], tramos: { tipo: string; conductores: number; seccion: number; metros: number; hojas: number[] }[]) {
    const fuera: any[] = [];
    for (const p of partidas) {
      const esperado = this.red(p.cantidad * p.precio);
      if (p.precio > 0 && p.importe > 0 && Math.abs(esperado - p.importe) > 0.02) {
        fuera.push({
          tipo: 'importe_no_cuadra', gravedad: 'alta', instalacion: p.instalacion, codigo: p.codigo, partida: p.resumen,
          detalle: `El importe del presupuesto (${p.importe.toFixed(2)} €) no es la cantidad × precio (${esperado.toFixed(2)} €).`,
          etiqueta: 'El importe no cuadra con cantidad × precio',
        });
      }
      if (p.cantidad > 0 && p.precio === 0 && !p.verificacion?.alcance) {
        fuera.push({
          tipo: 'sin_precio', gravedad: 'media', instalacion: p.instalacion, codigo: p.codigo, partida: p.resumen,
          detalle: `Tiene cantidad (${p.cantidad} ${p.unidad}) y precio 0, y no está marcada como no ofertada en el presupuesto: no suma al total.`,
          etiqueta: 'Partida sin precio (no suma al presupuesto)',
        });
      }
      const mil = Math.round(p.cantidad * 1000) / 1000;
      if (p.cantidad > 0 && Math.abs(mil - Math.round(p.cantidad * 100) / 100) > 1e-6) {
        fuera.push({
          tipo: 'decimales_raros', gravedad: 'media', instalacion: p.instalacion, codigo: p.codigo, partida: p.resumen,
          detalle: `Cantidad ${p.cantidad} ${p.unidad}: más decimales de los normales (¿separador de miles o coma mal puesta?).`,
          etiqueta: 'Cantidad con decimales imposibles',
        });
      }
      if (/^UD$/i.test(this.limpia(p.unidad)) && p.cantidad > 0 && Math.abs(p.cantidad - Math.round(p.cantidad)) > 0.05) {
        fuera.push({
          tipo: 'ud_no_entera', gravedad: 'baja', instalacion: p.instalacion, codigo: p.codigo, partida: p.resumen,
          detalle: `Va en unidades pero la cantidad es ${p.cantidad}.`,
          etiqueta: 'Unidades (Ud) con cantidad decimal',
        });
      }
    }

    // Contraste con los planos: mismo tipo de cable y misma sección.
    for (const t of tramos) {
      const partida = partidas.find((p) => {
        const s = this.specDeCable(p.resumen);
        return s && s.tipo === t.tipo && s.conductores === t.conductores && s.seccion === t.seccion && this.limpia(p.unidad) === 'M';
      });
      if (!partida) continue;
      const dif = this.red(t.metros - partida.cantidad);
      const base = Math.max(t.metros, partida.cantidad);
      if (base <= 0 || Math.abs(dif) / base < 0.15) continue;
      fuera.push({
        tipo: 'cantidad_plano_distinta', gravedad: 'media', instalacion: partida.instalacion,
        codigo: partida.codigo, partida: partida.resumen,
        detalle: `${t.tipo} ${t.conductores}x${t.seccion} mm2: el unifilar del plano suma ${this.red(t.metros)} m `
          + `(hoja${t.hojas.length > 1 ? 's' : ''} ${t.hojas.slice(0, 6).join(', ')}) y el presupuesto pone ${this.red(partida.cantidad)} m `
          + `(${dif > 0 ? '+' : ''}${dif} m). Ojo: el plano mide los tramos que declara en el unifilar, así que puede ser una planta o una parte.`,
        etiqueta: 'Los metros del plano no coinciden con el presupuesto',
        esperado: this.red(t.metros), encontrado: this.red(partida.cantidad),
      });
    }
    return fuera;
  }

  private num(v: any): number {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return Number(s) || 0;
  }

  private red(n: number): number { return Math.round(n * 100) / 100; }

  private ruta(id: string, a: ArchivoObra): string {
    return join(process.cwd(), 'uploads', 'homologaciones', id, String(a.fichero));
  }
}

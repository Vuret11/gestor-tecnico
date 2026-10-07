import { CampoMapeado } from './mapeo.types';
import { ContextoMod318 } from './mod-318.types';
import { emisoresDe, regimenCalefaccion, regimenRefrigeracion, tieneRefrigeracion } from '../crm/normativa/demanda.constants';
import { Maquina } from '../crm/tipos';
import { MaquinaConUnidades, maquinasDelContexto, puntoCalefaccionDe } from '../maquina-instalacion';
import { fechaDocumento } from '../fecha-documento';

function puntoEnsayo(maquina: Maquina, condicion: string): Record<string, unknown> | undefined {
  const puntos = (maquina.datosVariante as any)?.puntos_ensayo_EN14511;
  return puntos?.[condicion];
}

/**
 * El punto de ensayo EFECTIVO de un equipo: con fancoils el régimen de calefacción es el de 45 °C y,
 * si esa ficha no publica el punto de 45, se coge el de 55 — el más restrictivo de los que sí están
 * (regla del instalador, 5-oct-2026). La refrigeración (A35W18/A35W7) va tal cual.
 */
function puntoDe(maquina: Maquina, condicion: string): Record<string, unknown> | undefined {
  return condicion === 'A7W45' ? puntoCalefaccionDe(maquina, 'A7W45') : puntoEnsayo(maquina, condicion);
}

/** Equipos de la instalación, uno por unidad física (el impreso tiene una fila por generador). */
function equiposDe(ctx: ContextoMod318): MaquinaConUnidades[] {
  return maquinasDelContexto(ctx);
}

/** Punto de ensayo EN14511 del equipo que ocupa la fila `indice` (0 = Generador 1). */
function puntoEnsayoDe(ctx: ContextoMod318, indice: number, condicion: string): Record<string, unknown> | undefined {
  const equipo = equiposDe(ctx)[indice];
  return equipo ? puntoDe(equipo.maquina, condicion) : undefined;
}

/**
 * Fecha de una prueba efectuada (IT 3.1.8, campo FECHA*). El instalador pidió (29-sep-2026) que sea
 * SIEMPRE la del día en que se hace el documento y la MISMA en todas las casillas de prueba, porque
 * salían en blanco. Si un correo trae una fecha concreta de obra (`datosObra`), esa manda: es un dato
 * real medido en obra y la app no debe sustituirlo por una fecha inventada.
 */
function fechaPrueba(fechaDeObra: string | undefined): string {
  return fechaDeObra?.trim() ? fechaDeObra.trim() : fechaDocumento();
}

/**
 * Valores de prueba que se escriben SIEMPRE (dictados por el instalador el 29-sep-2026), salvo que el
 * correo traiga otros medidos en obra:
 * - circuitos cerrados de agua fría y caliente a Tmax de servicio <100 ºC: Pmáx 3 bar / Pprueba 4,5 bar;
 * - tuberías para ACS: Pmáx 10 bar / Pprueba 15 bar.
 */
export const VALORES_PRUEBA_POR_DEFECTO = {
  pMaxCircuitosCerrados: '3',
  pPruebaCircuitosCerrados: '4,5',
  pMaxTuberiasAcs: '10',
  pPruebaTuberiasAcs: '15',
} as const;

function valorPrueba(valorDeObra: string | undefined, porDefecto: string): string {
  return valorDeObra?.trim() ? valorDeObra.trim() : porDefecto;
}

/**
 * Verificado visualmente contra la plantilla oficial en blanco Y contra un ejemplo real
 * cumplimentado (data/plantillas-legalizacion/mod-318.pdf; el ejemplo real no se versiona,
 * se leyó puntualmente desde Desktop\Lorena\DD). 87 campos totales en el AcroForm real; no
 * todos se mapean — solo los que tienen un dato claro de origen en la app o en datosObra. El
 * resto (autor de proyecto colegiado, generadores de calor por combustión, generadores de ACS
 * 2/3, ...) no aplica a una instalación residencial de aerotermia con una sola bomba de calor
 * y se deja tal cual (sin forzar un valor).
 *
 * DOS CAMPOS CON EL NOMBRE CAMBIADO respecto a su contenido real, confirmado con el ejemplo:
 * 1. El checkbox de tipo de instalación con NOMBRE "VENTILACIÓN" está posicionado donde
 *    visualmente está "AGUA CALIENTE SANITARIA" (2º de 4, entre "ChkBox"=Calefacción y
 *    "ChkBox-0"). El ejemplo real (cliente con calefacción+ACS, sin ventilación) lo tenía
 *    marcado — confirma que hay que tratarlo como ACS, no como ventilación. "ChkBox-0" es el
 *    que de verdad corresponde a Ventilación (3º de 4).
 * 2. "N DE CARNET" y "TIPO DE CARNET" están cruzados: el ejemplo real tenía en "N DE CARNET"
 *    un valor tipo categoría ("ITE") y en "TIPO DE CARNET" un DNI. Se mapean según lo que de
 *    verdad contienen, no según el nombre del campo.
 */
export const MAPEO_MOD_318: CampoMapeado<ContextoMod318>[] = [
  // ---- Tipo de instalación (ver nota 1 sobre el nombre cambiado) ----
  { campoPdf: 'ChkBox', tipo: 'checkbox', obtener: (ctx) => ctx.tieneCalefaccion },
  { campoPdf: 'VENTILACIÓN', tipo: 'checkbox', obtener: (ctx) => ctx.tieneAcsPorBombaDeCalor }, // en realidad = AGUA CALIENTE SANITARIA, ver nota 1

  // ---- Datos de la instalación ----
  { campoPdf: 'SITUACIÓN', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.direccion },
  { campoPdf: 'MUNICIPIO', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'PROVINCIA', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.provincia },
  { campoPdf: 'CP', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },
  { campoPdf: 'Textfield-0', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.nombreRazonSocial }, // TITULAR/USUARIO

  // ---- Empresa instaladora ----
  { campoPdf: 'DENOMINACIÓN', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'N REGISTRO DE EMPRESA INSTALADORA', tipo: 'texto', obtener: (ctx) => ctx.empresa.numeroRegistroEmpresaInstaladora },

  // ---- Instalador/a habilitado/a (ver nota 2 sobre los campos cruzados) ----
  // Etiquetas impresas comprobadas sobre el render de la plantilla: «Nº DE CARNET: …… TIPO DE CARNET: ……»,
  // y las casillas del AcroForm caen cada una donde su etiqueta. El Nº de carnet es el dato que el
  // instalador echaba en falta (30-sep-2026): va `numeroCarne` de la ficha de la persona.
  { campoPdf: 'APELLIDOS Y NOMBRE-0', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.nombre },
  { campoPdf: 'N DE CARNET', tipo: 'texto', obtener: (ctx) => (ctx.instaladorHabilitado?.datosAdicionales as any)?.numeroCarne },
  // TIPO DE CARNET: 'RITE' (dictado del instalador, 30-sep-2026). Antes se escribía aquí el DNI como
  // relleno provisional y era lo único que quedaba sin resolver de este bloque.
  { campoPdf: 'TIPO DE CARNET', tipo: 'texto', obtener: () => 'RITE' },

  // ---- Pruebas efectuadas (fechas, medidas en obra) ----
  // El instalador pidió (29-sep-2026) que las seis pruebas de IT 3.1.8 lleven siempre fecha —la del
  // día del documento— y la misma en todas. Se dejan sin fecha IT 2.2.5 (conductos de aire) e IT 2.2.6
  // (chimeneas) porque no aplican a una instalación de aerotermia; si alguna vez aplican, van abajo.
  { campoPdf: 'FECHA', tipo: 'texto', obtener: (ctx) => fechaPrueba(ctx.datosObra.fechaPruebaEquipos) }, // IT 2.2.1
  { campoPdf: 'FECHA-0', tipo: 'texto', obtener: (ctx) => fechaPrueba(ctx.datosObra.fechaPruebaEstanqueidadTuberiasAgua) }, // IT 2.2.2
  { campoPdf: 'FECHA-1', tipo: 'texto', obtener: (ctx) => fechaPrueba(ctx.datosObra.fechaPruebaEstanqueidadCircuitosFrigorificos) }, // IT 2.2.3
  { campoPdf: 'FECHA-2', tipo: 'texto', obtener: (ctx) => fechaPrueba(ctx.datosObra.fechaPruebaLibreDilatacion) }, // IT 2.2.4
  { campoPdf: 'FECHA-3', tipo: 'texto', obtener: (ctx) => ctx.datosObra.fechaPruebaRecepcionRedesConductosAire }, // IT 2.2.5: no aplica
  { campoPdf: 'FECHA-4', tipo: 'texto', obtener: (ctx) => ctx.datosObra.fechaPruebaEstanqueidadChimeneas }, // IT 2.2.6: no aplica
  { campoPdf: 'FECHA-5', tipo: 'texto', obtener: (ctx) => fechaPrueba(ctx.datosObra.fechaPruebasFinales) }, // IT 2.2.7
  { campoPdf: 'FECHA-6', tipo: 'texto', obtener: (ctx) => fechaPrueba(ctx.datosObra.fechaPruebasEficienciaEnergetica) }, // IT 2.4

  // ---- Valores de pruebas de presión ----
  // Lo que se mide en obra (correo) manda; si no viene, se escribe el valor que dictó el instalador
  // (29-sep-2026) en vez de dejar la casilla vacía. El circuito solar no aplica a aerotermia.
  { campoPdf: '1 pmáx', tipo: 'texto', obtener: (ctx) => valorPrueba(ctx.datosObra.pMaxCircuitosCerrados, VALORES_PRUEBA_POR_DEFECTO.pMaxCircuitosCerrados) },
  { campoPdf: '2 Aprueba', tipo: 'texto', obtener: (ctx) => valorPrueba(ctx.datosObra.pPruebaCircuitosCerrados, VALORES_PRUEBA_POR_DEFECTO.pPruebaCircuitosCerrados) },
  // La fila de las tuberías de ACS solo aplica si la instalación PRODUCE ACS: con «climatización sola»
  // (7-oct-2026) se queda en blanco, porque no se ha probado una red de agua caliente que no existe.
  { campoPdf: '1 pmáx-0', tipo: 'texto', obtener: (ctx) => (ctx.tieneAcsPorBombaDeCalor ? valorPrueba(ctx.datosObra.pMaxTuberiasAcs, VALORES_PRUEBA_POR_DEFECTO.pMaxTuberiasAcs) : undefined) },
  { campoPdf: '2 Aprueba-0', tipo: 'texto', obtener: (ctx) => (ctx.tieneAcsPorBombaDeCalor ? valorPrueba(ctx.datosObra.pPruebaTuberiasAcs, VALORES_PRUEBA_POR_DEFECTO.pPruebaTuberiasAcs) : undefined) },
  { campoPdf: '1 pmáx-1', tipo: 'texto', obtener: (ctx) => ctx.datosObra.pMaxCircuitoSolar }, // circuito 1º solar: no aplica
  { campoPdf: '2 Aprueba-1', tipo: 'texto', obtener: (ctx) => ctx.datosObra.pPruebaCircuitoSolar },

  // ---- Página 2: bloque «RENDIMIENTO» de los generadores de calor y/o frío (filas -2/-3/-4 = Generador
  // 1/2/3). Cabecera "EER al ___% / COP al ___%": el punto de ensayo EN14511 nominal ES el 100%
  // Pnominal. El régimen lo fijan los emisores (regla del instalador, 29-sep-2026): calor A7/W55
  // solo con radiadores (resto A7/W35) y frío A35W18 con suelo radiante, A35W7 con fancoils.
  // Con varias máquinas cada equipo ocupa su fila.
  // Las columnas «medido» (a la derecha) llevan EL MISMO valor que las de la izquierda: lo pidió el
  // instalador el 30-sep-2026 («en la parte de COP y EER medido pon la misma que en la columna de COP
  // y EER, la de la izquierda») — en esta instalación el rendimiento medido en obra es el nominal.
  // El EER solo se declara si la instalación enfría — suelo radiante o fancoils — y va con el MISMO
  // criterio que el MOD-315 (instalador, 6-oct-2026): «si en el 315 no hay EER tampoco en el 318».
  // Con solo radiadores, las casillas de EER (izquierda, derecha y las de «% Pnominal») quedan vacías.
  { campoPdf: 'EER al', tipo: 'texto', obtener: (ctx) => (tieneRefrigeracion(emisoresDe(ctx)) && equiposDe(ctx).slice(0, 3).some((equipo) => puntoDe(equipo.maquina, regimenRefrigeracion(emisoresDe(ctx)))?.EER !== undefined) ? '100' : undefined) },
  { campoPdf: 'C0P al', tipo: 'texto', obtener: (ctx) => (equiposDe(ctx).slice(0, 3).some((equipo) => puntoDe(equipo.maquina, regimenCalefaccion(emisoresDe(ctx)))?.COP !== undefined) ? '100' : undefined) },
  { campoPdf: 'EER medido al', tipo: 'texto', obtener: (ctx) => (tieneRefrigeracion(emisoresDe(ctx)) && equiposDe(ctx).slice(0, 3).some((equipo) => puntoDe(equipo.maquina, regimenRefrigeracion(emisoresDe(ctx)))?.EER !== undefined) ? '100' : undefined) },
  { campoPdf: 'C0P medido al', tipo: 'texto', obtener: (ctx) => (equiposDe(ctx).slice(0, 3).some((equipo) => puntoDe(equipo.maquina, regimenCalefaccion(emisoresDe(ctx)))?.COP !== undefined) ? '100' : undefined) },
  ...Array.from({ length: 3 }, (_, fila) => {
    const eer = (ctx: ContextoMod318) => (tieneRefrigeracion(emisoresDe(ctx)) ? puntoEnsayoDe(ctx, fila, regimenRefrigeracion(emisoresDe(ctx)))?.EER : undefined);
    const cop = (ctx: ContextoMod318) => puntoEnsayoDe(ctx, fila, regimenCalefaccion(emisoresDe(ctx)))?.COP;
    return [
      { campoPdf: `fl100 Pnominal-${2 + fila}`, tipo: 'texto' as const, obtener: (ctx: ContextoMod318) => eer(ctx) },
      { campoPdf: `medido a 100 Pnominal-${2 + fila}`, tipo: 'texto' as const, obtener: (ctx: ContextoMod318) => eer(ctx) },
      { campoPdf: `1130 Pnominal-${2 + fila}`, tipo: 'texto' as const, obtener: (ctx: ContextoMod318) => cop(ctx) },
      { campoPdf: `nmedido a 30 Pnominal-${2 + fila}`, tipo: 'texto' as const, obtener: (ctx: ContextoMod318) => cop(ctx) },
    ];
  }).flat(),

  // ---- Generadores de ACS 1-3 (filas -5/-6/-7): la bomba de calor de cada fila, si produce ACS.
  // La columna del COP lleva el SCOP DHW (el ACS siempre se declara a 55 °C) y la del «COP medido»
  // el mismo valor — el bloque de ACS no tiene EER (una bomba de calor no enfría el ACS), así que las
  // dos columnas de la izquierda se quedan vacías a propósito.
  // OJO: esto dependía de `tieneAcsPorBombaDeCalor`, que salía FALSE cuando el catálogo no publicaba
  // el SCOP DHW: por eso el instalador veía «falta la fila de Generador de ACS1 para el COP».
  ...Array.from({ length: 3 }, (_, fila) => {
    const copAcs = (ctx: ContextoMod318) => (ctx.tieneAcsPorBombaDeCalor ? equiposDe(ctx)[fila]?.maquina.scopDhwMedio : undefined);
    return [
      { campoPdf: `1130 Pnominal-${5 + fila}`, tipo: 'texto' as const, obtener: (ctx: ContextoMod318) => copAcs(ctx) },
      { campoPdf: `nmedido a 30 Pnominal-${5 + fila}`, tipo: 'texto' as const, obtener: (ctx: ContextoMod318) => copAcs(ctx) },
    ];
  }).flat(),

  // ---- Bloque de firma ----
  // Lugar de firma: Madrid, no el municipio del cliente (indicación del instalador, 29-sep-2026).
  // El municipio del cliente sí va donde corresponde: SITUACIÓN/MUNICIPIO/CP de la instalación.
  { campoPdf: 'Textfield-1', tipo: 'texto', obtener: () => 'Madrid' },
  { campoPdf: 'a', tipo: 'texto', obtener: () => String(new Date().getDate()) },
  { campoPdf: 'de', tipo: 'texto', obtener: () => new Date().toLocaleDateString('es-ES', { month: 'long' }) },
  { campoPdf: 'de-0', tipo: 'texto', obtener: () => String(new Date().getFullYear()) },
];

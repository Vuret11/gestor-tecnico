import { CampoMapeado } from './mapeo.types';
import { ContextoIf190 } from './if-190.types';
import { CONTACTO_TRAMITACION } from './datos-fijos';
import { TipoEmisor, emisoresDe, regimenCalefaccion } from '../crm/normativa/demanda.constants';
import {
  buscarGrupoRsif,
  esRefrigeranteFluorado,
  toneladasCO2Equivalente,
} from '../crm/normativa/rsif.constants';
import { Maquina } from '../crm/tipos';
import {
  MaquinaConUnidades,
  cargasPorRefrigeranteTexto,
  maquinasDelContexto,
  potenciaAbsorbidaEnPunto,
  potenciaCompresoresTotalKW,
  tienePuntoEnsayo,
} from '../maquina-instalacion';

/**
 * Punto de ensayo de calefacción COMÚN a todos los equipos — el que manda para la potencia de
 * compresores (que es una suma). Con fancoils es el de 45 °C y, si algún equipo no publica ese punto
 * en su ficha, se cae al de 55 °C, el más restrictivo de los que sí están (regla del instalador,
 * 5-oct-2026: «de un conjunto de emisores se coge el más restrictivo»).
 */
function puntoCalefaccion(ctx: ContextoIf190): string {
  const regimen = regimenCalefaccion(emisoresDe(ctx));
  if (regimen !== 'A7W45') return regimen;
  const todos = equiposDe(ctx).every((equipo) => tienePuntoEnsayo(equipo.maquina, 'A7W45'));
  return todos ? 'A7W45' : 'A7W55';
}

/**
 * Equipos de la instalación, uno por UNIDAD física: el IF-190 se rellena equipo a equipo (cada
 * bomba de calor hermética es su propio sistema de refrigeración), así que «2 unidades del mismo
 * modelo» ocupan dos columnas de la tabla de refrigerantes y dos filas de la de equipos a presión.
 * Con una sola máquina devuelve exactamente esa.
 */
function equiposDe(ctx: ContextoIf190): MaquinaConUnidades[] {
  return maquinasDelContexto(ctx);
}

/** Equipo de la columna o fila indicada (0 = Sistema 1). `undefined` si la instalación tiene menos. */
function equipoDe(ctx: ContextoIf190, indice: number): MaquinaConUnidades | undefined {
  return equiposDe(ctx)[indice];
}

/**
 * Potencia total de accionamiento de los compresores (punto 3, línea de abajo): la SUMA de todos los
 * sistemas. Si a algún equipo le falta el punto de ensayo del régimen se deja en blanco, en vez de
 * declarar una suma parcial que no es la de la instalación (la fila vacía delata cuál falta).
 */
function potenciaCompresoresTotal(ctx: ContextoIf190): number | undefined {
  return potenciaCompresoresTotalKW(equiposDe(ctx), puntoCalefaccion(ctx)) ?? undefined;
}

/**
 * Tabla «Relación de refrigerantes» (punto 2): 6 columnas «Sistema de refrigeración 1-6». Los
 * nombres de los campos NO siguen el orden de la tabla (la columna 2 es Texto122, la 6 es Texto143…),
 * así que van escritos uno a uno tal como salen de medir el rect de cada casilla contra su etiqueta
 * impresa (2026-09-29). Si algún día se cambia la plantilla, hay que volver a medirlo.
 */
const COLUMNAS_REFRIGERANTE = [
  { refrigerante: 'Texto123', grupo: 'Texto125', fluoradoSi: 'Casilla de verificación17', fluoradoNo: 'Casilla de verificación18', carga: 'Texto126', co2: 'Texto127' },
  { refrigerante: 'Texto122', grupo: 'Texto130', fluoradoSi: 'Casilla de verificación19', fluoradoNo: 'Casilla de verificación20', carga: 'Texto129', co2: 'Texto128' },
  { refrigerante: 'Texto121', grupo: 'Texto131', fluoradoSi: 'Casilla de verificación21', fluoradoNo: 'Casilla de verificación22', carga: 'Texto132', co2: 'Texto133' },
  { refrigerante: 'Texto120', grupo: 'Texto136', fluoradoSi: 'Casilla de verificación23', fluoradoNo: 'Casilla de verificación24', carga: 'Texto135', co2: 'Texto134' },
  { refrigerante: 'Texto119', grupo: 'Texto137', fluoradoSi: 'Casilla de verificación25', fluoradoNo: 'Casilla de verificación26', carga: 'Texto138', co2: 'Texto139' },
  { refrigerante: 'Texto143', grupo: 'Texto140', fluoradoSi: 'Casilla de verificación27', fluoradoNo: 'Casilla de verificación28', carga: 'Texto141', co2: 'Texto142' },
];

/**
 * Tabla «3. Compresores»: una fila por sistema de refrigeración (1-4) y, dentro de la fila, 6
 * columnas de compresores (Nº1-Nº6) más «Potencia total por sistema». Medido igual que la tabla de
 * refrigerantes: la fila 1 es 144-149 + total 150, y las siguientes van intercaladas.
 */
const FILAS_COMPRESORES = [
  { primero: 'Texto144', total: 'Texto150' },
  { primero: 'Texto151', total: 'Texto169' },
  { primero: 'Texto152', total: 'Texto170' },
  { primero: 'Texto153', total: 'Texto171' },
];

/**
 * Ancho de la tabla «12. Relación de equipos a presión» (denominación Texto439…454, fabricante
 * Texto470…455): la tabla se deja EN BLANCO (instrucción del instalador, 30-sep-2026), pero las
 * columnas siguen descritas aquí para cuando se retome.
 */
const FILAS_EQUIPOS = 16;


/** Clasificación del RSIF del expediente (la facilita el instalador en el correo y viaja en
 *  Expediente.datosObra): emplazamiento Tipo 1-4, local Categoría A/B/C y sala de máquinas.
 *  Se normaliza aquí para que «tipo 3», «Tipo3» o «3» den lo mismo. */
function clasificacionObra(ctx: ContextoIf190, clave: string): string | null {
  const obra = (ctx.expediente.datosObra ?? {}) as Record<string, unknown>;
  const valor = obra[clave];
  return typeof valor === 'string' ? valor.toLowerCase().replace(/[\s-]/g, '') : null;
}

/**
 * Documento más grande de los cuatro AcroForm (8 páginas, 742 campos), pero el que menos
 * aporta MAPEADO: casi todo el contenido (sistemas de refrigeración 2-6, rejilla de hasta 8
 * compresores individuales, tabla de "Límite de carga para refrigerante" por sala, "Relación
 * de equipos a presión", medidas de seguridad — detectores de fugas, máscaras antigás,
 * extintores) está pensado para instalaciones frigoríficas comerciales/industriales de varios
 * componentes (cámaras frigoríficas, salas de máquinas) — no para una bomba de calor
 * aerotérmica residencial de un solo sistema hermético, que es lo único que dimensiona esta
 * app. Mismo criterio de "no rellenar lo que no se calcula" que en Certificado RSIF.
 *
 * Sin mapear a propósito: bloque "2.- Representante del titular" (solo si el titular no es
 * persona física), "Transportable" del punto 1 (no aplica
 * a una aerotermia fija; Nueva y Modificación/Ampliación SÍ se marcan, ver más abajo),
 * Sistema refrigeración 2-6 y rejilla de compresores individuales (más de un sistema/
 * compresor — no aplica), "4. Cámara o espacio acondicionado" (temperaturas de cámara
 * frigorífica, no aplica a climatización de bienestar — mismo criterio que Certificado RSIF),
 * "10. Medidas de seguridad adicionales" (equipamiento de
 * seguridad específico de la instalación — detectores, máscaras, extintores — no calculado
 * por esta app), "11. Límite de carga para refrigerante" (tabla por sala) y "12. Relación de
 * equipos a presión" (EN BLANCO por instrucción del instalador del 30-sep-2026: es un
 * inventario de componentes a presión que no se calcula; hasta esa fecha se escribía el
 * modelo y el fabricante de la bomba de calor en la fila 1), "Identificación del técnico titulado competente" de la Hoja
 * 7 (alternativa a "profesional frigorista habilitado" — solo se rellena una de las dos, no
 * ambas; "instalador frigorista" es la vía que sigue esta app).
 *
 * Clasificación del RSIF (emplazamientos Tipo 1-4, locales Categoría A/B/C) y sala de máquinas
 * —puntos 6, 7 y 9 de la hoja 4—: dato OBLIGATORIO y distinto en cada expediente, lo facilita el
 * instalador en el correo (clasificacion_emplazamiento / clasificacion_local / sala_maquinas) y
 * viaja en Expediente.datosObra. Los mismos tres datos se imprimen en el certificado RSIF.
 *
 * Los bloques de identidad (Titular/Ubicación/Persona autorizada/Autor de la memoria/Empresa
 * frigorista) repiten el mismo patrón NIF+Apellidos+Nombre+Correo+Dirección(partida en Tipo
 * vía/Nombre vía/Nº/Bloque/Portal/Escalera/Piso/Puerta)+Localidad+Provincia+CP+Teléfonos que
 * MOD-315 — mismo criterio: la dirección completa va en "Nombre vía" (el campo más ancho) y
 * "Primer Apellido"/"Segundo Apellido" no se rellenan (no hay forma fiable de partir un
 * nombre completo). "5.-Datos del autor de la memoria" se asigna al técnico (Salvador): el
 * checklist de la Hoja 2 dice que la Memoria Técnica va "firmada por instalador frigorista...
 * o por técnico titulado competente" — el técnico es el rol más próximo ya modelado.
 */
export const MAPEO_IF_190: CampoMapeado<ContextoIf190>[] = [
  // ---- 1. Titular de la instalación (cliente) ----
  { campoPdf: 'Texto1', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.dniCif },
  { campoPdf: 'Texto4', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.nombreRazonSocial },
  { campoPdf: 'Texto5', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.email },
  { campoPdf: 'Texto7', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.direccion },
  { campoPdf: 'Texto18', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'Texto11', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.provincia },
  { campoPdf: 'Texto13', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },
  { campoPdf: 'Texto17', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.telefono },

  // ---- 3. Datos de la instalación (simplificado, ver nota) ----
  { campoPdf: 'Texto39', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.direccion },
  { campoPdf: 'Texto38', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },
  { campoPdf: 'Texto40', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },

  // ---- 4. Persona autorizada para la tramitación (apoderado) ----
  { campoPdf: 'Texto42', tipo: 'texto', obtener: (ctx) => ctx.apoderado?.dni },
  { campoPdf: 'Texto44', tipo: 'texto', obtener: (ctx) => ctx.apoderado?.nombre },
  // Dirección DESGLOSADA, idéntica a la del punto 4 del MOD-315 (instalador, 2-oct-2026: «en el
  // IF-190 aplícalo también para el 4, 5 y 7»). Antes la dirección larga caía entera en «Nombre vía»
  // y el Tipo de vía, el Nº y el Bloque quedaban en blanco.
  { campoPdf: 'Texto45', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Texto49', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Texto56', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Texto46', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Texto55', tipo: 'texto', obtener: (ctx) => ctx.apoderado?.localidad },
  { campoPdf: 'Texto47', tipo: 'texto', obtener: (ctx) => ctx.apoderado?.provincia },
  { campoPdf: 'Texto53', tipo: 'texto', obtener: (ctx) => ctx.apoderado?.codigoPostal },

  // ---- 5. Datos del autor de la memoria (técnico) ----
  { campoPdf: 'Texto59', tipo: 'texto', obtener: (ctx) => ctx.tecnico.dni },
  { campoPdf: 'Texto61', tipo: 'texto', obtener: (ctx) => ctx.tecnico.nombre },
  // La misma dirección que el punto 4 (instalador, 2-oct-2026).
  { campoPdf: 'Texto62', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Texto66', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Texto76', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Texto63', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Texto74', tipo: 'texto', obtener: (ctx) => ctx.tecnico.localidad },
  { campoPdf: 'Texto65', tipo: 'texto', obtener: (ctx) => ctx.tecnico.provincia },
  { campoPdf: 'Texto68', tipo: 'texto', obtener: (ctx) => ctx.tecnico.codigoPostal },

  // ---- 6. Datos de la empresa frigorista ----
  { campoPdf: 'Texto77', tipo: 'texto', obtener: (ctx) => ctx.empresa.cif },
  { campoPdf: 'Texto79', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'Texto82', tipo: 'texto', obtener: (ctx) => ctx.empresa.email },
  // La misma dirección que los puntos 4 y 5: es la misma empresa y el instalador pidió (2-oct-2026)
  // que la dirección de los bloques de empresa sea la del punto 4 del MOD-315.
  { campoPdf: 'Texto80', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Texto83', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Texto91', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Texto84', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Texto93', tipo: 'texto', obtener: (ctx) => ctx.empresa.localidad },
  { campoPdf: 'Texto86', tipo: 'texto', obtener: (ctx) => ctx.empresa.provincia },
  { campoPdf: 'Texto89', tipo: 'texto', obtener: (ctx) => ctx.empresa.codigoPostal },
  { campoPdf: 'Texto94', tipo: 'texto', obtener: (ctx) => ctx.empresa.telefono },

  // ---- 8. Documentación aportada: se aporta la Memoria Técnica (este mismo documento) ----
  { campoPdf: 'Casilla de verificación3', tipo: 'checkbox', obtener: () => true },

  // ---- 11. Límite de carga para refrigerante (pág. 5): el instalador manda marcarlo SIEMPRE así
  // (6-oct-2026) — cumple la tabla A (Sí), cumple la tabla B (Sí) y NO se aplican medidas de
  // seguridad alternativas (N/A). Las casillas de cada línea van en el orden Si/No/N/A y en el
  // AcroForm son: tabla A → verificación76/77/78, tabla B → 79/80/81 y medidas alternativas →
  // 82/116/117 (comprobado contra el PDF renderizado).
  { campoPdf: 'Casilla de verificación74', tipo: 'checkbox', obtener: () => true }, // casilla previa de la tabla A: también se marca (instalador, 6-oct-2026)
  { campoPdf: 'Casilla de verificación76', tipo: 'checkbox', obtener: () => true }, // tabla A: Sí
  { campoPdf: 'Casilla de verificación75', tipo: 'checkbox', obtener: () => true }, // casilla previa de la tabla B: también se marca
  { campoPdf: 'Casilla de verificación79', tipo: 'checkbox', obtener: () => true }, // tabla B: Sí
  { campoPdf: 'Casilla de verificación117', tipo: 'checkbox', obtener: () => true }, // medidas alternativas: N/A

  // ---- Fecha y lugar (pie página 2) ----
  { campoPdf: 'Texto88', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'Texto114', tipo: 'texto', obtener: () => String(new Date().getDate()) },
  { campoPdf: 'Texto115', tipo: 'texto', obtener: () => new Date().toLocaleDateString('es-ES', { month: 'long' }) },
  { campoPdf: 'Texto116', tipo: 'texto', obtener: () => String(new Date().getFullYear()) },

  // ---- 2. Refrigerante — Sistema de refrigeración 1 (único sistema) ----
  // ---- 1. Tipo de instalación (pág. 3): Nueva / Modificación-Ampliación. Mismo dato que el
  // NUEVA/REFORMA del MOD-315 (esAnteriorRd1027_2007 = campo "reforma: si|no" del correo):
  // true = instalación existente que se modifica/amplía → "Modificación/Ampliación" (y entonces
  // hay que dar el nº de registro, que lo facilita el instalador); false o null ⇒ NUEVA, porque
  // el instalador exige que el tipo nunca quede sin marcar. NO se toca "Transportable" (no aplica
  // a una aerotermia: es la verificación16).
  // OJO — comprobado alineando el rect de cada casilla con la línea de texto del PDF:
  //   verificación14 (y 137-150) = "Nueva" · verificación15 (y 152-166) = "Modificación/Ampliación"
  //   · verificación16 (y 175-190) = "Transportable". No fiarse del nombre: el orden del AcroForm
  //   va desplazado y marcar la 15 pone "Modificación" con un expediente que es nuevo. ----
  { campoPdf: 'Casilla de verificación14', tipo: 'checkbox', obtener: (ctx) => ctx.tipoInstalacion === 'NUEVA' },
  { campoPdf: 'Casilla de verificación15', tipo: 'checkbox', obtener: (ctx) => ctx.tipoInstalacion === 'REFORMA' },
  // Nº de registro de la instalación frigorífica (solo tiene sentido si es modificación): lo da
  // el instalador en el correo.
  { campoPdf: 'Texto117', tipo: 'texto', obtener: (ctx) => (ctx.expediente.datosObra as any)?.registroInstalacionFrigorifica },

  // ---- Tabla "Relación de refrigerantes": 6 columnas (Sistemas 1-6), una por EQUIPO de la
  // instalación. Hasta el 29-sep-2026 se usaba solo la primera; con varias máquinas (regla del
  // instalador) cada unidad ocupa su columna con SU refrigerante, SU carga y SU CO₂, y la línea de
  // abajo — «Carga máxima de la instalación, kg POR REFRIGERANTE» — lleva la suma de cada
  // refrigerante (con dos refrigerantes distintos: «1,3/3,6»). ----
  ...COLUMNAS_REFRIGERANTE.flatMap((columna, indice) => [
    { campoPdf: columna.refrigerante, tipo: 'texto' as const, obtener: (ctx: ContextoIf190) => equipoDe(ctx, indice)?.maquina.refrigerante },
    // Grupo del RSIF (art. 4 del RD 552/2019): L1/L2/L3 — es lo que pide la cabecera "Grupo
    // (L1, A2L)". Antes se ponía el grupo EN 378 (A1/A2L/A3), que no es el que pide el formulario:
    // con el R290 sale L3.
    { campoPdf: columna.grupo, tipo: 'texto' as const, obtener: (ctx: ContextoIf190) => { const m = equipoDe(ctx, indice)?.maquina; return m ? buscarGrupoRsif(m.refrigerante) : undefined; } },
    // "Gas fluorado": el R290/R744 no son fluorados → se marca "no"; los fluorados (R32, R410A…)
    // → "sí". Se marca por columna: en una instalación mixta cada sistema lleva la suya.
    { campoPdf: columna.fluoradoSi, tipo: 'checkbox' as const, obtener: (ctx: ContextoIf190) => esRefrigeranteFluorado(equipoDe(ctx, indice)?.maquina.refrigerante ?? null) === true },
    { campoPdf: columna.fluoradoNo, tipo: 'checkbox' as const, obtener: (ctx: ContextoIf190) => esRefrigeranteFluorado(equipoDe(ctx, indice)?.maquina.refrigerante ?? null) === false },
    { campoPdf: columna.carga, tipo: 'texto' as const, obtener: (ctx: ContextoIf190) => equipoDe(ctx, indice)?.maquina.cargaRefrigeranteKg },
    { campoPdf: columna.co2, tipo: 'texto' as const, obtener: (ctx: ContextoIf190) => { const m = equipoDe(ctx, indice)?.maquina; return m ? toneladasCO2Equivalente(m.refrigerante, m.cargaRefrigeranteKg) : undefined; } },
  ]),
  { campoPdf: 'Texto124', tipo: 'texto', obtener: (ctx) => cargasPorRefrigeranteTexto(equiposDe(ctx)) }, // carga máxima de la instalación (kg por refrigerante)

  // ---- 3. Compresores: una fila por sistema (Sistema 1-4), con la potencia eléctrica del compresor
  // de esa máquina en la columna Nº1 (cada bomba de calor de estas lleva uno) repetida en «Potencia
  // total por sistema», para que la fila cuadre con lo que declara. ----
  ...FILAS_COMPRESORES.flatMap((fila, indice) => {
    const potencia = (ctx: ContextoIf190) => {
      const equipo = equipoDe(ctx, indice);
      return equipo ? potenciaAbsorbidaEnPunto(equipo.maquina, puntoCalefaccion(ctx)) : undefined;
    };
    return [
      { campoPdf: fila.primero, tipo: 'texto' as const, obtener: potencia },
      { campoPdf: fila.total, tipo: 'texto' as const, obtener: potencia },
    ];
  }),
  { campoPdf: 'Texto172', tipo: 'texto', obtener: (ctx) => potenciaCompresoresTotal(ctx) }, // potencia total de accionamiento de compresores (SUMA de todos los sistemas)

  // ---- 5. Finalidad de la instalación: Climatización (supuesto de dominio, ver nota Certificado
  // RSIF). OJO — el nombre del campo NO coincide con el de al lado: alineando el rect de cada
  // casilla con su etiqueta, verificación33 = "Climatización" (x 53.7, texto en x 74.7) y
  // verificación35 = "Fabricación de hielo" (x 267.9, texto en x 290.3). Estaba puesta la 35 y
  // el IF-190 salía marcando ¡Fabricación de hielo! en una vivienda. ----
  { campoPdf: 'Casilla de verificación33', tipo: 'checkbox', obtener: () => true },

  // ---- 6. Clasificación del emplazamiento (Tipo 1-4) y 7. de los locales (Categoría A/B/C) y
  // 9. Sala de máquinas: MISMO dato que el certificado RSIF — obligatorio y distinto en cada
  // expediente, lo manda el instalador en el correo → Expediente.datosObra. Aquí las casillas SÍ
  // van a la izquierda de su etiqueta y en orden natural (verificado con las coordenadas):
  // verificación36-39 = Tipo 1-4 (x 55.5 / 131.7 / 203.0 / 278.4), verificación40-42 =
  // Categoría A/B/C (x 55.9 / 158.3 / 265.6) y verificación52-54 = Específica / Sin sala de
  // máquinas / Al aire libre (x 44.5 / 136.8 / 276.8). ----
  { campoPdf: 'Casilla de verificación36', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo1' },
  { campoPdf: 'Casilla de verificación37', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo2' },
  { campoPdf: 'Casilla de verificación38', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo3' },
  { campoPdf: 'Casilla de verificación39', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo4' },
  { campoPdf: 'Casilla de verificación40', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionLocal') === 'a' },
  { campoPdf: 'Casilla de verificación41', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionLocal') === 'b' },
  { campoPdf: 'Casilla de verificación42', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionLocal') === 'c' },
  { campoPdf: 'Casilla de verificación52', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'salaMaquinas') === 'especifica' },
  { campoPdf: 'Casilla de verificación53', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'salaMaquinas') === 'sinsalademaquinas' },
  { campoPdf: 'Casilla de verificación54', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'salaMaquinas') === 'alairelibre' },

  // ---- 8. Sistema de refrigeración: Directo (supuesto de dominio, ver nota Certificado RSIF).
  // Mismo aviso: verificación43 = "Directo" (x 41.3, texto en x 60.2); la 46 era "Directo de
  // pulverización abierta ventilado" y salía marcada esa. ----
  { campoPdf: 'Casilla de verificación43', tipo: 'checkbox', obtener: () => true },

  // ---- 7. Datos de la empresa instaladora en baja tensión (la misma que en el MOD-315: la parte
  // eléctrica la ejecuta HomeServe). Lo pidió el instalador el 30-sep-2026: «te falta los datos de la
  // empresa instaladora de baja tensión, pon la misma que en el 315».
  // Campos localizados por geometría sobre la capa de texto de la plantilla (hoja 2, bloque
  // «7.-Datos de la empresa instaladora en baja tensión:», y=113-215): el patrón de columnas es el
  // mismo que el bloque 6 (NIF x≈61, Nombre x≈145, Correo x≈409, Nombre vía x≈259, Localidad x≈432,
  // Provincia x≈85, CP x≈216, Teléfono fijo x≈326, Móvil x≈468):
  //   96=NIF, 98=nombre, 110=correo, 105=dirección, 112=localidad, 103=provincia, 104=CP, 108=tel. fijo.
  { campoPdf: 'Texto96', tipo: 'texto', obtener: (ctx) => ctx.empresa.cif },
  { campoPdf: 'Texto98', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'Texto110', tipo: 'texto', obtener: (ctx) => ctx.empresa.email },
  // Punto 7 del IF-190: la misma dirección desglosada que los puntos 4, 5 y 6.
  { campoPdf: 'Texto99', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Texto105', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Texto111', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Texto100', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Texto112', tipo: 'texto', obtener: (ctx) => ctx.empresa.localidad },
  { campoPdf: 'Texto103', tipo: 'texto', obtener: (ctx) => ctx.empresa.provincia },
  { campoPdf: 'Texto104', tipo: 'texto', obtener: (ctx) => ctx.empresa.codigoPostal },
  { campoPdf: 'Texto108', tipo: 'texto', obtener: (ctx) => ctx.empresa.telefono },

  // ---- 12. Relación de equipos a presión: SE DEJA EN BLANCO (instrucción del instalador,
  // 30-sep-2026: «y en el punto 12 déjalo vacío»). Estuvo mapeada la fila 1 con el modelo y el
  // fabricante de la bomba de calor (decisión del 2026-09-22, ya revocada): en el PDF del expediente
  // 48 salía la máquina declarada en un inventario de equipos a presión que no se calcula. ----

  // ---- Hoja 7: firma — Identificación del profesional frigorista habilitado (técnico) ----
  { campoPdf: 'Texto615', tipo: 'texto', obtener: (ctx) => ctx.tecnico.nombre },
  { campoPdf: 'Texto616', tipo: 'texto', obtener: (ctx) => ctx.tecnico.dni },
  { campoPdf: 'Texto617', tipo: 'texto', obtener: () => new Date().toLocaleDateString('es-ES') },
];

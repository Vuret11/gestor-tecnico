import { CampoMapeado } from './mapeo.types';
import { ContextoCertificadoRsif } from './certificado-rsif.types';
import { DIRECCION_EMPRESA_UNA_LINEA } from './datos-fijos';
import { TipoEmisor, emisoresDe, regimenCalefaccion } from '../crm/normativa/demanda.constants';
import {
  MaquinaConUnidades,
  cargasPorRefrigeranteTexto,
  gruposSeguridadTexto,
  maquinasDelContexto,
  potenciaCompresoresTotalKW,
  refrigerantesTexto,
  tienePuntoEnsayo,
  totalesInstalacion,
} from '../maquina-instalacion';

/** Equipos de la instalación, uno por unidad física (los datos del RSIF son de conjunto). */
function equiposDe(ctx: ContextoCertificadoRsif): MaquinaConUnidades[] {
  return maquinasDelContexto(ctx);
}

/**
 * Punto de ensayo de calefacción COMÚN a todos los equipos — el que manda para la potencia de
 * compresores (que es una suma). Con fancoils es el de 45 °C y, si algún equipo no publica ese punto
 * en su ficha, se cae al de 55 °C, que es el más restrictivo de los que sí están (regla del
 * instalador, 5-oct-2026: «de un conjunto de emisores se coge el más restrictivo»).
 */
function puntoCalefaccion(ctx: ContextoCertificadoRsif): string {
  const regimen = regimenCalefaccion(emisoresDe(ctx));
  if (regimen !== 'A7W45') return regimen;
  const todos = equiposDe(ctx).every((equipo) => tienePuntoEnsayo(equipo.maquina, 'A7W45'));
  return todos ? 'A7W45' : 'A7W55';
}

/**
 * Dato de clasificación que facilita el instalador y viaja en `datosObra` (forma libre, sin
 * tocar el esquema): `clasificacionEmplazamiento` = tipo1|tipo2|tipo3|tipo4,
 * `clasificacionLocal` = a|b|c, `salaMaquinas` = especifica|sinsalademaquinas|alairelibre (estos
 * últimos, tal cual los manda el panel: se normalizan acentos, espacios y guiones antes de comparar).
 * Sin dato → la casilla se queda vacía (no se adivina: es un dato obligatorio del expediente).
 */
function clasificacionObra(ctx: ContextoCertificadoRsif, clave: string): string | null {
  const obra = (ctx.expediente.datosObra ?? {}) as Record<string, unknown>;
  const valor = obra[clave];
  if (typeof valor !== 'string') return null;
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]/g, '');
}

/**
 * Verificado contra la plantilla oficial en blanco (3 hojas) Y contra un ejemplo real
 * cumplimentado. 235 campos totales en el AcroForm; se mapean los que tienen un dato claro
 * de origen — el resto (sección PROYECTO/DIRECCIÓN TÉCNICA "si procede", solo aplica a
 * instalaciones Nivel 2; la gran tabla de "Declaraciones de conformidad de equipos de
 * presión" de la Hoja 2, pensada para instalaciones con varios componentes a presión
 * declarados por separado; clasificación de emplazamientos/locales por tamaño de recinto;
 * "Cámaras o espacio acondicionado" — la propia plantilla dice "No se rellena en el caso de
 * climatización de bienestar", que es justo nuestro caso) se deja sin mapear.
 *
 * SIMPLIFICACIÓN: "Dirección fiscal" (bloque TITULAR) y "Dirección de la instalación" (bloque
 * EMPLAZAMIENTO) son dos campos distintos en el formulario real, pero Expediente.datosCliente
 * solo guarda una dirección — se usa la misma en los dos bloques. Correcto para el caso
 * habitual (particular que instala en su propia vivienda); si en el futuro hace falta
 * distinguirlas, hay que añadir un segundo bloque de dirección al expediente.
 *
 * DOS SUPUESTOS DE DOMINIO (no de instalación concreta, son ciertos para cualquier bomba de
 * calor aerotérmica split/monobloc de este catálogo, no una adivinanza por expediente):
 * - "Sistema de refrigeración: Directo" — las bombas de calor de este catálogo son de
 *   expansión directa (el refrigerante circula directo al intercambiador, sin circuito
 *   secundario de salmuera/glicol) — así están ensayadas (EN14511 mide directamente en el
 *   lado de refrigerante, no en un circuito secundario).
 * - "Finalidad de la instalación: Climatización" — es lo único que dimensiona esta app.
 */
export const MAPEO_CERTIFICADO_RSIF: CampoMapeado<ContextoCertificadoRsif>[] = [
  // ---- Hoja 1: profesional frigorista habilitado + empresa ----
  { campoPdf: 'Texto2', tipo: 'texto', obtener: (ctx) => ctx.tecnico.nombre },
  { campoPdf: 'Texto3', tipo: 'texto', obtener: (ctx) => ctx.tecnico.dni },
  { campoPdf: 'Texto4', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'Texto5', tipo: 'texto', obtener: (ctx) => ctx.empresa.cif },
  { campoPdf: 'Texto6', tipo: 'texto', obtener: () => new Date().toLocaleDateString('es-ES') }, // fecha a partir de la cual está en condiciones de ser reconocida

  // ---- Titular de la instalación ----
  { campoPdf: 'Texto8', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.nombreRazonSocial },
  { campoPdf: 'Texto9', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.dniCif },
  { campoPdf: 'Texto10', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.direccion }, // dirección fiscal (ver nota de simplificación)
  { campoPdf: 'Texto11', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'Texto12', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.provincia },
  { campoPdf: 'Texto13', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },
  { campoPdf: 'Texto14', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.telefono },
  { campoPdf: 'Texto15', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.email },

  // ---- Emplazamiento de la instalación (ver nota de simplificación) ----
  { campoPdf: 'Texto16', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.direccion },
  { campoPdf: 'Texto17', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'Texto18', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },
  { campoPdf: 'Texto19', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.provincia },
  { campoPdf: 'Texto20', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.telefono },

  // ---- Empresa frigorista habilitada ----
  { campoPdf: 'Texto31', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'Texto32', tipo: 'texto', obtener: (ctx) => ctx.empresa.cif },
  { campoPdf: 'Texto33', tipo: 'texto', obtener: (ctx) => ctx.empresa.numeroRegistroEmpresaInstaladora },
  // Dirección de la empresa frigorista en UNA línea (instalador, 2-oct-2026: «en el certificado RSIF,
  // en la dirección empresa frigorista, deja solo: Paseo del Club Deportivo 1, Edif 12»). Antes iba la
  // dirección fiscal completa del CRM («Calle Parque Empresarial La Finca, Paseo del Club Deportivo
  // S/N, Edificio 12»), que en este impreso se sale de la casilla.
  { campoPdf: 'Texto34', tipo: 'texto', obtener: () => DIRECCION_EMPRESA_UNA_LINEA },
  { campoPdf: 'Texto35', tipo: 'texto', obtener: (ctx) => ctx.empresa.localidad },
  { campoPdf: 'Texto36', tipo: 'texto', obtener: (ctx) => ctx.empresa.provincia },
  { campoPdf: 'Texto37', tipo: 'texto', obtener: (ctx) => ctx.empresa.codigoPostal },
  { campoPdf: 'Texto38', tipo: 'texto', obtener: (ctx) => ctx.empresa.telefono },
  { campoPdf: 'Texto39', tipo: 'texto', obtener: (ctx) => ctx.empresa.email },

  // ---- Entidad de inspección y control (OCA) ----
  { campoPdf: 'Texto1', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosOca?.nombre },
  { campoPdf: 'Texto27', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosOca?.cif },

  // ---- Hoja 2: datos de la instalación ----
  { campoPdf: 'Texto42', tipo: 'texto', obtener: () => new Date().toLocaleDateString('es-ES') }, // fecha primera puesta en servicio
  { campoPdf: 'Texto44', tipo: 'texto', obtener: (ctx) => totalesInstalacion(equiposDe(ctx)).potenciaFrigorificaKW }, // capacidad frigorífica total (kW, suma con varias máquinas)

  // ---- Hoja 3: compresores ----
  // «Potencia total de accionamiento (kW)»: el instalador manda poner ahí la POTENCIA TOTAL DE LAS
  // MÁQUINAS (6-oct-2026), que es la suma de la potencia calorífica nominal — la misma cifra que el
  // «Potencia Nominal Total de las Bombas de Calor» del MOD-315.
  { campoPdf: 'Texto193', tipo: 'texto', obtener: (ctx) => totalesInstalacion(equiposDe(ctx)).potenciaCalorificaKW },
  // «Potencia máxima absorbida por el compresor (kW)»: esta sí es la absorbida (nominal ÷ COP).
  { campoPdf: 'Texto194', tipo: 'texto', obtener: (ctx) => potenciaCompresoresTotalKW(equiposDe(ctx), puntoCalefaccion(ctx)) },

  // ---- Sistema de refrigeración: Directo (ver nota de supuesto de dominio) ----
  { campoPdf: 'Casilla de verificación11', tipo: 'checkbox', obtener: () => true },

  // ---- Hoja 2: CLASIFICACIÓN DE LOS EMPLAZAMIENTOS (Tipo 1-4) y DE LOS LOCALES
  // (Categoría A/B/C), y hoja 3: SALA DE MÁQUINAS — dato OBLIGATORIO que facilita el instalador
  // (2026-09-22); el programa no lo deduce. Ojo: en el AcroForm las casillas van en otro orden
  // que en el impreso (comprobado sobre el PDF renderizado): Tipo 1 = verificación1,
  // Tipo 2 = verificación3, Tipo 3 = verificación2, Tipo 4 = verificación4; Categoría A = 5,
  // B = 6, C = 7; Específica = 8, Sin sala de máquinas = 9, Al aire libre = 10. ----
  { campoPdf: 'Casilla de verificación1', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo1' },
  { campoPdf: 'Casilla de verificación3', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo2' },
  { campoPdf: 'Casilla de verificación2', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo3' },
  { campoPdf: 'Casilla de verificación4', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionEmplazamiento') === 'tipo4' },
  { campoPdf: 'Casilla de verificación5', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionLocal') === 'a' },
  { campoPdf: 'Casilla de verificación6', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionLocal') === 'b' },
  { campoPdf: 'Casilla de verificación7', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'clasificacionLocal') === 'c' },
  { campoPdf: 'Casilla de verificación8', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'salaMaquinas') === 'especifica' },
  { campoPdf: 'Casilla de verificación9', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'salaMaquinas') === 'sinsalademaquinas' },
  { campoPdf: 'Casilla de verificación10', tipo: 'checkbox', obtener: (ctx) => clasificacionObra(ctx, 'salaMaquinas') === 'alairelibre' },

  // ---- Refrigerante (primario) ----
  // "Grupo de refrigerante" (hoja 3, columna PRIMARIO). El instalador corrigió el 30-sep-2026 que
  // aquí va la CLASE DE SEGURIDAD del refrigerante («R32 es A2L, cuidado con esto») y no el nivel
  // L1/L2/L3, así que se declara con `gruposSeguridadTexto`. Ojo: en el Anexo I del RD 552/2019 el
  // grupo L2 es el que engloba a los A2L — si algún día el organismo exige el nivel reglamentario en
  // esta casilla, se cambia aquí por `gruposRsifTexto` y listo (una línea).
  // Con varias máquinas y refrigerantes distintos se declaran TODOS («R32/R290»), la carga se da por
  // refrigerante («1,3/3,6») y la clase, las distintas («A2L/A3») — regla del instalador 29-sep-2026.
  { campoPdf: 'Texto195', tipo: 'texto', obtener: (ctx) => gruposSeguridadTexto(equiposDe(ctx)) },
  { campoPdf: 'Texto196', tipo: 'texto', obtener: (ctx) => refrigerantesTexto(equiposDe(ctx)) },
  { campoPdf: 'Texto197', tipo: 'texto', obtener: (ctx) => cargasPorRefrigeranteTexto(equiposDe(ctx)) },

  // ---- Finalidad: Climatización (ver nota de supuesto de dominio) ----
  { campoPdf: 'Casilla de verificación21', tipo: 'checkbox', obtener: () => true },

  // ---- Categoría de la instalación: Nivel 1, requiere memoria técnica ----
  { campoPdf: 'Casilla de verificación27', tipo: 'checkbox', obtener: (ctx) => ctx.requiereMemoriaTecnica === true },
];

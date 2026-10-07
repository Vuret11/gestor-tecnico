import { CampoMapeado } from './mapeo.types';
import { ContextoMod315 } from './mod-315.types';
import { CONTACTO_TRAMITACION } from './datos-fijos';
import { TipoEdificio } from '../crm/normativa/dbhe4.types';
import { TipoEmisor, emisoresDe, factorCargaResumenWm2, regimenCalefaccion, regimenRefrigeracion, tieneRefrigeracion } from '../crm/normativa/demanda.constants';
import { puntoCalefaccionDe } from '../maquina-instalacion';
import {
  buscarGrupoRsif,
  clasificacionRefrigeranteImpreso,
  esRefrigeranteFluorado,
} from '../crm/normativa/rsif.constants';
import { energiaPrimariaEstimadaKWh } from '../crm/normativa/consumo-anual.constants';
import { Maquina } from '../crm/tipos';
import { ambitoPotenciaMod315 } from '../crm/normativa/legalizacion.constants';
import { fechaDocumento } from '../fecha-documento';
import { numeroEspanol } from '../pdf-lib-form-filler';
import {
  MaquinaConUnidades,
  TotalesInstalacion,
  maximoPorMaquina,
  refrigerantesTexto,
  sumaPorMaquina,
  toneladasCO2Texto,
  totalesInstalacion,
  valoresPorMaquina,
} from '../maquina-instalacion';

function puntoEnsayoMaquina(maquina: Maquina, condicion: string): Record<string, unknown> | undefined {
  const puntos = (maquina.datosVariante as any)?.puntos_ensayo_EN14511;
  return puntos?.[condicion];
}
function numerico(valor: unknown): number | undefined {
  return typeof valor === 'number' ? valor : undefined;
}

/**
 * Máquinas de la instalación con sus unidades. Los servicios siempre rellenan `ctx.maquinas`; el
 * respaldo (una sola máquina) es para los contextos construidos a mano en los tests y deja el
 * comportamiento de siempre: una máquina = exactamente lo mismo que antes de admitir varias.
 */
function maquinasDe(ctx: ContextoMod315): MaquinaConUnidades[] {
  return ctx.maquinas && ctx.maquinas.length > 0 ? ctx.maquinas : [{ maquina: ctx.maquina, unidades: 1 }];
}
function totalesDe(ctx: ContextoMod315): TotalesInstalacion {
  return ctx.totales ?? totalesInstalacion(maquinasDe(ctx));
}

/**
 * Régimen de temperatura de la instalación. Regla del instalador (5-oct-2026): de la combinación de
 * emisores se coge **el más restrictivo** — radiadores 55 °C, fancoils 45 °C (55 si la ficha no
 * publica el de 45) y suelo radiante 35 °C. Los valores de calefacción del 315 (potencia, ηs, SCOP y
 * COP) se toman de las columnas de ese régimen.
 */
/**
 * ¿La instalación va en alta temperatura? Sí con radiadores (55 °C) y con fancoils (45 °C); solo el
 * suelo radiante (y el resto) va a baja temperatura (35 °C) — regla del instalador, 5-oct-2026.
 */
function regimenAltaTemperatura(ctx: ContextoMod315): boolean {
  return regimenCalefaccion(emisoresDe(ctx)) !== 'A7W35';
}

/**
 * Punto de ensayo EN 14511 de calefacción del régimen de la instalación: A7/W55 con radiadores,
 * A7/W45 con fancoils (o el de 55 si esa ficha no publica el de 45) y A7/W35 con suelo radiante.
 * De toda la combinación de emisores manda el más restrictivo, que lo decide `regimenCalefaccion`.
 */
function puntoCalefaccionMaquina(ctx: ContextoMod315, maquina: Maquina): Record<string, unknown> | undefined {
  return puntoCalefaccionDe(maquina, regimenCalefaccion(emisoresDe(ctx)));
}

/** Punto de ensayo de refrigeración del régimen (EER): agua a 18 °C con suelo radiante, 7 °C con fancoils. */
function puntoRefrigeracionMaquina(ctx: ContextoMod315, maquina: Maquina): Record<string, unknown> | undefined {
  return puntoEnsayoMaquina(maquina, regimenRefrigeracion(emisoresDe(ctx)));
}

/** Potencia calorífica de UNA máquina (kW): la del régimen de la instalación si el catálogo la trae. */
function potenciaCalorificaMaquina(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  if (regimenAltaTemperatura(ctx)) {
    const a55 = numerico(puntoEnsayoMaquina(maquina, 'A7W55')?.potencia_kW);
    if (a55 !== undefined) return a55;
  }
  return numerico(maquina.potenciaCalorificaKW);
}

/**
 * Potencia calorífica TOTAL de la instalación (kW) — SUMA de todas las unidades. Es la potencia que
 * exige el instalador con varias máquinas («en caso de distintas máquinas, sumar potencias
 * resultantes») y la que va en las casillas «Potencia Nominal Total», «potencia térmica nominal
 * total» y «potencia máxima del sistema» de las memorias 1, 2 y 5.
 */
function potenciaCalorificaTotal(ctx: ContextoMod315): number | undefined {
  const suma = sumaPorMaquina(maquinasDe(ctx), (m) => potenciaCalorificaMaquina(ctx, m));
  return suma ?? undefined;
}

/** Potencia del MAYOR generador (kW) — la casilla lo pide así, no la suma. */
function potenciaMayorGenerador(ctx: ContextoMod315): number | undefined {
  const mayor = maximoPorMaquina(maquinasDe(ctx), (m) => potenciaCalorificaMaquina(ctx, m));
  return mayor ?? undefined;
}

/**
 * SCOP estacional (clima medio) de UNA máquina — es la casilla "Rendimiento medio estacional SCOPnet
 * o SCOPdhw de la bomba de calor" y el SCOP con el que se estima el consumo anual.
 */
function scopEstacionalMaquina(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  const dv = (maquina.datosVariante as any) ?? {};
  if (regimenAltaTemperatura(ctx)) {
    return numerico(dv.scop?.['55C_medio']) ?? numerico((maquina as any).scopMedio35C);
  }
  return numerico((maquina as any).scopMedio35C) ?? numerico(dv.scop?.['35C_medio']);
}
function scopEstacional(ctx: ContextoMod315): number | undefined {
  return scopEstacionalMaquina(ctx, ctx.maquina);
}

/**
 * SCOP de clima medio de UNA máquina **según la temperatura de los emisores** (regla del instalador,
 * 6-oct-2026: «el SCOP de clima medio y la temperatura dependiendo de los emisores»): radiadores
 * 55 ºC, suelo radiante 35 ºC y fancoils 45 ºC. El catálogo no publica el SCOP de 45 ºC, así que con
 * fancoils se declara el de 55 ºC, que es el más restrictivo («en caso de que solo haya un valor,
 * coge ese»).
 */
function scopSegunEmisores(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  const dv = (maquina.datosVariante as any) ?? {};
  const de55 = numerico(dv.scop?.['55C_medio']);
  const de35 = numerico(dv.scop?.['35C_medio']) ?? numerico((maquina as any).scopMedio35C);
  // La temperatura la mandan los emisores (instalador, 6-oct-2026): con radiadores el SCOP es el de
  // 55 ºC y con fancoils también el de 55 (las fichas no publican el de 45); el de 35 ºC es el de
  // suelo radiante. Y «si solo te dan un SCOP, coge ese» (6-oct-2026): si la ficha no publica el de
  // la temperatura que toca — las Vaillant aroTHERM plus solo traen el de 35 — se declara el único
  // que haya.
  if (regimenCalefaccion(emisoresDe(ctx)) === 'A7W35') return de35 ?? de55;
  return de55 ?? de35;
}

/** SEER de la máquina con el agua del régimen de refrigeración (18 ºC con suelo, 7 ºC con fancoils). */
function seerDeMaquina(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  const seer = ((maquina.datosVariante as any) ?? {}).seer ?? {};
  return regimenRefrigeracion(emisoresDe(ctx)) === 'A35W18'
    ? numerico(seer.agua_18C)
    : numerico(seer.agua_7C);
}

/**
 * SCOP que se declara en el MOD-315, punto 7 («Rendimiento medio estacional SCOPnet o SCOPdhw de la
 * bomba de calor»): SIEMPRE el de **55 ºC de clima medio** de la ficha del fabricante, el dato «tal
 * cual» de la etiqueta ErP. Dictado del instalador el 30-sep-2026, al revisar los documentos de
 * ANA DE LAS CUEVAS SUAREZ: «en el 315 te has confundido en el SCOP, has puesto el COP; en la ficha
 * técnica viene el dato tal cual, SCOP a 55 ºC temperatura media (3,52)».
 *
 * OJO: NO se usa aquí el SCOP del régimen de los emisores (el de 35 ºC, que en esa máquina es 4,95 y
 * es el mismo número que el COP de A7W35 — por eso parecía un COP). El SCOP del régimen sigue siendo
 * el correcto para ηs (sección 2), que se declara según los emisores.
 */
function scop55MedioMaquina(maquina: Maquina): number | undefined {
  const dv = (maquina.datosVariante as any) ?? {};
  return numerico(dv.scop?.['55C_medio']);
}

/**
 * COP, SCOP y EER de la instalación. Regla del instalador (29-sep-2026): los rendimientos NO se
 * suman — «debes marcar el COP/SCOP/EER y rendimientos de cada máquina si son distintas. Ejemplo:
 * COP: 3,45/4,5». Con una sola máquina, o si todas coinciden, se declara un único valor.
 */
function copDeclarado(ctx: ContextoMod315) {
  return valoresPorMaquina(maquinasDe(ctx), (m) => numerico(puntoCalefaccionMaquina(ctx, m)?.COP)) ?? undefined;
}
function eerDeclarado(ctx: ContextoMod315) {
  // Solo si la instalación enfría (suelo radiante o fancoils): con solo radiadores el EER se deja en
  // blanco, porque no hay nada que enfríe (instalador, 6-oct-2026).
  if (!tieneRefrigeracion(ctx.tipoEmisores)) return undefined;
  return valoresPorMaquina(maquinasDe(ctx), (m) => numerico(puntoRefrigeracionMaquina(ctx, m)?.EER)) ?? undefined;
}
/**
 * Rendimiento Eléctrico Equivalente (EER) del generador de frío de mayor potencia EN % (bloque 3,
 * «Datos Aire Acondicionado»): el EER × 100 («EER × 100» — instalador, 6-oct-2026).
 */
function eerPorcentajeDeclarado(ctx: ContextoMod315) {
  if (!tieneRefrigeracion(ctx.tipoEmisores)) return undefined;
  return (
    valoresPorMaquina(maquinasDe(ctx), (m) => {
      const eer = numerico(puntoRefrigeracionMaquina(ctx, m)?.EER);
      return eer === undefined ? null : Math.round(eer * 100);
    }) ?? undefined
  );
}
/**
 * Rendimiento medio estacional declarado (%) del generador de frío de mayor potencia (bloque 3):
 * «SEER × 100 (%)» — instalador, 6-oct-2026.
 */
function seerDeclarado(ctx: ContextoMod315) {
  if (!tieneRefrigeracion(ctx.tipoEmisores)) return undefined;
  return (
    valoresPorMaquina(maquinasDe(ctx), (m) => {
      const seer = seerDeMaquina(ctx, m);
      return seer === undefined ? null : Math.round(seer * 100);
    }) ?? undefined
  );
}
function scopDeclarado(ctx: ContextoMod315) {
  return (
    valoresPorMaquina(
      maquinasDe(ctx),
      (m) => scop55MedioMaquina(m) ?? scopEstacionalMaquina(ctx, m),
    ) ?? undefined
  );
}

/**
 * Persona autorizada para la tramitación del expediente (bloque 4 del 315) — dictado del instalador
 * el 30-sep-2026: «En el punto 4 pon siempre en Nombre Alejandro, Primer Apellido: Nuñez-Milara y
 * Segundo Apellido: Gomez». Va fijo y no se deduce del nombre del apoderado del CRM, que se guarda
 * en un solo campo y partiría «Nuñez-Milara» mal (dejaría de primer apellido «Núñez»).
 */
const PERSONA_AUTORIZADA = {
  nombre: 'Alejandro',
  primerApellido: 'Nuñez-Milara',
  segundoApellido: 'Gomez',
} as const;

/**
 * OBSERVACIONES (alcance de la reforma) del punto 1 de la memoria. Texto literal del instalador
 * (2-oct-2026): «dependiendo de si es una u otra escribir en observaciones lo siguiente:
 *  - NUEVA: INSTALACIÓN AEROTERMIA (o GEOTERMÍA si es el caso, nunca ambas)
 *  - REFORMA: REFORMA DE CAMBIO DE CALDERA A AEROTERMIA SIN MODIFICACIÓN DE INSTALACIÓN INTERIOR».
 */
function observacionesPunto1(ctx: ContextoMod315): string {
  // Aire acondicionado (climatización sola): ni aerotermia ni geotermia. Lo pidió Salva el 7-oct-2026
  // con las anotaciones de Ariel en el impreso: «En observaciones: INSTALACIÓN NUEVA AIRE
  // ACONDICIONADO».
  if (ctx.esAireAcondicionado) {
    return ctx.tipoInstalacion === 'REFORMA'
      ? 'REFORMA DE INSTALACIÓN DE AIRE ACONDICIONADO'
      : 'INSTALACIÓN NUEVA AIRE ACONDICIONADO';
  }
  if (ctx.tipoInstalacion === 'REFORMA') {
    return 'REFORMA DE CAMBIO DE CALDERA A AEROTERMIA SIN MODIFICACIÓN DE INSTALACIÓN INTERIOR';
  }
  return ctx.tipoEnergia === 'GEOTERMIA' ? 'INSTALACIÓN GEOTERMÍA' : 'INSTALACIÓN AEROTERMIA';
}

/**
 * Un dato del BLOQUE DE ACS del impreso, pero **solo si la instalación produce ACS con la bomba de
 * calor**. Con el uso «climatización sola, sin ACS» (añadido el 7-oct-2026) ese bloque entero va EN
 * BLANCO: su potencia, su rendimiento, su volumen de acumulación, su demanda diaria y el Qusable/Eres
 * salen de la demanda de ACS del CTE, y declararlos en una instalación que no tiene ACS sería firmar
 * un dato falso. Las casillas de ACS (secciones 1, 5 y 7) ya van sin marcar por el mismo dato
 * (`tieneAcsPorBombaDeCalor`). El resto del impreso (calefacción, bomba de calor, circuito
 * frigorífico, emisores…) no cambia.
 */
function siProduceAcs<T>(ctx: ContextoMod315, valor: T | null | undefined): T | undefined {
  return ctx.tieneAcsPorBombaDeCalor ? (valor ?? undefined) : undefined;
}

/**
 * «CCAA expide carné» del instalador (bloque 5, casilla `N carné-0`, junto a «Nº carné») — valor fijo
 * dictado por el instalador el 30-sep-2026.
 */
const CARNET_CCAA = 'DGI MADRID';

/**
 * Memoria 11, tabla «AISLAMIENTO TÉRMICO» → fila «TUBERÍAS Y ACCESORIOS» (dictado del instalador,
 * 30-sep-2026): la columna MATERIAL DE AISLAMIENTO lleva ARMAFLEX ELASTOMERICA y la de ESPESOR DEL
 * AISLAMIENTO, S/NORMATIVA. Las filas CONDUCTOS, REDES ENTERRADAS y CHIMENEAS se quedan en blanco.
 */
const AISLAMIENTO_TUBERIAS = {
  material: 'ARMAFLEX ELASTOMERICA',
  espesor: 'S/NORMATIVA',
} as const;

/**
 * Memoria 11, «SISTEMA DE DISTRIBUCIÓN» (dictado del instalador, 30-sep-2026): tubería MULTICAPA con
 * secciones de 48,3 y 26,7 mm² y distribución BITUBO. Los «equipos terminales» son los emisores de la
 * instalación (suelo radiante, fancoils...), no una constante.
 */
const DISTRIBUCION = {
  tipoTuberia: 'Multicapa',
  seccionMaxima: 48.3,
  seccionMinima: 26.7,
} as const;

/**
 * Nombre comercial del emisor tal como se imprime en «EQUIPOS TERMINALES» (memoria 11) y en el
 * resumen de cargas. El instalador lo pidió el 30-sep-2026: «pon los emisores que tengamos, ejemplo
 * Suelo Radiante; si tenemos varios, Suelo Radiante y FanCoils».
 */
const NOMBRE_EMISOR: Record<TipoEmisor, string> = {
  [TipoEmisor.SUELO_RADIANTE]: 'Suelo Radiante',
  [TipoEmisor.RADIADORES]: 'Radiadores',
  [TipoEmisor.FAN_COIL]: 'FanCoils',
  [TipoEmisor.CONDUCTOS]: 'Conductos de aire',
  [TipoEmisor.EXPANSION_DIRECTA]: 'Expansión directa',
  [TipoEmisor.OTROS]: 'Otros',
};

/**
 * «EQUIPOS TERMINALES»: los emisores de la instalación, uno o varios («Suelo Radiante y FanCoils»).
 * Sin emisores declarados en el expediente no se escribe nada.
 */
function equiposTerminales(ctx: ContextoMod315): string | undefined {
  const nombres = [...new Set((ctx.tipoEmisores ?? []).map((e) => NOMBRE_EMISOR[e] ?? e))];
  if (nombres.length === 0) return undefined;
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * Trozo de la dirección del cliente que va en su casilla del formulario (puntos 1 y 3). El instalador
 * la manda troceada desde el 30-sep-2026; si un trozo no viene, su casilla queda vacía (nunca se
 * adivina por regex sobre la dirección completa — es frágil y ya se decidió no hacerlo).
 */
function parteDireccion(
  ctx: ContextoMod315,
  parte: 'tipoVia' | 'numero' | 'bloque' | 'portal' | 'escalera' | 'piso' | 'puerta',
): string | undefined {
  const valor = (ctx.expediente.datosCliente as Record<string, unknown> | null | undefined)?.[parte];
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;
}

/**
 * Casilla del NOMBRE DE LA VÍA: cuando el instalador manda la dirección troceada (30-sep-2026),
 * `direccion` trae solo el nombre de la vía; si manda la dirección entera, va aquí completa — que es
 * como se rellenaba antes.
 */
function nombreVia(ctx: ContextoMod315): string | undefined {
  return ctx.expediente.datosCliente?.direccion || undefined;
}

/**
 * Emplazamiento del generador (memoria 11: «EMPLAZAMIENTO DEL GENERADOR ☐ INTERIOR ☐ EXTERIOR») —
 * dato de obra que facilita el instalador; se marca una casilla u otra y, sin dato, ninguna.
 */
function emplazamientoGenerador(ctx: ContextoMod315): 'interior' | 'exterior' | null {
  const obra = (ctx.expediente.datosObra ?? {}) as Record<string, unknown>;
  const valor = obra['emplazamientoGenerador'];
  if (typeof valor !== 'string') return null;
  const v = valor.trim().toLowerCase();
  if (v.startsWith('int')) return 'interior';
  if (v.startsWith('ext') || v.startsWith('alaire')) return 'exterior';
  return null;
}

/**
 * Texto fijo de la "justificación del cumplimiento de exigencias de bienestar térmico,
 * eficiencia energética y seguridad" (memoria, página 11) — dictado por el instalador el
 * 2026-09-22. Es el mismo en todas las instalaciones.
 */
const JUSTIFICACION_CUMPLIMIENTO = [
  'La instalación cumple con:',
  '- IT 1.1 Exigencias de bienestar e higiene.',
  '- IT 1.2 Exigencias de eficiencia energética.',
  '- IT 1.3 Exigencias de seguridad.',
  'Del RITE.',
].join('\n');

/**
 * El titular es una empresa/entidad → todo el texto va a "Nombre/Razón Social" y los apellidos
 * se quedan vacíos (una razón social no tiene apellidos).
 */
const SUFIJOS_ENTIDAD =
  /\b(s\.?l\.?u?|s\.?a\.?|s\.?c\.?|s\.?c\.?p\.?|c\.?b\.?|sat|sociedad|comunidad(?:\s+de\s+propietarios)?|cooperativa|asociaci[oó]n|fundaci[oó]n|ayuntamiento|diputaci[oó]n|herederos|promociones|inmobiliaria|patrimonial)\b/i;

/**
 * Parte "Nombre Apellido1 Apellido2" en los tres trozos que pide el formulario (el instalador
 * pidió el 2026-09-22 rellenar también los apellidos, que antes se dejaban vacíos). Se asume que
 * las DOS últimas palabras son los apellidos, que es lo habitual en España. Los nombres
 * compuestos del tipo "José María Pérez" no se aciertan siempre: el instalador revisa el PDF
 * antes de presentarlo, y por eso NO se inventa nada cuando parece una empresa.
 */
function partirNombre(completo: string | null | undefined): {
  nombre: string;
  apellido1: string;
  apellido2: string;
} {
  const texto = (completo ?? '').trim().replace(/\s+/g, ' ');
  if (!texto) return { nombre: '', apellido1: '', apellido2: '' };
  if (SUFIJOS_ENTIDAD.test(texto)) return { nombre: texto, apellido1: '', apellido2: '' };
  const partes = texto.split(' ');
  if (partes.length === 1) return { nombre: partes[0], apellido1: '', apellido2: '' };
  if (partes.length === 2) return { nombre: partes[0], apellido1: partes[1], apellido2: '' };
  return {
    nombre: partes.slice(0, -2).join(' '),
    apellido1: partes[partes.length - 2],
    apellido2: partes[partes.length - 1],
  };
}

/**
 * Potencia absorbida (eléctrica) en el punto nominal A7/W35 — la que piden el certificado RSIF
 * ("potencia total de accionamiento" y "máxima absorbida por el compresor") y el punto 10 del
 * MOD-315 ("potencia total en compresores").
 *
 * Se calcula como potencia calorífica NOMINAL / COP(A7/W35) usando la potencia nominal del equipo
 * (la misma que declara la casilla "Potencia Nominal Total de las Bombas de Calor"), no la potencia
 * que el catálogo traiga para ese punto: el manual de la gama GeniaAir Max ES publica un A7/W35
 * incoherente con su propio rango mín/máx (7,43 kW frente a 2,48…14,90 kW — ver
 * `aviso_potencia_A7W35` en data/maquinas/saunier_duval.json); con la nominal (15 kW) y el COP
 * (5,22) sale 2,87 kW, coherente con la potencia de compresores esperada para esa máquina.
 * Si no hay COP ni potencia nominal, se usa el valor derivado del catálogo como último recurso.
 */
function potenciaAbsorbidaMaquina(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  const cop = numerico(puntoCalefaccionMaquina(ctx, maquina)?.COP);
  const potenciaNominalKW = potenciaCalorificaMaquina(ctx, maquina);
  if (cop !== undefined && cop > 0 && potenciaNominalKW !== undefined) {
    return Math.round((potenciaNominalKW / cop) * 100) / 100;
  }
  return numerico(puntoCalefaccionMaquina(ctx, maquina)?.potencia_absorbida_kW);
}

/**
 * Potencia total en compresores de la instalación (kW) — SUMA por máquina y unidades. El instalador
 * lo pidió explícito para el IF-190 («en el punto 3: igual, se pone en cada columna el valor de la
 * potencia eléctrica del compresor de cada máquina, y en el total la suma»); aquí se declara el
 * total, que es lo que pide la casilla del punto 10 del 315.
 */
function potenciaAbsorbidaTotal(ctx: ContextoMod315): number | undefined {
  const suma = sumaPorMaquina(maquinasDe(ctx), (m) => potenciaAbsorbidaMaquina(ctx, m));
  return suma ?? undefined;
}

/**
 * Rendimiento medio estacional declarado (%) del generador de calor de mayor potencia (bloque 2).
 *
 * Regla del instalador (6-oct-2026): «SCOP × 100 (%)», con el SCOP de **clima medio** y la
 * temperatura según los emisores. Como el catálogo no publica el SCOP a 45 ºC (el de los fancoils),
 * en ese caso se coge el de 55 ºC, que es el más restrictivo de los dos («en caso de que solo haya
 * un valor, coge ese»).
 */
function etaSMaquina(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  const scop = scopSegunEmisores(ctx, maquina);
  return scop === undefined ? undefined : Math.round(scop * 100);
}
/** Rendimiento medio estacional declarado (%) de la instalación — por máquina si difieren. */
function etaSDeclarado(ctx: ContextoMod315) {
  return valoresPorMaquina(maquinasDe(ctx), (m) => etaSMaquina(ctx, m)) ?? undefined;
}

/**
 * Rendimiento instantáneo máximo del generador de calor de mayor potencia (%) (bloque 2).
 *
 * Regla del instalador (6-oct-2026): «COP × 100 (%)», con el COP que corresponda por temperatura de
 * los emisores (el mismo que se declara en la casilla COP).
 */
/** Rendimiento instantáneo máximo de la instalación (%) — por máquina si difieren. */
function rendimientoInstantaneoDeclarado(ctx: ContextoMod315) {
  return (
    valoresPorMaquina(maquinasDe(ctx), (m) => {
      const cop = numerico(puntoCalefaccionMaquina(ctx, m)?.COP);
      return cop === undefined ? null : Math.round(cop * 100);
    }) ?? undefined
  );
}

/** Grupos RSIF y de seguridad de TODOS los refrigerantes de la instalación (unión) — con R32/R290 quedan marcados los dos. */
function algunGrupoRsif(ctx: ContextoMod315, grupo: string): boolean {
  return maquinasDe(ctx).some(({ maquina }) => buscarGrupoRsif(maquina.refrigerante) === grupo);
}
/**
 * Clasificación del refrigerante tal como se declara en el 315: una sola casilla de L1/L2/L3/A2L
 * (regla del instalador del 30-sep-2026, ver `clasificacionRefrigeranteImpreso`).
 */
function algunGrupoSeguridad(ctx: ContextoMod315, grupo: string): boolean {
  return maquinasDe(ctx).some(({ maquina }) => clasificacionRefrigeranteImpreso(maquina.refrigerante) === grupo);
}

/**
 * «Refrigerante fluorado: Sí/No» con varios refrigerantes: Sí si ALGUNO lo es (el R290 no lo es, el
 * R32 sí); No solo si ninguno lo es. null si no hay dato en ninguna máquina.
 */
function refrigeranteFluoradoDeclarado(ctx: ContextoMod315): boolean | null {
  const valores = maquinasDe(ctx)
    .map(({ maquina }) => esRefrigeranteFluorado(maquina.refrigerante))
    .filter((valor): valor is boolean => valor !== null);
  return valores.length === 0 ? null : valores.some(Boolean);
}

/** Refrigerantes de la instalación: «R32/R290» si hay más de uno; si no, el de la máquina. */
function refrigeranteDeclarado(ctx: ContextoMod315): string | null {
  return refrigerantesTexto(maquinasDe(ctx)) ?? ctx.maquina.refrigerante;
}

/**
 * Rendimiento medio estacional del sistema de producción renovable de ACS (%).
 *
 * 1º ηwh de la etiqueta ErP (`acs.eta_wh_acs_medio`, o en las gamas antiguas en
 * `rendimiento_etiqueta_ErP`); puede venir como "144 %" o como 144.
 * 2º Si el catálogo no la trae (no la trae ninguna gama hoy), se calcula con la definición del
 * Reglamento (UE) 811/2013 — ηwh(%) = SCOPdhw / 2,5 × 100 — usando el SCOP DHW. El seed garantiza que
 * `scopDhwMedio` trae el SCOP DHW del fabricante y, si no lo publica, el SCOP a 55 ºC de clima medio
 * (regla del instalador, 30-sep-2026), así que aquí no se vuelve a decidir.
 */
/** Rendimiento medio estacional del sistema de producción renovable de ACS (%) de UNA máquina. */
/**
 * Rendimiento medio estacional del sistema de producción renovable de ACS (%) (bloque 5).
 *
 * Regla del instalador (6-oct-2026): «SCOPdhw × 100 (%)»; y «en caso de que no exista este valor en
 * la ficha técnica coges el mismo que en el punto 2» (el rendimiento medio estacional de calefacción,
 * o sea el SCOP del régimen de los emisores × 100).
 */
function etaWhAcsMaquina(ctx: ContextoMod315, maquina: Maquina): number | undefined {
  const dv = (maquina.datosVariante as any) ?? {};
  const scopDhw =
    numerico((maquina as any).scopDhwMedio) ?? numerico(dv.acs?.scop_dhw_clima_medio_A7);
  if (scopDhw !== undefined) return Math.round(scopDhw * 100);
  return etaSMaquina(ctx, maquina);
}

/** Rendimiento medio estacional del sistema de producción renovable de ACS (%) — por máquina si difieren. */
function etaWhAcs(ctx: ContextoMod315): number | string | undefined {
  return valoresPorMaquina(maquinasDe(ctx), (m) => etaWhAcsMaquina(ctx, m)) ?? undefined;
}

/**
 * Volumen del acumulador de ACS (litros): el dato de obra manda; si no está, se declara el
 * acumulador con el que el fabricante certifica el ACS de esa máquina (GeniaSet de 188 l en la gama
 * ES, `acs.acumulacion_litros` del catálogo). Sin ninguno de los dos, se deja en blanco.
 */
function volumenAcumuladorLitros(ctx: ContextoMod315): number | string | undefined {
  const obra = (ctx.expediente.datosObra ?? {}) as Record<string, unknown>;
  const valor = obra['volumenAcumuladorLitros'] ?? obra['acumuladorLitros'];
  if (typeof valor === 'number' || typeof valor === 'string') return valor;
  // El acumulador definido al calcular el ACS (viene del correo del instalador: "acumulador").
  if (typeof ctx.acsVolumenAcumuladorLitros === 'number') return ctx.acsVolumenAcumuladorLitros;
  const dv = (ctx.maquina.datosVariante as any) ?? {};
  const catalogo = dv.acumulacion_litros_geniaset ?? dv.acs?.acumulacion_litros;
  return typeof catalogo === 'number' ? catalogo : undefined;
}

/**
 * «PRIMARIA» del apartado «ESTIMACIÓN DEL CONSUMO ANUAL DE ENERGÍA» (pág. 11) — regla del
 * instalador (30-sep-2026): **potencia total de la instalación × 6 × 7 × 8**, o sea 336. Con
 * 2 × M-Thermon A 10 (20 kW) → 6720. El factor está documentado en
 * `normativa/consumo-anual.constants.ts` (FACTOR_CONSUMO_ANUAL_POTENCIA).
 */
function energiaPrimariaMod315(ctx: ContextoMod315): number | null {
  return energiaPrimariaEstimadaKWh(totalesDe(ctx).potenciaCalorificaKW);
}

/**
 * «Emisiones de CO2» del mismo apartado — NO se estiman: se declaran las **toneladas equivalentes
 * de CO2 del punto 10** del formulario (Σ carga de refrigerante × PCA / 1000), con su etiqueta
 * (instalador, 30-sep-2026: «pon las ton eq CO2 calculadas en el punto 10 y pon esa etiqueta, en
 * este caso "1,89 ton eq CO2"»). Con varios refrigerantes, la misma forma que el punto 10
 * («0,0039/7,5168»).
 */
function emisionesCO2Mod315(ctx: ContextoMod315): string | null {
  const toneladas = toneladasCO2Texto(maquinasDe(ctx));
  if (toneladas === null || toneladas === undefined) return null;
  // `toneladasCO2Texto` devuelve un NÚMERO si hay un solo refrigerante (para que el punto 10 salga
  // como siempre) y texto ya formateado si hay varios («0,0039/7,5168»). Aquí, al ir dentro de una
  // frase, se formatea el número con coma decimal española como en el resto de los documentos.
  const texto = typeof toneladas === 'number' ? numeroEspanol(toneladas) : toneladas;
  return `${texto} ton eq CO2`;
}

/**
 * «RESUMEN DE CARGAS CALORÍFICAS POR LOCAL Y ELEMENTO INSTALADO» (pág. 11) — solo la PRIMERA fila,
 * como pidió el instalador el 30-sep-2026: tipo de local «Vivienda», la superficie que facilita el
 * instalador y la carga de cálculo = superficie × 55 (suelo radiante) o × 120 (radiadores o
 * fancoils), con el factor más restrictivo si hay emisores mezclados (suelo radiante + fancoil ⇒
 * 120). En «equipo» va el NÚMERO DE MÁQUINAS y en «carga real» lo mismo que en el cálculo de cargas.
 */
const TIPO_LOCAL_RESUMEN_CARGAS = 'Vivienda';

/**
 * Carga de cálculo (W) de la primera fila del resumen: superficie × el factor de los emisores
 * (radiadores 80, suelo radiante 55, fancoils 100 W/m²; el más restrictivo si están mezclados).
 *
 * Si esa carga se pasara de la potencia de la instalación, el impreso no cumpliría, así que el
 * instalador manda ajustarla (6-oct-2026): «imagina una máquina de 12.000 W y una vivienda de 171 m²
 * con radiadores: 171 × 80 = 13.680 W, no cumpliría, así que bajas el 80 a 70 y 171 × 70 = 11.970 W,
 * ahora sí cumple. Y esto así siempre». Se baja el factor **de 5 en 5** (lo pidió así el 6-oct-2026)
 * hasta que la carga quepa.
 */
function cargaCalculoResumenW(ctx: ContextoMod315): number | null {
  const superficie = ctx.superficieM2;
  const factorBase = factorCargaResumenWm2(ctx.tipoEmisores);
  if (typeof superficie !== 'number' || factorBase === null) return null;

  let factor = factorBase;
  const potenciaKW = numerico(potenciaCalorificaTotal(ctx) as unknown as string | number);
  if (potenciaKW !== undefined && potenciaKW > 0) {
    const potenciaW = potenciaKW * 1000;
    while (factor > 10 && superficie * factor > potenciaW) factor -= 5;
  }
  return Math.round(superficie * factor);
}

function tipoLocalResumenCargas(ctx: ContextoMod315): string | undefined {
  const obra = (ctx.expediente?.datosObra ?? {}) as Record<string, unknown>;
  const delExpediente = obra['tipoLocal'];
  if (typeof delExpediente === 'string' && delExpediente.trim().length > 0) return delExpediente;
  return TIPO_LOCAL_RESUMEN_CARGAS;
}

/**
 * Documento más grande de los seis (15 páginas, 480 campos AcroForm) — solo se mapean los
 * bloques con un dato de origen claro. Sin mapear a propósito (mismo criterio que en los
 * demás documentos): bloque "Representante del titular" (solo si el titular no es persona
 * física), "Técnico Titulado"/"Empresa instaladora en baja tensión" (secciones "si procede"),
 * las 2 últimas filas de "8.- Documentación aportada" (cálculo/diseño de energía solar y
 * licencia de obras "si procede" — no aplican a esta app; las 4 primeras SÍ se marcan siempre,
 * confirmado por el usuario), secciones 2-6 (Calefacción/A.A./Ventilación/ACS/Caldera —
 * genéricas para cualquier generador, mientras que la sección 7 "Datos Bomba de Calor" ya
 * cubre el caso de esta app con más precisión), 8-13 (Geotermia/Solar/especificaciones de
 * aislamiento-regulación-distribución/resumen de cargas — dato de proyecto detallado que esta
 * app no calcula). NUEVA/REFORMA sí se mapea (ver más abajo, derivado de esAnteriorRd1027_2007) —
 * y TIPO DE EMISORES se mapea del `tipoEmisor` del Módulo 2 cuando se usó el modo automático.
 *
 * Los bloques de identidad (Titular/Ubicación/Persona autorizada/Empresa/Instalador) repiten
 * el mismo patrón NIF+Apellidos+Nombre+Correo+Dirección(partida en Tipo vía/Nombre
 * vía/Nº/Bloque/Portal/Escalera/Piso/Puerta)+Localidad+Provincia+CP+Teléfonos — mucho más
 * granular que Expediente.datosCliente/Empresa/Persona. Igual que con "dirección fiscal", se
 * usa la dirección completa en el campo "Nombre vía" (el más ancho, donde de verdad se lee)
 * y NO se reparte por regex en Tipo de vía/Nº/Bloque/Portal/Escalera/Piso — frágil, mismo
 * criterio que Certificado RSIF. "Primer Apellido"/"Segundo Apellido" tampoco se rellenan por
 * la misma razón (no hay forma fiable de partir un nombre completo en apellidos).
 */
export const MAPEO_MOD_315: CampoMapeado<ContextoMod315>[] = [
  // ---- Cabecera: rango de potencia 5-70kW (la potencia TOTAL de la instalación: con varias
  // máquinas es la suma, y si se sale del rango el checklist bloquea los documentos — tarea 15). ----
  { campoPdf: 'IGUAL A 5kW Y MENOR_RB', tipo: 'checkbox', obtener: (ctx) => ambitoPotenciaMod315(potenciaCalorificaTotal(ctx)) === 'DENTRO' },

  // ---- 1. Titular de la instalación (cliente) — el nombre se reparte en nombre + apellidos
  // (Textfield-0 = primer apellido, Textfield-1 = segundo), pedido por el instalador el
  // 2026-09-22: antes solo se rellenaba "Nombre/Razón Social". Si es una empresa, todo el
  // texto va al nombre y los apellidos se quedan vacíos. ----
  { campoPdf: 'Textfield', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.dniCif },
  { campoPdf: 'Textfield-0', tipo: 'texto', obtener: (ctx) => partirNombre(ctx.expediente.datosCliente?.nombreRazonSocial).apellido1 },
  { campoPdf: 'Textfield-1', tipo: 'texto', obtener: (ctx) => partirNombre(ctx.expediente.datosCliente?.nombreRazonSocial).apellido2 },
  { campoPdf: 'Textfield-2', tipo: 'texto', obtener: (ctx) => partirNombre(ctx.expediente.datosCliente?.nombreRazonSocial).nombre },
  { campoPdf: 'Textfield-4', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'tipoVia') },
  { campoPdf: 'Textfield-5', tipo: 'texto', obtener: (ctx) => nombreVia(ctx) },
  { campoPdf: 'Textfield-6', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'numero') },
  { campoPdf: 'Textfield-7', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'bloque') },
  { campoPdf: 'Textfield-8', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'portal') },
  { campoPdf: 'Textfield-9', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'escalera') },
  { campoPdf: 'Textfield-10', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'piso') },
  { campoPdf: 'Textfield-11', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'puerta') },
  { campoPdf: 'Textfield-12', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'Textfield-13', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.provincia },
  { campoPdf: 'Textfield-14', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },
  { campoPdf: 'Textfield-15', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.telefono },
  { campoPdf: 'Textfield-3', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.email },

  // ---- 3. Ubicación de la instalación (simplificada, ver nota) ----
  { campoPdf: 'Textfield-35', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'tipoVia') },
  { campoPdf: 'Textfield-36', tipo: 'texto', obtener: (ctx) => nombreVia(ctx) },
  { campoPdf: 'Textfield-37', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'numero') },
  { campoPdf: 'Textfield-38', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'bloque') },
  { campoPdf: 'Textfield-39', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'portal') },
  { campoPdf: 'Textfield-40', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'escalera') },
  { campoPdf: 'Textfield-41', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'piso') },
  { campoPdf: 'Textfield-42', tipo: 'texto', obtener: (ctx) => parteDireccion(ctx, 'puerta') },
  { campoPdf: 'Textfield-43', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.municipio },
  { campoPdf: 'Textfield-44', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.provincia },
  { campoPdf: 'Textfield-45', tipo: 'texto', obtener: (ctx) => ctx.expediente.datosCliente?.codigoPostal },

  // ---- 4. Persona autorizada para la tramitación del expediente (apoderado) ----
  // El correo y la dirección de este bloque son SIEMPRE los mismos (dictado del instalador,
  // 2026-09-22): quien tramita es el soporte técnico de HomeServe, no el cliente.
  // Los apellidos y el nombre los fijó el instalador el 30-sep-2026 («En el punto 4 pon siempre en
  // Nombre Alejandro, Primer Apellido: Nuñez-Milara y Segundo Apellido: Gomez»): la ficha de la
  // persona en el CRM guarda el nombre en un solo campo y no parte bien «Nuñez-Milara», así que el
  // bloque va con la constante PERSONA_AUTORIZADA y solo el NIF sale del apoderado del expediente.
  { campoPdf: 'Textfield-46', tipo: 'texto', obtener: (ctx) => ctx.apoderado?.dni },
  { campoPdf: 'Nombre', tipo: 'texto', obtener: () => PERSONA_AUTORIZADA.nombre },
  { campoPdf: 'Textfield-47', tipo: 'texto', obtener: () => PERSONA_AUTORIZADA.primerApellido },
  { campoPdf: 'Textfield-48', tipo: 'texto', obtener: () => PERSONA_AUTORIZADA.segundoApellido },
  { campoPdf: 'Textfield-50', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.email },
  { campoPdf: 'Textfield-51', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Textfield-52', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Textfield-53', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Textfield-54', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Textfield-59', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.localidad },
  { campoPdf: 'Textfield-60', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.provincia },
  { campoPdf: 'Textfield-61', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.codigoPostal },
  { campoPdf: 'Textfield-62', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.telefonoFijo },

  // ---- 5. Empresa instaladora ----
  { campoPdf: 'Textfield-64', tipo: 'texto', obtener: (ctx) => ctx.empresa.cif },
  { campoPdf: 'Textfield-67', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'Textfield-68', tipo: 'texto', obtener: (ctx) => ctx.empresa.email },
  // Dirección del bloque 5 DESGLOSADA e IDÉNTICA a la del bloque 4 (dictado del instalador,
  // 2-oct-2026: «en el 315, en los puntos 5 y 7, quiero que pongas la dirección de forma idéntica a
  // la del punto 4: Tipo de vía: Paseo; Nombre vía: del Club Deportivo; Nº: 1; Bloque: Edif 12»).
  // Antes la dirección larga de la empresa caía entera en «Nombre vía» y Tipo vía/Nº/Bloque iban vacíos.
  { campoPdf: 'Textfield-69', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Textfield-70', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Textfield-71', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Textfield-72', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Textfield-77', tipo: 'texto', obtener: (ctx) => ctx.empresa.localidad },
  { campoPdf: 'Textfield-78', tipo: 'texto', obtener: (ctx) => ctx.empresa.provincia },
  { campoPdf: 'Textfield-79', tipo: 'texto', obtener: (ctx) => ctx.empresa.codigoPostal },
  { campoPdf: 'Textfield-80', tipo: 'texto', obtener: (ctx) => ctx.empresa.telefono },

  // ---- Instalador (persona, dentro del bloque 5 — rol INSTALADOR_HABILITADO) ----
  { campoPdf: 'Textfield-82', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.dni },
  { campoPdf: 'Nombre-0', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.nombre },
  { campoPdf: 'N carné', tipo: 'texto', obtener: (ctx) => (ctx.instaladorHabilitado?.datosAdicionales as any)?.numeroCarne },
  // «CCAA expide carné»: la casilla de la derecha de «Nº carné» en el bloque del instalador.
  { campoPdf: 'N carné-0', tipo: 'texto', obtener: () => CARNET_CCAA },

  // ---- 7. Empresa instaladora EN BAJA TENSIÓN ("en su caso") — mismos datos que el bloque 5
  // (dictado del instalador, 2026-09-22: "hay que poner los de HomeServe, los mismos que el
  // punto 5", porque la parte eléctrica la ejecuta la propia HomeServe). Los bloques 5 y 7
  // repiten el mismo patrón de campos, desplazado: 64→107, 67→110, 68→111, 70→113, 77→120,
  // 78→121, 79→122, 80→123. ----
  { campoPdf: 'Textfield-107', tipo: 'texto', obtener: (ctx) => ctx.empresa.cif },
  { campoPdf: 'Textfield-110', tipo: 'texto', obtener: (ctx) => ctx.empresa.nombre },
  { campoPdf: 'Textfield-111', tipo: 'texto', obtener: (ctx) => ctx.empresa.email },
  // La misma dirección desglosada que los bloques 4 y 5 (instalador, 2-oct-2026).
  { campoPdf: 'Textfield-112', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.tipoVia },
  { campoPdf: 'Textfield-113', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.nombreVia },
  { campoPdf: 'Textfield-114', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.numero },
  { campoPdf: 'Textfield-115', tipo: 'texto', obtener: () => CONTACTO_TRAMITACION.bloque },
  { campoPdf: 'Textfield-120', tipo: 'texto', obtener: (ctx) => ctx.empresa.localidad },
  { campoPdf: 'Textfield-121', tipo: 'texto', obtener: (ctx) => ctx.empresa.provincia },
  { campoPdf: 'Textfield-122', tipo: 'texto', obtener: (ctx) => ctx.empresa.codigoPostal },
  { campoPdf: 'Textfield-123', tipo: 'texto', obtener: (ctx) => ctx.empresa.telefono },

  // ---- 8. Documentación aportada: las 4 primeras filas se aportan siempre (confirmado por el
  // usuario, instalador real, 2026-09-04) — las 2 últimas (cálculo/diseño de energía solar,
  // licencia de obras "si procede") no aplican a esta app y se dejan sin marcar. ----
  { campoPdf: 'ChkBox', tipo: 'checkbox', obtener: () => true }, // Justificante de pago de la tasa a la Dirección General de Transición Energética y Economía Circular
  { campoPdf: 'ChkBox-0', tipo: 'checkbox', obtener: () => true }, // Justificante de pago de la tarifa a la EICI
  { campoPdf: 'ChkBox-1', tipo: 'checkbox', obtener: () => true }, // MEMORIA TÉCNICA (este mismo documento)
  { campoPdf: 'ChkBox-2', tipo: 'checkbox', obtener: () => true }, // MANUAL DE USO Y MANTENIMIENTO

  // ---- Firma ----
  // «En ____ a __ de ____ de ____»: SIEMPRE Madrid (dictado del instalador, 30-sep-2026: «pon En
  // Madrid siempre, no pongas la localidad del cliente; la dirección/localidad del cliente solo en
  // el 1 y el 3»). Es donde se firma el documento, no el emplazamiento de la instalación.
  { campoPdf: 'Texto1', tipo: 'texto', obtener: () => 'Madrid' },
  { campoPdf: 'Texto2', tipo: 'texto', obtener: () => String(new Date().getDate()) },
  { campoPdf: 'Texto3', tipo: 'texto', obtener: () => new Date().toLocaleDateString('es-ES', { month: 'long' }) },
  { campoPdf: 'Texto4', tipo: 'texto', obtener: () => String(new Date().getFullYear()) },

  // ---- 14.- Firmas (pág. 14). La hoja lleva DOS bloques de firma y cada uno con su casilla de
  // fecha: «Firma del profesional instalador habilitado: Fecha:____» → `Fecha`, y «Firma del técnico
  // titulado competente: Fecha: ____» → `Fecha-0` (comprobado contra los rect de la plantilla:
  // `Fecha` cae en la línea y=287 de la pág. 14 y `Fecha-0` en la y=448). Las dos salían VACÍAS con
  // el 315 emitido, así que llevan la fecha del documento, la misma que el resto del impreso.
  // De la firma en sí no se toca nada: es el sello/rúbrica manuscrita sobre el papel. ----
  { campoPdf: 'Fecha', tipo: 'texto', obtener: () => fechaDocumento() },
  { campoPdf: 'Fecha-0', tipo: 'texto', obtener: () => fechaDocumento() },
  // «Identificación del profesional instalador habilitado» y «del técnico titulado competente». El
  // instalador exigió el 2-oct-2026 que NUNCA queden en blanco: «en el punto 14 del 315, lo dejaste
  // en blanco, recuerda poner siempre: NOMBRE Y APELLIDOS: Salvador Gisbert Rivas — NIF: 26753212A».
  // Los datos salen de la config de personas (rol INSTALADOR_HABILITADO), no de constantes: así, si
  // algún día cambia el instalador, sale el que toque sin tocar el código.
  { campoPdf: 'Nombre y apellidos', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.nombre },
  { campoPdf: 'NIF', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.dni },
  { campoPdf: 'Nombre y apellidos-0', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.nombre },
  { campoPdf: 'NIF-0', tipo: 'texto', obtener: (ctx) => ctx.instaladorHabilitado?.dni },

  // ---- Memoria Técnica, 1. Datos Técnicos Generales de IT ----
  { campoPdf: 'Calefacción', tipo: 'checkbox', obtener: (ctx) => ctx.tieneCalefaccion },
  { campoPdf: 'ACS', tipo: 'checkbox', obtener: (ctx) => ctx.tieneAcsPorBombaDeCalor },
  { campoPdf: 'Potencia Nominal kW', tipo: 'texto', obtener: (ctx) => potenciaCalorificaTotal(ctx) },
  { campoPdf: 'Electricidad', tipo: 'checkbox', obtener: () => true }, // supuesto de dominio: toda bomba de calor funciona con electricidad
  {
    campoPdf: 'Residencial Privado Unifamiliar',
    tipo: 'checkbox',
    obtener: (ctx) => ctx.tipoEdificio === TipoEdificio.VIVIENDA_UNIFAMILIAR,
  },
  {
    campoPdf: 'Residencial Privado Colectivo',
    tipo: 'checkbox',
    obtener: (ctx) => ctx.tipoEdificio === TipoEdificio.VIVIENDA_PLURIFAMILIAR,
  },
  { campoPdf: 'Número de Viviendas', tipo: 'texto', obtener: (ctx) => ctx.numeroViviendas },
  {
    // Radio de 3 opciones: Si / No / "Sí, pero solo aplica artículo 21.6 del RSIF" — se usa Si/No simple.
    campoPdf: 'La instalación tiene Circuito Frigorífico Primario',
    tipo: 'radio',
    obtener: () => 'La instalación tiene Circuito Frigorífico Primario_Si_On', // supuesto de dominio: toda bomba de calor tiene circuito frigorífico
  },
  { campoPdf: 'Nivel 1', tipo: 'checkbox', obtener: (ctx) => ctx.requiereMemoriaTecnica === true },

  // ---- INSTALACIÓN: NUEVA / REFORMA — se deriva de esAnteriorRd1027_2007 (dato del correo,
  // campo "reforma: si|no"). true = instalación existente anterior a 2007 que se reforma →
  // REFORMA/AMPLIACIÓN. false o null ⇒ NUEVA: el instalador exige que el tipo NUNCA quede sin
  // marcar (2026-09-22) y esta app solo dimensiona instalaciones nuevas — una modificación
  // exige el nº de registro de la instalación frigorífica, que aquí no se puede generar. ----
  { campoPdf: 'NUEVA', tipo: 'checkbox', obtener: (ctx) => ctx.tipoInstalacion === 'NUEVA' },
  { campoPdf: 'REFORMA  AMPLIACIÓN DE EXISTENTE', tipo: 'checkbox', obtener: (ctx) => ctx.tipoInstalacion === 'REFORMA' },
  // ---- OBSERVACIONES (alcance de la reforma) del punto 1 — texto LITERAL dictado por el
  // instalador el 2-oct-2026 según el tipo de energía y de instalación (ver `observacionesPunto1`). ----
  { campoPdf: 'OBSERVACIONES alcance de la reforma', tipo: 'texto', obtener: (ctx) => observacionesPunto1(ctx) },

  // ---- ¿La instalación tiene circuito frigorífico primario? Sí: las bombas de calor del
  // catálogo son de expansión directa (el refrigerante va del equipo al intercambiador), que es
  // el supuesto de dominio ya usado en el certificado RSIF ("sistema directo"). Es un grupo de
  // radio: hay que seleccionar la opción. ----
  {
    campoPdf: 'La instalación tiene Circuito Frigorífico Primario',
    tipo: 'radio',
    obtener: () => 'La instalación tiene Circuito Frigorífico Primario_Si_On',
  },

  // ---- TIPO DE EMISORES — los emisores marcados en el Módulo 2 (demanda de calefacción), si se usó
  // el modo automático; en blanco si fue manual o si no hay CalculoDemanda vinculado (no se adivina).
  // Se admiten VARIOS a la vez (pedido del instalador, 29-sep-2026: «suelo radiante y radiadores»). ----
  { campoPdf: 'Radiadores', tipo: 'checkbox', obtener: (ctx) => emisoresDe(ctx).includes(TipoEmisor.RADIADORES) },
  { campoPdf: 'Fan Coil', tipo: 'checkbox', obtener: (ctx) => emisoresDe(ctx).includes(TipoEmisor.FAN_COIL) },
  { campoPdf: 'Conductos', tipo: 'checkbox', obtener: (ctx) => emisoresDe(ctx).includes(TipoEmisor.CONDUCTOS) },
  { campoPdf: 'Suelo Radiante', tipo: 'checkbox', obtener: (ctx) => emisoresDe(ctx).includes(TipoEmisor.SUELO_RADIANTE) },
  { campoPdf: 'Expansión Directa', tipo: 'checkbox', obtener: (ctx) => emisoresDe(ctx).includes(TipoEmisor.EXPANSION_DIRECTA) },
  { campoPdf: 'Otros-3', tipo: 'checkbox', obtener: (ctx) => emisoresDe(ctx).includes(TipoEmisor.OTROS) },

  // ---- 7. Datos Bomba de Calor — con varias máquinas: potencias SUMADAS y rendimientos POR MÁQUINA
  // separados por «/» (reglas del instalador, 29-sep-2026); el nº de bombas es la suma de unidades. ----
  // Tipo de energía de la instalación: AEROTERMIA o GEOTERMIA, nunca las dos (instalador,
  // 2-oct-2026). Antes se marcaba Aerotermia siempre.
  { campoPdf: 'Aerotermia', tipo: 'checkbox', obtener: (ctx) => ctx.tipoEnergia === 'AEROTERMIA' },
  { campoPdf: 'Geotermia', tipo: 'checkbox', obtener: (ctx) => ctx.tipoEnergia === 'GEOTERMIA' },
  { campoPdf: 'Denominación del refrigerante', tipo: 'texto', obtener: (ctx) => refrigeranteDeclarado(ctx) },
  { campoPdf: 'N de Bombas de Calor', tipo: 'texto', obtener: (ctx) => totalesDe(ctx).unidadesTotales },
  { campoPdf: 'Potencia Nominal Total de las Bombas de Calor kW', tipo: 'texto', obtener: (ctx) => potenciaCalorificaTotal(ctx) },
  { campoPdf: 'Rendimiento medio estacional SCOPnet o SCOPdhw de', tipo: 'texto', obtener: (ctx) => scopDeclarado(ctx) },
  { campoPdf: 'EER', tipo: 'texto', obtener: (ctx) => eerDeclarado(ctx) },
  { campoPdf: 'COP', tipo: 'texto', obtener: (ctx) => copDeclarado(ctx) },
  // Qusable y Eres: son los del ACS (salen de su demanda), así que con «climatización sola» van en blanco.
  { campoPdf: 'Qusable', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, ctx.qusableAnualKWh) },
  { campoPdf: 'Eres', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, ctx.eresAnualKWh) },
  { campoPdf: 'Calefacción-1', tipo: 'checkbox', obtener: (ctx) => ctx.tieneCalefaccion },
  { campoPdf: 'ACS-1', tipo: 'checkbox', obtener: (ctx) => ctx.tieneAcsPorBombaDeCalor },

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // Cambios dictados por el instalador el 2026-09-22 (revisión del expediente de Las Matas):
  // bloques 2, 5, 10 y 11 de la memoria + secciones 4 y 7 del formulario.
  // ══════════════════════════════════════════════════════════════════════════════════════════

  // ---- Memoria 2.- Datos Calefacción — "se rellena con los mismos datos que la bomba de
  // calor" (dictado del instalador). "Aire-Agua" es un supuesto de dominio de la aerotermia
  // (fuente: aire; emisor: agua), no una adivinanza por expediente. ----
  { campoPdf: 'Aire  Agua', tipo: 'checkbox', obtener: () => true },
  { campoPdf: 'Potencia térmica nominal total en calefacción kW', tipo: 'texto', obtener: (ctx) => potenciaCalorificaTotal(ctx) },
  // «el mayor generador» es el MÁXIMO, no la suma (con una máquina coinciden).
  { campoPdf: 'Potencia nominal del mayor generador de calor kW', tipo: 'texto', obtener: (ctx) => potenciaMayorGenerador(ctx) },
  { campoPdf: 'N de generadores de calor', tipo: 'texto', obtener: (ctx) => totalesDe(ctx).unidadesTotales },
  { campoPdf: 'Bomba de calor', tipo: 'checkbox', obtener: () => true },
  { campoPdf: 'Rendimiento medio estacional declarado del generad', tipo: 'texto', obtener: (ctx) => etaSDeclarado(ctx) },
  { campoPdf: 'Rendimiento instantáneo máximo del generador de ca', tipo: 'texto', obtener: (ctx) => rendimientoInstantaneoDeclarado(ctx) },
  // ---- 3.- Datos Aire Acondicionado (bloque 3): solo si la instalación enfría (suelo o fancoils).
  // El -0 es el del generador de frío (la casilla sin sufijo es la de calefacción).
  { campoPdf: 'Rendimiento medio estacional declarado del generad-0', tipo: 'texto', obtener: (ctx) => seerDeclarado(ctx) },
  { campoPdf: 'Rendimiento Eléctrico Equivalente EER del generado', tipo: 'texto', obtener: (ctx) => eerPorcentajeDeclarado(ctx) },

  // ---- Memoria 5.- Datos ACS — "los datos de ACS no los has cumplimentado; es la misma máquina
  // que se cumplimenta en la bomba de calor" (dictado del instalador). ----
  { campoPdf: 'BdC Aerotérmica', tipo: 'checkbox', obtener: (ctx) => ctx.tieneAcsPorBombaDeCalor && ctx.tipoEnergia === 'AEROTERMIA' },
  // Con geotermia, la fuente renovable del ACS es la bomba de calor geotérmica (instalador, 2-oct-2026).
  { campoPdf: 'BdC geotérmica', tipo: 'checkbox', obtener: (ctx) => ctx.tieneAcsPorBombaDeCalor && ctx.tipoEnergia === 'GEOTERMIA' },
  { campoPdf: 'Bomba de calor-0', tipo: 'checkbox', obtener: (ctx) => ctx.tieneAcsPorBombaDeCalor },
  { campoPdf: 'Potencia térmica nominal total de la producción de', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, potenciaCalorificaTotal(ctx)) },
  { campoPdf: 'Potencia máxima del sistema de producción renovabl', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, potenciaCalorificaTotal(ctx)) },
  { campoPdf: 'Rendimiento medio estacional del sistema de produc', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, etaWhAcs(ctx)) },
  { campoPdf: 'Volumen máximo de acumulación de ACS litros', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, volumenAcumuladorLitros(ctx)) },
  // Demanda diaria de ACS a 60 °C del CTE DB-HE4 (Anejo F) — ya calculada por el programa.
  { campoPdf: 'Demanda diaria de ACS a 60C litrosdía', tipo: 'texto', obtener: (ctx) => siProduceAcs(ctx, ctx.acsDemandaDiaria60C) },
  // Tipo de sistema y de acumulación de ACS: en vivienda unifamiliar la producción y la acumulación
  // son de la propia vivienda (descentralizada); en plurifamiliar con una instalación común, no.
  { campoPdf: 'Descentralizado', tipo: 'checkbox', obtener: (ctx) => siProduceAcs(ctx, ctx.tipoEdificio === TipoEdificio.VIVIENDA_UNIFAMILIAR) },
  { campoPdf: 'Centralizado-0', tipo: 'checkbox', obtener: (ctx) => siProduceAcs(ctx, ctx.tipoEdificio === TipoEdificio.VIVIENDA_PLURIFAMILIAR) },
  { campoPdf: 'Descentralizada', tipo: 'checkbox', obtener: (ctx) => siProduceAcs(ctx, ctx.tipoEdificio === TipoEdificio.VIVIENDA_UNIFAMILIAR) },
  { campoPdf: 'Centralizada', tipo: 'checkbox', obtener: (ctx) => siProduceAcs(ctx, ctx.tipoEdificio === TipoEdificio.VIVIENDA_PLURIFAMILIAR) },

  // ---- Memoria 10.- Datos Circuito Frigorífico (dictado del instalador 2026-09-22 y corregido el
  // 2026-09-30). El encabezado de estas casillas es «Clasificación del refrigerante (INFLAMABILIDAD Y
  // TOXICIDAD)» y el impreso ofrece cuatro casillas mezcladas: L1/L2/L3 (grupo del RSIF) y A2L (clase
  // de seguridad). Se marca UNA, la que fijó el instalador (ver `clasificacionRefrigeranteImpreso`):
  // en un R32, SOLO «A2L» — antes se marcaban además L1/L2/L3 y lo corrigió («has marcado L2 y A2L,
  // cuando solo es A2L»). Si algún día hay R290 (A3) se marca «L3», y en un R410A/R134a (A1), «L1».
  { campoPdf: 'L1', tipo: 'checkbox', obtener: (ctx) => algunGrupoSeguridad(ctx, 'L1') },
  { campoPdf: 'L2', tipo: 'checkbox', obtener: () => false },
  { campoPdf: 'L3', tipo: 'checkbox', obtener: (ctx) => algunGrupoSeguridad(ctx, 'L3') },
  { campoPdf: 'A2L', tipo: 'checkbox', obtener: (ctx) => algunGrupoSeguridad(ctx, 'A2L') },
  { campoPdf: 'Denominación del refrigerante-0', tipo: 'texto', obtener: (ctx) => refrigeranteDeclarado(ctx) },
  { campoPdf: 'Carga total de refrigerante kg', tipo: 'texto', obtener: (ctx) => totalesDe(ctx).cargaTotalKg },
  { campoPdf: 'Potencia total en compresores kW', tipo: 'texto', obtener: (ctx) => potenciaAbsorbidaTotal(ctx) },
  {
    campoPdf: 'Toneladas equivalentes de CO2 del sistema frigoríf',
    tipo: 'texto',
    obtener: (ctx) => toneladasCO2Texto(maquinasDe(ctx)),
  },
  {
    // Grupo de radio de 2 opciones (Sí / No) — hay que SELECCIONAR la opción, no marcar casilla.
    // Con varios refrigerantes distintos manda el más restrictivo: Sí si alguno es fluorado.
    campoPdf: 'Refrigerante fluorado',
    tipo: 'radio',
    obtener: (ctx) => {
      const fluorado = refrigeranteFluoradoDeclarado(ctx);
      return fluorado === null ? null : `Refrigerante fluorado_${fluorado ? 'Si' : 'No'}_On`;
    },
  },

  // ---- Memoria 11.- Diversas especificaciones y cálculos. Condiciones interiores de diseño:
  // SIEMPRE las mismas, dictadas por el instalador el 2026-09-22 (invierno 22 y verano 24
  // interiores; -4 y 36 exteriores; ACS en grifos terminales entre 50 y 65; velocidad máxima
  // del agua 2 m/s y del aire en conductos 4 m/s). "SISTEMA DE APORTE DE AIRE PRIMARIO" se
  // deja en blanco: una aerotermia con emisores de agua no tiene aire primario. ----
  { campoPdf: 'INVIERNO', tipo: 'texto', obtener: () => 22 },
  { campoPdf: 'VERANO', tipo: 'texto', obtener: () => 24 },
  { campoPdf: 'INVIERNO-0', tipo: 'texto', obtener: () => -4 },
  { campoPdf: 'VERANO-0', tipo: 'texto', obtener: () => 36 },
  { campoPdf: 'MÍNINO', tipo: 'texto', obtener: () => 50 },
  { campoPdf: 'MÁXIMO', tipo: 'texto', obtener: () => 65 },
  { campoPdf: 'VELOCIDAD MÁXIMA DEL AGUA EN TUBERÍAS DE CALEFACCI', tipo: 'texto', obtener: () => 2 },
  { campoPdf: 'VELOCIDAD MÁXIMA DEL AIRE EN CONDUCTOS', tipo: 'texto', obtener: () => 4 },

  // ---- Memoria 11.- «EMPLAZAMIENTO DEL GENERADOR» (hoja 9): se marca INTERIOR o EXTERIOR con el
  // dato de obra `emplazamientoGenerador` que facilita el instalador (30-sep-2026: «debes marcar el
  // emplazamiento del generador, te lo tenemos que decir, interior o exterior»). Sin dato no se marca
  // ninguna de las dos (el valor queda como estaba, no se fuerza a «desmarcado»). ----
  {
    campoPdf: 'INTERIOR',
    tipo: 'checkbox',
    obtener: (ctx) => {
      const e = emplazamientoGenerador(ctx);
      return e === null ? undefined : e === 'interior';
    },
  },
  {
    campoPdf: 'EXTERIOR',
    tipo: 'checkbox',
    obtener: (ctx) => {
      const e = emplazamientoGenerador(ctx);
      return e === null ? undefined : e === 'exterior';
    },
  },

  // ---- Memoria 11.- «AISLAMIENTO TÉRMICO» (hoja 10): solo la fila TUBERÍAS Y ACCESORIOS lleva
  // material y espesor; CONDUCTOS, REDES ENTERRADAS y CHIMENEAS se quedan en blanco. ----
  { campoPdf: 'TUBERÍAS Y ACCESORIOS', tipo: 'texto', obtener: () => AISLAMIENTO_TUBERIAS.material },
  { campoPdf: 'Textfield-126', tipo: 'texto', obtener: () => AISLAMIENTO_TUBERIAS.espesor },

  // ---- Memoria 11.- «REGULACIÓN Y CONTROL» (hoja 10): columnas CALEFACCIÓN (x≈277), A.C.S.
  // (x≈389) y CLIMATIZACIÓN (x≈497). Dictado del instalador el 30-sep-2026: en CALEFACCIÓN se marcan
  // termostato en local característico, válvulas termostáticas, sonda de temperatura de fluido, sonda
  // de temperatura exterior y centralita electrónica; en A.C.S. SOLO la centralita electrónica; la
  // columna de climatización se queda en blanco. ----
  { campoPdf: 'ChkBox-25', tipo: 'checkbox', obtener: () => true }, // Termostato en local característico — CALEFACCIÓN
  { campoPdf: 'ChkBox-28', tipo: 'checkbox', obtener: () => true }, // Válvulas termostáticas — CALEFACCIÓN
  { campoPdf: 'ChkBox-31', tipo: 'checkbox', obtener: () => true }, // Sonda de temperatura de fluido — CALEFACCIÓN
  { campoPdf: 'ChkBox-34', tipo: 'checkbox', obtener: () => true }, // Sonda de temperatura exterior — CALEFACCIÓN
  { campoPdf: 'ChkBox-37', tipo: 'checkbox', obtener: () => true }, // Centralita electrónica — CALEFACCIÓN
  { campoPdf: 'ChkBox-38', tipo: 'checkbox', obtener: () => true }, // Centralita electrónica — A.C.S.

  // ---- Memoria 11.- «SISTEMA DE DISTRIBUCIÓN» (hoja 10): tubería multicapa, secciones máxima y
  // mínima, BITUBO y los emisores de la instalación en «EQUIPOS TERMINALES». ----
  { campoPdf: 'TIPO DE TUBERÍA', tipo: 'texto', obtener: () => DISTRIBUCION.tipoTuberia },
  { campoPdf: 'SECCIÓN MÁXIMA', tipo: 'texto', obtener: () => DISTRIBUCION.seccionMaxima },
  { campoPdf: 'SECCIÓN MINIMA', tipo: 'texto', obtener: () => DISTRIBUCION.seccionMinima },
  { campoPdf: 'B ITU BO', tipo: 'checkbox', obtener: () => true }, // clase de distribución BITUBO
  { campoPdf: 'EQUIPOS TERMINALES', tipo: 'texto', obtener: (ctx) => equiposTerminales(ctx) },

  // ---- Memoria 11.- «RESUMEN DE CARGAS CALORÍFICAS POR LOCAL Y ELEMENTO INSTALADO» (pág. 11) ----
  // SOLO la primera fila (dictado del instalador, 30-sep-2026): tipo de local, la superficie que
  // facilita el instalador, la carga de cálculo (superficie × 55 suelo radiante / × 120 radiadores o
  // fancoils, el más restrictivo si hay mezcla), el número de máquinas en «equipo» y en «carga real»
  // lo mismo que en el cálculo. «Planta», «Nº», «orientación» y «elementos» se dejan vacíos.
  { campoPdf: 'TIPO DE LOCAL', tipo: 'texto', obtener: (ctx) => tipoLocalResumenCargas(ctx) },
  { campoPdf: 'SUPERFICIE m2', tipo: 'texto', obtener: (ctx) => ctx.superficieM2 ?? undefined },
  { campoPdf: 'CALCULO CARGAS', tipo: 'texto', obtener: (ctx) => cargaCalculoResumenW(ctx) ?? undefined },
  { campoPdf: 'EQUIPO', tipo: 'texto', obtener: (ctx) => totalesDe(ctx).unidadesTotales },
  { campoPdf: 'CARGA REAL', tipo: 'texto', obtener: (ctx) => cargaCalculoResumenW(ctx) ?? undefined },

  // ---- Memoria 11 (bis).- «ESTIMACIÓN DEL CONSUMO ANUAL DE ENERGÍA» (pág. 11): energía primaria
  // (potencia total de la instalación × 6 × 7 × 8) y las toneladas equivalentes de CO2 del punto 10
  // con su etiqueta. Regla del instalador del 30-sep-2026 — ver `normativa/consumo-anual.constants.ts`. ----
  { campoPdf: 'Primaria', tipo: 'texto', obtener: (ctx) => energiaPrimariaMod315(ctx) ?? undefined },
  { campoPdf: 'Emisiones de CO2', tipo: 'texto', obtener: (ctx) => emisionesCO2Mod315(ctx) ?? undefined },

  // ---- Memoria 11 (bis).- Justificación del cumplimiento de exigencias: texto fijo dictado
  // por el instalador el 2026-09-22. ----
  { campoPdf: 'Textfield-134', tipo: 'texto', obtener: () => JUSTIFICACION_CUMPLIMIENTO },
];

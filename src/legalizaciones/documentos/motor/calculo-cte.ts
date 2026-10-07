/**
 * Motor de cálculo del CTE para los documentos oficiales: demanda de calefacción, demanda de ACS y
 * Qusable/Eres.
 *
 * ES UNA COPIA FIEL de los servicios del CRM (`Ingeniero/backend/src/{demanda,acs,qusable,eres}`),
 * sin TypeORM ni entidades: aquí solo las fórmulas, para que el gestor rellene esos valores por su
 * cuenta en vez de pedírselos a nadie. Lo pidió el instalador el 2-oct-2026: «todo esto no debería
 * aparecer, esto es lo que calculas tú internamente».
 *
 * Regla del proyecto: no se inventa ninguna cifra. Cada resultado sale de las tablas del CTE DB-HE4
 * (anejos F y G), de la regla del instalador de kcal/(h·m²) por emisor o del catálogo del
 * fabricante; lo que no se puede calcular se devuelve null y se queda EN BLANCO en el documento.
 */
import { KCAL_H_A_W, TipoEmisor, factorKcalM2MasRestrictivo } from '../crm/normativa/demanda.constants';
import { ProvinciaCapital, TipoEdificio } from '../crm/normativa/dbhe4.types';
import { CALOR_ESPECIFICO_AGUA_WH_L_C } from '../crm/normativa/qusable-conversion.constants';
import {
  CONTRIBUCION_RENOVABLE_MINIMA_GENERAL,
  CONTRIBUCION_RENOVABLE_MINIMA_REDUCIDA,
  DEMANDA_REFERENCIA_PERSONA_60C,
  SCOP_DHW_MINIMO_ELECTRICA,
  SCOP_DHW_MINIMO_TERMICA,
  TEMPERATURA_REFERENCIA_ACS,
  UMBRAL_DEMANDA_ALTA_L_DIA,
} from '../crm/normativa/dbhe4-anejo-f.constants';
import {
  corregirDemandaPorTemperatura,
  corregirTemperaturaPorAltitud,
  getFactorCentralizacion,
  getOcupacionPorDormitorios,
  getTemperaturaAguaRed,
} from '../crm/normativa/dbhe4.helpers';

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ── Demanda de calefacción (regla del instalador + CTE) ────────────────────────────────────────

export interface ResultadoDemandaCalefaccion {
  demandaCalefaccionKW: number;
  factorKcalM2: number;
  emisores: TipoEmisor[];
  formula: string;
}

/**
 * Demanda de calefacción por superficie y emisor: kcal/(h·m²) = 60 suelo radiante/conductos/
 * expansión directa/otros, 80 radiadores, 110 fan-coils; kW = m² × factor × 1,163 / 1000.
 * Con varios emisores se aplica el factor MÁS restrictivo a toda la superficie (regla del
 * instalador, 29-sep-2026).
 */
export function demandaCalefaccion(
  superficieM2: number | null | undefined,
  emisores: TipoEmisor[],
): ResultadoDemandaCalefaccion | null {
  if (!superficieM2 || superficieM2 <= 0 || emisores.length === 0) return null;
  const factorKcalM2 = factorKcalM2MasRestrictivo(emisores);
  if (factorKcalM2 === null) return null;
  return {
    demandaCalefaccionKW: Number(((superficieM2 * factorKcalM2 * KCAL_H_A_W) / 1000).toFixed(2)),
    factorKcalM2,
    emisores,
    formula: `Demanda[kW] = Superficie[m²] × ${factorKcalM2} kcal/(h·m²) × ${KCAL_H_A_W} W/(kcal/h) / 1000`,
  };
}

// ── Demanda de ACS (CTE DB-HE4, anejos F y G) ──────────────────────────────────────────────────

export interface ResultadoAcs {
  /** Demanda de referencia diaria a 60 °C, después del factor de centralización. */
  demandaReferenciaDiaria60C: number;
  /** Ocupación (personas) o unidades, de la tabla a/c del anejo F. */
  ocupacionCalculada: number;
  factorCentralizacion: number;
  temperaturaPreparacion: number;
  /** Demanda anual ya corregida por la temperatura del agua de red, mes a mes. */
  demandaAnualCorregida: number;
  contribucionRenovableMinima: number;
  /** Necesario para el Qusable: volumen de cada mes y temperatura del agua de red de ese mes. */
  detalleMensual: { mes: number; ti: number; mensualT: number }[];
}

/**
 * Demanda de ACS de viviendas (CTE DB-HE4, anejo F): ocupación por dormitorios (tabla a), 28 l por
 * persona y día a 60 °C, factor de centralización si es plurifamiliar (tabla b) y corrección mensual
 * por la temperatura del agua de red de la provincia (tabla a del anejo G, con la corrección por
 * altitud si se conoce la del municipio).
 *
 * Devuelve null si falta algún dato o si la provincia no está en la tabla del anejo G: sin dato no
 * se calcula nada (no se adivina la temperatura del agua de red).
 */
export function demandaAcs(entrada: {
  tipoEdificio: string | null | undefined;
  dormitorios: number | null | undefined;
  viviendas?: number | null;
  provincia: string | null | undefined;
  altitudLocalidad?: number | null;
  temperaturaPreparacion?: number | null;
}): ResultadoAcs | null {
  const capital = capitalDeProvincia(entrada.provincia);
  if (!capital) return null;

  const esPlurifamiliar = entrada.tipoEdificio === TipoEdificio.VIVIENDA_PLURIFAMILIAR;
  const dormitorios = entrada.dormitorios ?? null;

  // El no residencial necesita el uso (tabla c) y las unidades: no lo pide el alta, así que no se
  // calcula en lugar de suponerlo (quedaría un ACS inventado, que es lo que no se hace nunca).
  if (entrada.tipoEdificio === TipoEdificio.NO_RESIDENCIAL) return null;
  if (!dormitorios || dormitorios < 1 || dormitorios > 7) return null;
  if (esPlurifamiliar && !entrada.viviendas) return null;

  const personasPorVivienda = getOcupacionPorDormitorios(dormitorios);
  const ocupacion = esPlurifamiliar ? personasPorVivienda * entrada.viviendas! : personasPorVivienda;

  let demanda60 = ocupacion * DEMANDA_REFERENCIA_PERSONA_60C;
  const factorCentralizacion = esPlurifamiliar ? getFactorCentralizacion(entrada.viviendas!) : 1;
  demanda60 *= factorCentralizacion;

  const filaRed = getTemperaturaAguaRed(capital);
  const altitudLocalidad = entrada.altitudLocalidad ?? filaRed.altitud;
  const temperaturaPreparacion = entrada.temperaturaPreparacion ?? TEMPERATURA_REFERENCIA_ACS;

  const detalleMensual: { mes: number; ti: number; mensualT: number }[] = [];
  let demandaAnualCorregida = 0;

  for (let mes = 1; mes <= 12; mes++) {
    const tiCapital = filaRed.mensual[mes - 1];
    const ti =
      altitudLocalidad !== filaRed.altitud
        ? corregirTemperaturaPorAltitud(tiCapital, mes, altitudLocalidad, filaRed.altitud)
        : tiCapital;
    // El agua de red más caliente del año es el caso más exigente: si T no la supera, no hay cálculo.
    if (temperaturaPreparacion <= ti) return null;

    const mensualT = corregirDemandaPorTemperatura(demanda60, temperaturaPreparacion, ti) * DIAS_POR_MES[mes - 1];
    demandaAnualCorregida += mensualT;
    detalleMensual.push({ mes, ti: Number(ti.toFixed(2)), mensualT: Number(mensualT.toFixed(2)) });
  }

  return {
    demandaReferenciaDiaria60C: Number(demanda60.toFixed(2)),
    ocupacionCalculada: ocupacion,
    factorCentralizacion,
    temperaturaPreparacion,
    demandaAnualCorregida: Number(demandaAnualCorregida.toFixed(2)),
    contribucionRenovableMinima:
      demanda60 < UMBRAL_DEMANDA_ALTA_L_DIA ? CONTRIBUCION_RENOVABLE_MINIMA_REDUCIDA : CONTRIBUCION_RENOVABLE_MINIMA_GENERAL,
    detalleMensual,
  };
}

// ── Qusable y Eres (HE4 §3.1.4 y anexo VII) ────────────────────────────────────────────────────

/**
 * Qusable anual: Qusable_mes[kWh] = D_mes[L] × (T − Ti)[°C] × 1,163 Wh/(L·°C) / 1000, sumado.
 * Es la energía útil que la bomba aporta al ACS; de ella sale el Eres con la contribución renovable.
 */
export function qusableAnualKWh(acs: ResultadoAcs | null): number | null {
  if (!acs) return null;
  const total = acs.detalleMensual.reduce(
    (suma, m) => suma + (m.mensualT * (acs.temperaturaPreparacion - m.ti) * CALOR_ESPECIFICO_AGUA_WH_L_C) / 1000,
    0,
  );
  return Number(total.toFixed(2));
}

/**
 * Eres anual (anexo VII del RITE / HE4): CR = 1 − 1/SPF y Eres = Qusable × CR, pero solo si el SPF
 * (el SCOP de ACS de la máquina) alcanza el umbral aplicable. Si no lo alcanza, la bomba NO cuenta
 * como renovable: CR = 0 y Eres = 0, que es un resultado válido, no un dato que falte.
 */
export function eresAnualKWh(
  qusableKWh: number | null,
  spf: number | null | undefined,
  accionamiento: 'electrica' | 'termica' = 'electrica',
): { eresAnualKWh: number; contribucionRenovable: number; cumpleUmbralSpf: boolean } | null {
  if (qusableKWh === null || spf === null || spf === undefined) return null;
  const umbral = accionamiento === 'termica' ? SCOP_DHW_MINIMO_TERMICA : SCOP_DHW_MINIMO_ELECTRICA;
  const cumpleUmbralSpf = spf >= umbral;
  const crExacta = 1 - 1 / spf; // sin redondear, para no arrastrar error al Eres
  return {
    cumpleUmbralSpf,
    contribucionRenovable: cumpleUmbralSpf ? Number(crExacta.toFixed(4)) : 0,
    eresAnualKWh: cumpleUmbralSpf ? Number((qusableKWh * crExacta).toFixed(2)) : 0,
  };
}

// ── Provincias ─────────────────────────────────────────────────────────────────────────────────

/** Compara sin acentos, sin mayúsculas y sin barras («Alicante/Alacant» = «alicante»). */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * La tabla del anejo G va por CAPITAL de provincia (52 valores) y el trámite guarda el nombre de la
 * provincia. Se busca por nombre normalizado, admitiendo la forma compuesta del BOE
 * («Alicante/Alacant», «Bilbao/Bilbo», «Castellón/Castelló»). Si no se reconoce, null y sin cálculo.
 */
export function capitalDeProvincia(provincia: string | null | undefined): ProvinciaCapital | null {
  if (!provincia) return null;
  // El panel manda el nombre compuesto del BOE y la tabla del anejo G también: se comparan las
  // partes por separado, así «Alicante», «Alacant» y «Alicante/Alacant» caen en la misma fila.
  const buscadas = String(provincia).split('/').map(normalizar).filter(Boolean);
  if (buscadas.length === 0) return null;
  for (const valor of Object.values(ProvinciaCapital) as ProvinciaCapital[]) {
    const nombres = String(valor).split('/').map(normalizar).filter(Boolean);
    if (nombres.some((n) => buscadas.includes(n))) return valor;
  }
  return null;
}

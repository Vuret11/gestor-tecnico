/**
 * Instalaciones con VARIAS máquinas — reglas del instalador del 29-sep-2026:
 *
 * - «Puede ser una mezcla de máquinas o puede ser la misma máquina repetida. En caso de distintas
 *   máquinas, sumar potencias resultantes»: potencias, cargas de refrigerante, tCO₂eq y consumos
 *   SUMAN; multiplicando además por las unidades de cada modelo.
 * - «Sin límite [de máquinas] siempre que no supere el total 70 kW».
 * - Los RENDIMIENTOS (COP, SCOP, EER, ηs) no se suman: se declaran por máquina separados por «/»
 *   («COP: 3,45/4,5»), y solo cuando difieren.
 * - El umbral del RSIF se mira sobre la SUMA por refrigerante (ver `prefijoRefrigerante`).
 *
 * Todo lo de este módulo con UNA sola máquina y UNA unidad devuelve exactamente los mismos valores
 * que el código anterior de la app (misma fórmula, mismo redondeo): los expedientes ya emitidos no
 * cambian. Ese es el motivo de no reutilizar helpers genéricos que redondeen distinto.
 */
import { buscarGrupoRsif, buscarUmbralRefrigerante, clasificacionRefrigeranteImpreso, prefijoRefrigerante, toneladasCO2Equivalente } from './crm/normativa/rsif.constants';
import { Maquina, TipoUsoMaquina } from './crm/tipos';
import { MaquinaInstalacion } from './crm/tipos';
import { RegimenCalefaccion } from './crm/normativa/demanda.constants';

/**
 * ¿La instalación produce ACS con la bomba de calor?
 *
 * Decide si se marcan las casillas de ACS (MOD-315, secciones 1, 5 y 7, y MOD-318) y si el bloque de
 * ACS del MOD-318 lleva COP. Es un dato del **uso declarado** (climatización + ACS, o solo ACS) — una
 * instalación de **climatización sola** (7-oct-2026) NO produce ACS, así que tampoco se marca —, NO
 * de haber podido validar el HE4: antes esto era `resultado.acs.cumpleHe4 !== null`, así que cuando
 * el catálogo no publicaba el SCOP DHW (Midea) las casillas salían sin marcar, como si la instalación
 * no diera ACS — lo vio el instalador en el expediente 48 (30-sep-2026). Que falte un dato de
 * rendimiento no cambia lo que ES la instalación. En una híbrida con caldera el ACS lo hace la
 * caldera, así que no se marca.
 */
export function produceAcsConBombaDeCalor(entradas: { tipoUso?: TipoUsoMaquina } | null | undefined): boolean {
  const tipoUso = entradas?.tipoUso ?? TipoUsoMaquina.CLIMATIZACION_ACS;
  return tipoUso === TipoUsoMaquina.CLIMATIZACION_ACS || tipoUso === TipoUsoMaquina.SOLO_ACS;
}

/**
 * ¿La instalación CALIENTA con la bomba de calor? Es el otro dato del uso declarado y decide la
 * casilla «Calefacción» del MOD-315 (secciones 1 y 7) y la del tipo de instalación del MOD-318.
 *
 * Solo una instalación de SOLO ACS no calienta. Climatización + ACS, **climatización sola** (sin ACS,
 * añadida el 7-oct-2026) e híbrida con caldera sí calientan: en la híbrida la calefacción la da la
 * bomba de calor y el ACS la caldera, y en la de climatización sola simplemente no hay ACS.
 *
 * OJO: este dato es INDEPENDIENTE de haber podido validar el HE4 o de que el catálogo publique el
 * SCOP de ACS. Antes la casilla de Calefacción se deducía del uso «climatización + ACS» a pelo, y con
 * la opción nueva se habría quedado SIN marcar una instalación que sí calienta.
 */
export function produceCalefaccionConBombaDeCalor(
  entradas: { tipoUso?: TipoUsoMaquina } | null | undefined,
): boolean {
  const tipoUso = entradas?.tipoUso ?? TipoUsoMaquina.CLIMATIZACION_ACS;
  return tipoUso !== TipoUsoMaquina.SOLO_ACS;
}

/** Una máquina del catálogo junto con las unidades que lleva la instalación. */
export interface MaquinaConUnidades {
  maquina: Maquina;
  unidades: number;
}

/** Forma mínima del expediente que necesita el resolutor (no se ata a la entidad ni a TypeORM). */
export interface ExpedienteConMaquinas {
  maquinaId: number | null;
  maquinas: MaquinaInstalacion[] | null;
}

/** Lo mínimo que hay que saber de una máquina evaluada para poder decir cuál es en el documento. */
export interface MaquinaEvaluadaMinima {
  maquinaId: number;
  fabricante?: string | null;
  gama?: string | null;
  modelo?: string | null;
}

/** Forma mínima de la selección: la petición del correo y las máquinas evaluadas, en orden de ranking. */
export interface SeleccionConResultados<TResultado extends MaquinaEvaluadaMinima = MaquinaEvaluadaMinima> {
  id?: number;
  /**
   * Lo que pidió el correo, tal cual venía escrito (`marca:`/`modelo:`/`gama:`). Es la fuente de la
   * que sale QUÉ máquina hay que declarar: sin esto, un expediente sin máquina elegida acababa
   * declarando la primera del ranking, que puede ser de otra marca (pasó con un M-Thermon A).
   */
  entradas?: { fabricante?: string | null; modelo?: string | null; gama?: string | null } | null;
  resultados: TResultado[];
}

/**
 * No se ha podido saber qué máquina declarar y NO se elige otra por nuestra cuenta: declarar una
 * máquina que nadie ha pedido en un documento oficial (y con su COP, su carga de refrigerante y su
 * grupo del RSIF) es peor que no emitirlo.
 */
export class MaquinaNoResueltaError extends Error {}

/** Palabras con las que el correo pide la máquina (marca, gama, modelo), sin ruido. */
export function palabrasPedidas(seleccion: SeleccionConResultados<MaquinaEvaluadaMinima>): string[] {
  const texto = [seleccion.entradas?.fabricante, seleccion.entradas?.gama, seleccion.entradas?.modelo]
    .filter((valor) => typeof valor === 'string' && valor.trim() !== '')
    .join(' ');
  if (texto === '') return [];
  const palabras = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((palabra) => palabra.length >= 2);
  return [...new Set(palabras)];
}

/**
 * Máquina del expediente — SIEMPRE la que se ha pedido:
 *  1. la que declara el expediente (`maquinaId`), que tiene que estar entre las evaluadas;
 *  2. si no la declara, la que corresponde a lo pedido en el correo (marca/gama/modelo): entre las
 *     que coincidan se coge la primera del ranking, que ya ordena por encaje con la demanda
 *     (así «modelo: M-THERMON A» con 9,3 kW cae en el M-Thermon A 10 y no en el de 16);
 *  3. si no hay forma de saberlo, `alFallar` decide qué error sale — nunca se declara otra máquina.
 */
export function maquinaDelExpediente<TResultado extends MaquinaEvaluadaMinima>(
  expediente: ExpedienteConMaquinas,
  seleccion: SeleccionConResultados<TResultado>,
  alFallar: (mensaje: string) => never = (mensaje) => {
    throw new MaquinaNoResueltaError(mensaje);
  },
): TResultado {
  const evaluadas = seleccion.resultados ?? [];

  if (expediente.maquinaId) {
    const declarada = evaluadas.find((r) => r.maquinaId === expediente.maquinaId);
    if (!declarada) {
      return alFallar(
        `La máquina ${expediente.maquinaId} del expediente no está entre las ${evaluadas.length} evaluadas de la selección ${seleccion.id ?? ''}`.trim() +
          ' — revisa la selección o vuelve a elegir la máquina.',
      );
    }
    return declarada;
  }

  const palabras = palabrasPedidas(seleccion);
  if (palabras.length > 0 && evaluadas.length > 0) {
    // Se descartan las palabras que no están en NINGUNA máquina de la selección: son ruido del
    // correo (p. ej. «marca: DAIKIN» cuando la unidad es MIDEA) y exigirlas dejaría la búsqueda vacía.
    const utiles = palabras.filter((palabra) =>
      evaluadas.some((r) => textoDeMaquina(r).includes(palabra)),
    );
    const coincidencias =
      utiles.length > 0 ? evaluadas.filter((r) => utiles.every((p) => textoDeMaquina(r).includes(p))) : [];
    if (coincidencias.length > 0) return coincidencias[0];
    return alFallar(
      `La selección ${seleccion.id ?? ''} no tiene ninguna máquina de las que se piden` +
        ` («${[seleccion.entradas?.fabricante, seleccion.entradas?.modelo].filter(Boolean).join(' · ')}»)` +
        ` entre sus ${evaluadas.length} evaluadas. Elige la máquina a mano o corrige la selección.`.trim(),
    );
  }

  return alFallar(
    'El expediente no dice qué máquina lleva y la selección no guarda la petición del correo: ' +
      'indica la máquina (maquinaId) antes de generar los documentos.',
  );
}

/** Texto de una máquina evaluada donde buscar las palabras del pedido. */
function textoDeMaquina(resultado: MaquinaEvaluadaMinima): string {
  return `${resultado.fabricante ?? ''} ${resultado.gama ?? ''} ${resultado.modelo ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Máquinas de una instalación. Admite las dos formas:
 *  - nueva: `Expediente.maquinas` (varios modelos y/o varias unidades de cada uno);
 *  - antigua: `maquinaId` suelto → la máquina destacada; si el expediente no la dice, la que pide el
 *    correo (ver `maquinaDelExpediente`), NUNCA una cualquiera del ranking.
 *
 * Los expedientes anteriores no llevan lista, así que caen por el camino antiguo y siguen dando
 * exactamente el mismo resultado que antes.
 *
 * `cargar` es el acceso al catálogo (MaquinasService.findOne); se recibe como parámetro para poder
 * probar esta función sin base de datos.
 */
export async function resolverMaquinasInstalacion(
  expediente: ExpedienteConMaquinas,
  seleccion: SeleccionConResultados,
  cargar: (maquinaId: number) => Promise<Maquina>,
  alFallar?: (mensaje: string) => never,
): Promise<MaquinaConUnidades[]> {
  const declaradas = (expediente.maquinas ?? []).filter(
    (m) => m !== null && m !== undefined && Number(m.maquinaId) > 0 && Number(m.unidades) > 0,
  );

  if (declaradas.length > 0) {
    // En serie y no en paralelo: son 2-4 lecturas del catálogo y así el orden de `cargar` es estable
    // (importante para que los mapeos numeren las máquinas siempre igual).
    const resueltas: MaquinaConUnidades[] = [];
    for (const declarada of declaradas) {
      resueltas.push({ maquina: await cargar(declarada.maquinaId), unidades: declarada.unidades });
    }
    return resueltas;
  }

  const resultado = maquinaDelExpediente(expediente, seleccion, alFallar);
  return [{ maquina: await cargar(resultado.maquinaId), unidades: 1 }];
}

export interface TotalesInstalacion {
  /** Suma de la potencia calorífica nominal (kW) de todas las unidades. null si ninguna la trae. */
  potenciaCalorificaKW: number | null;
  /** Suma de la potencia frigorífica nominal (kW) de todas las unidades. */
  potenciaFrigorificaKW: number | null;
  /** Carga de refrigerante AGRUPADA POR REFRIGERANTE (kg): es lo que decide el umbral del RSIF. */
  cargaPorRefrigerante: Record<string, number>;
  /** Carga total de refrigerante de la instalación (kg), sumando todos los refrigerantes. */
  cargaTotalKg: number | null;
  /** Toneladas equivalentes de CO₂ de toda la instalación (Σ carga × PCA / 1000). */
  toneladasCO2EqTotal: number | null;
  /** Suma de las unidades de todas las máquinas (2 + 1 = 3). */
  unidadesTotales: number;
}

/**
 * Totales de la instalación. Con una máquina y una unidad devuelve los mismos números que antes de
 * admitir varias máquinas (misma fórmula y mismo redondeo a 4 decimales del CO₂).
 */
/**
 * Números de un dato que la ficha puede traer como RANGO («6,0-17,3», «4,4 a 12,8»). El «-» entre
 * dígitos es el separador del rango, no un signo.
 */
export function numerosDeRango(dato: unknown): number[] {
  if (typeof dato === 'number') return Number.isFinite(dato) ? [dato] : [];
  if (typeof dato !== 'string') return [];

  const numeros: number[] = [];
  for (const coincidencia of dato.matchAll(/-?\d+(?:[.,]\d+)?/g)) {
    const texto = coincidencia[0];
    const indice = coincidencia.index ?? 0;
    const esSeparadorDeRango = texto.startsWith('-') && indice > 0 && /\d/.test(dato[indice - 1]);
    const valor = Number(texto.replace(',', '.'));
    if (Number.isFinite(valor)) numeros.push(esSeparadorDeRango ? Math.abs(valor) : valor);
  }
  return numeros;
}

/**
 * Valor de un dato de ficha que puede venir como rango: se toma SIEMPRE EL MAYOR, que es el más
 * restrictivo (regla del instalador, 29-sep-2026). null si el dato no tiene ningún número.
 */
export function valorMasRestrictivo(dato: unknown): number | null {
  const numeros = numerosDeRango(dato);
  return numeros.length > 0 ? Math.max(...numeros) : null;
}

/**
 * Punto de ensayo EN 14511 de CALEFACCIÓN que hay que declarar para una máquina, con el respaldo que
 * indicó el instalador (5-oct-2026): con fancoils se coge el de **45 °C** y, si esa ficha no publica
 * el punto de 45, el de **55 °C** — el más restrictivo de los que sí publica. Nunca deja el dato en
 * blanco por un punto de ensayo que la ficha no trae.
 */
export function puntoCalefaccionDe(
  maquina: Maquina, regimen: RegimenCalefaccion,
): Record<string, unknown> | undefined {
  const puntos = ((maquina as any).datosVariante?.puntos_ensayo_EN14511 ?? {}) as
    Record<string, Record<string, unknown>>;
  if (regimen === 'A7W45') return puntos['A7W45'] ?? puntos['A7W55'];
  return puntos[regimen];
}

/** ¿Esa máquina publica ese punto de ensayo en su ficha técnica? */
export function tienePuntoEnsayo(maquina: Maquina, condicion: string): boolean {
  const puntos = ((maquina as any).datosVariante?.puntos_ensayo_EN14511 ?? {}) as
    Record<string, unknown>;
  return puntos[condicion] !== undefined;
}

export function potenciaCalorificaDeLaMaquina(maquina: Maquina): number | null {
  if (typeof maquina.potenciaCalorificaKW === 'number') return maquina.potenciaCalorificaKW;

  const puntos = (maquina.datosVariante as any)?.puntos_ensayo_EN14511 ?? {};
  const candidatos = ['A7W55', 'A7W45', 'A7W35']
    .flatMap((nombre) => [
      valorMasRestrictivo(puntos[nombre]?.potencia_calorifica_kW),
      valorMasRestrictivo(puntos[nombre]?.potencia_min_max_kW),
    ])
    .filter((valor): valor is number => typeof valor === 'number');
  return candidatos.length > 0 ? Math.max(...candidatos) : null;
}

/** Capacidad frigorífica de un equipo: el dato directo o, si la ficha solo da rango, el MAYOR. */
export function capacidadFrigorificaDeLaMaquina(maquina: Maquina): number | null {
  if (typeof maquina.potenciaFrigorificaKW === 'number') return maquina.potenciaFrigorificaKW;

  const puntos = (maquina.datosVariante as any)?.puntos_ensayo_EN14511 ?? {};
  const candidatos = ['A35W18', 'A35W7']
    .flatMap((nombre) => [
      valorMasRestrictivo(puntos[nombre]?.potencia_frigorifica_kW),
      valorMasRestrictivo(puntos[nombre]?.potencia_min_max_kW),
    ])
    .filter((valor): valor is number => typeof valor === 'number');
  return candidatos.length > 0 ? Math.max(...candidatos) : null;
}

/**
 * Cómo se llama lo que lleva la instalación, para que el aviso diga CUÁLES son y si son iguales
 * («2 × Genia Air Max 15 (máquinas iguales)» / «Genia Air Max 15 + Genia Air Split 12 (distintas)»):
 * el instalador tiene que ver de un vistazo qué máquinas ha cogido el programa, sin adivinar cuál es
 * la segunda (indicación del 29-sep-2026).
 */
export function descripcionMaquinasInstalacion(items: MaquinaConUnidades[]): string {
  const equipos = unidadesEnOrden(items);
  if (equipos.length === 0) return '';

  const modelos = [...new Set(equipos.map((item) => item.maquina.modelo))];
  if (equipos.length === 1) return modelos[0] ?? '';
  if (modelos.length === 1) return `${equipos.length} × ${modelos[0]} (máquinas iguales)`;

  const porModelo = modelos.map((modelo) => {
    const cuantas = equipos.filter((item) => item.maquina.modelo === modelo).length;
    return cuantas > 1 ? `${cuantas} × ${modelo}` : modelo;
  });
  return `${porModelo.join(' + ')} (máquinas distintas)`;
}

export function totalesInstalacion(items: MaquinaConUnidades[]): TotalesInstalacion {
  const suma = (extraer: (maquina: Maquina) => number | null | undefined): number | null => {
    let total = 0;
    let alguno = false;
    for (const { maquina, unidades } of items) {
      const valor = extraer(maquina);
      if (valor === null || valor === undefined) continue;
      total += valor * unidades;
      alguno = true;
    }
    return alguno ? redondear(total, 4) : null;
  };

  const cargaPorRefrigerante: Record<string, number> = {};
  let cargaTotalKg: number | null = null;
  let toneladasCO2EqTotal: number | null = null;

  for (const { maquina, unidades } of items) {
    const carga = maquina.cargaRefrigeranteKg;
    if (carga === null || carga === undefined) continue;

    const prefijo = prefijoRefrigerante(maquina.refrigerante);
    if (prefijo !== null) {
      cargaPorRefrigerante[prefijo] = redondear((cargaPorRefrigerante[prefijo] ?? 0) + carga * unidades, 4);
    }

    cargaTotalKg = redondear((cargaTotalKg ?? 0) + carga * unidades, 4);

    const co2 = toneladasCO2Equivalente(maquina.refrigerante, carga * unidades);
    if (co2 !== null) {
      toneladasCO2EqTotal = redondear((toneladasCO2EqTotal ?? 0) + co2, 4);
    }
  }

  return {
    potenciaCalorificaKW: suma((m) => potenciaCalorificaDeLaMaquina(m)),
    potenciaFrigorificaKW: suma((m) => capacidadFrigorificaDeLaMaquina(m)),
    cargaPorRefrigerante,
    cargaTotalKg,
    toneladasCO2EqTotal,
    unidadesTotales: items.reduce((total, item) => total + item.unidades, 0),
  };
}

/**
 * Umbral del RSIF para una instalación con varias máquinas: se compara la SUMA de cada refrigerante
 * con su umbral (R32 1,84 kg · R290 0,5 kg · R410A y R134A 2,5 kg).
 *
 * Devuelve `null` cuando NO se puede decidir — refrigerante sin umbral conocido o máquina sin carga
 * declarada —, que es el mismo trato que ya hace el cálculo por máquina: `null` se comporta como
 * «sí puede requerir» y nunca omite un documento que podría hacer falta.
 */
export function requiereMemoriaTecnicaInstalacion(items: MaquinaConUnidades[]): boolean | null {
  const { cargaPorRefrigerante } = totalesInstalacion(items);
  const grupos = Object.entries(cargaPorRefrigerante);

  if (grupos.length === 0) return null;

  let algunoIndecidible = false;
  for (const [refrigerante, cargaKg] of grupos) {
    const umbral = buscarUmbralRefrigerante(refrigerante);
    if (umbral === null) {
      algunoIndecidible = true;
      continue;
    }
    if (cargaKg > umbral.umbralKg) return true;
  }

  return algunoIndecidible ? null : false;
}

/** ¿El expediente declara su instalación con la lista de máquinas, en vez del `maquinaId` antiguo? */
export function declaraVariasMaquinas(expediente: ExpedienteConMaquinas): boolean {
  return (expediente.maquinas ?? []).some(
    (m) => m !== null && m !== undefined && Number(m.maquinaId) > 0 && Number(m.unidades) > 0,
  );
}

/**
 * «¿Hace falta Memoria Técnica Frigorífica?» a nivel de instalación — **el único sitio** donde se
 * decide, para que el checklist del expediente y los cuatro documentos que llevan la casilla digan
 * siempre lo mismo:
 *
 * - Expediente con lista de máquinas: se mira la SUMA de carga por refrigerante.
 * - Expediente sin lista (los anteriores): se respeta el valor que ya calculó la selección por
 *   máquina, sin recalcularlo — así ningún expediente emitido cambia de resultado.
 */
export function requiereMemoriaTecnicaDelExpediente(
  expediente: ExpedienteConMaquinas,
  items: MaquinaConUnidades[],
  valorPorMaquina: boolean | null | undefined,
): boolean | null {
  if (!declaraVariasMaquinas(expediente)) return valorPorMaquina ?? null;
  return requiereMemoriaTecnicaInstalacion(items);
}

/**
 * Suma de un dato de todas las máquinas, multiplicando por sus unidades («en caso de distintas
 * máquinas, sumar potencias resultantes»). Devuelve null si NINGUNA máquina trae el dato — nunca 0,
 * que en un documento se leería como un valor declarado.
 */
export function sumaPorMaquina(
  items: MaquinaConUnidades[],
  extraer: (maquina: Maquina) => number | null | undefined,
): number | null {
  let total = 0;
  let alguno = false;
  for (const { maquina, unidades } of items) {
    const valor = extraer(maquina);
    if (valor === null || valor === undefined) continue;
    total += valor * unidades;
    alguno = true;
  }
  return alguno ? redondear(total, 4) : null;
}

/**
 * Mayor valor entre las máquinas — para las casillas que piden «el mayor generador» y NO la suma
 * (p. ej. «Potencia nominal del mayor generador de calor kW»). Con una sola máquina coincide con su
 * valor, así que no cambia nada en los expedientes de una máquina.
 */
export function maximoPorMaquina(
  items: MaquinaConUnidades[],
  extraer: (maquina: Maquina) => number | null | undefined,
): number | null {
  let maximo: number | null = null;
  for (const { maquina } of items) {
    const valor = extraer(maquina);
    if (valor === null || valor === undefined) continue;
    if (maximo === null || valor > maximo) maximo = valor;
  }
  return maximo;
}

/**
 * Lista de máquinas expandida a UNA ENTRADA POR UNIDAD FÍSICA («2 × Genia Air Max 15» → dos
 * entradas). Es lo que necesitan las tablas del IF-190 y del RSIF, donde cada columna/fila es un
 * EQUIPO (cada bomba de calor hermética es su propio sistema de refrigeración), no un modelo.
 * Se respeta el orden de la instalación para que la columna 1 sea siempre la primera máquina.
 */
export function unidadesEnOrden(items: MaquinaConUnidades[]): MaquinaConUnidades[] {
  const expansion: MaquinaConUnidades[] = [];
  for (const { maquina, unidades } of items) {
    for (let i = 0; i < Math.max(1, Math.floor(unidades)); i += 1) {
      expansion.push({ maquina, unidades: 1 });
    }
  }
  return expansion;
}

/**
 * Carga de refrigerante por refrigerante, en el mismo orden que `refrigerantesPorMaquina`
 * («1,3/3,6»). Es la línea «Carga máxima de la instalación (kg por refrigerante)» del IF-190: con
 * varios refrigerantes se declara la de cada uno, y con uno solo el número de siempre.
 */
export function cargasPorRefrigeranteTexto(items: MaquinaConUnidades[], decimales = 4): number | string | null {
  const refrigerantes = refrigerantesPorMaquina(items);
  if (refrigerantes.length === 0) return null;

  const { cargaPorRefrigerante } = totalesInstalacion(items);
  const valores = refrigerantes.map((refrigerante) => cargaPorRefrigerante[refrigerante] ?? null);
  if (valores.every((valor) => valor === null)) return null;
  if (refrigerantes.length === 1) return valores[0];

  return valores.map((valor) => (valor === null ? 's.d.' : formatearDecimal(valor, decimales))).join('/');
}

/**
 * Lista de máquinas de un contexto de mapeo, ya expandida a una entrada por unidad física (usa
 * `maquinas` si viene y, si no, la máquina principal — así los mapeos que aún no la reciben siguen
 * funcionando igual que antes de admitir varias).
 */
export function maquinasDelContexto(ctx: {
  maquina: Maquina;
  maquinas?: MaquinaConUnidades[] | null;
}): MaquinaConUnidades[] {
  const items = ctx.maquinas && ctx.maquinas.length > 0 ? ctx.maquinas : [{ maquina: ctx.maquina, unidades: 1 }];
  return unidadesEnOrden(items);
}

/**
 * Punto de ensayo EN14511 de la ficha de una máquina («A7W55», «A7W35», «A35W18», «A35W7»…).
 */
export function puntoEnsayoDeMaquina(maquina: Maquina, condicion: string): Record<string, any> | undefined {
  return (maquina.datosVariante as any)?.puntos_ensayo_EN14511?.[condicion];
}

/**
 * Potencia absorbida por los compresores de un equipo en un punto de ensayo; si el punto no está en
 * la ficha cae al A7W35 (el que llevan todas). Vive aquí porque la usan el IF-190 (punto 3) y el
 * certificado RSIF (hoja 3) con el mismo criterio.
 */
export function potenciaAbsorbidaEnPunto(maquina: Maquina, punto: string): number | undefined {
  // Mismo criterio que el MOD-315 (`potenciaAbsorbidaMaquina`, en mapeos/mod-315.mapeo.ts): potencia
  // calorífica NOMINAL de la máquina entre el COP del punto de ensayo. Antes esto declaraba el
  // `potencia_absorbida_kW` de la ficha, así que el mismo trámite salía con dos potencias de
  // compresores distintas según el impreso (5,99 en el Certificado RSIF y el IF-190 frente a 5,94 en
  // el MOD-315, por 0,05 kW de diferencia en una máquina). El instalador exige que sea el mismo
  // número en todos. Si la ficha no trae COP, el dato directo queda como último recurso.
  const cop = puntoEnsayoDeMaquina(maquina, punto)?.COP;
  const nominal = maquina.potenciaCalorificaKW;
  if (typeof cop === 'number' && cop > 0 && typeof nominal === 'number') {
    return Math.round((nominal / cop) * 100) / 100;
  }

  const valor =
    puntoEnsayoDeMaquina(maquina, punto)?.potencia_absorbida_kW ??
    puntoEnsayoDeMaquina(maquina, 'A7W35')?.potencia_absorbida_kW;
  return typeof valor === 'number' ? valor : undefined;
}

/**
 * Suma de la potencia de accionamiento de TODOS los equipos (2 decimales, como el resto de la app).
 * Devuelve null si a alguno le falta el dato: una suma parcial declararía menos potencia de la que
 * hay en la instalación, y la fila vacía delata cuál falta.
 */
export function potenciaCompresoresTotalKW(items: MaquinaConUnidades[], punto: string): number | null {
  const valores = items.map((item) => potenciaAbsorbidaEnPunto(item.maquina, punto));
  if (valores.some((valor) => typeof valor !== 'number')) return null;
  const suma = (valores as number[]).reduce((total, valor) => total + valor, 0);
  // Con UN solo equipo se devuelve el valor de la ficha tal cual, sin redondear: los documentos de
  // una sola máquina siguen saliendo exactamente como antes de admitir varias.
  return valores.length === 1 ? suma : Number(suma.toFixed(2));
}

/**
 * Grupo de refrigerante del RSIF (L1/L2/L3, art. 4 del RD 552/2019) que pide el impreso. Con varios
 * refrigerantes distintos se declaran todos, en el orden de la instalación y sin repetir («L3/L1»).
 */
export function gruposRsifTexto(items: MaquinaConUnidades[]): string | null {
  const grupos = refrigerantesPorMaquina(items)
    .map((refrigerante) => buscarGrupoRsif(refrigerante))
    .filter((grupo): grupo is string => typeof grupo === 'string' && grupo.length > 0);
  const distintos = [...new Set(grupos)];
  return distintos.length > 0 ? distintos.join('/') : null;
}

/**
 * Clase de seguridad del refrigerante (A1/A2L/A3, EN 378 / anexo I del RD 552/2019) — es lo que
 * declaran las casillas de «inflamabilidad y toxicidad»: el instalador corrigió el 30-sep-2026 que
 * en un R32 va «A2L», no «L2» (el nivel L1/L2/L3 es el grupo reglamentario, que va en su propia
 * casilla). Con varios refrigerantes distintos se declaran todos, sin repetir («A2L/A3»).
 */
export function gruposSeguridadTexto(items: MaquinaConUnidades[]): string | null {
  const grupos = refrigerantesPorMaquina(items)
    .map((refrigerante) => clasificacionRefrigeranteImpreso(refrigerante))
    .filter((grupo): grupo is string => typeof grupo === 'string' && grupo.length > 0);
  const distintos = [...new Set(grupos)];
  return distintos.length > 0 ? distintos.join('/') : null;
}

/** Detalle de por qué se pide (o no) la memoria técnica — para el aviso del expediente. */
export function detalleUmbralPorRefrigerante(
  items: MaquinaConUnidades[],
): { refrigerante: string; cargaKg: number; umbralKg: number | null; supera: boolean | null }[] {
  const { cargaPorRefrigerante } = totalesInstalacion(items);
  return Object.entries(cargaPorRefrigerante).map(([refrigerante, cargaKg]) => {
    const umbral = buscarUmbralRefrigerante(refrigerante);
    return {
      refrigerante,
      cargaKg,
      umbralKg: umbral ? umbral.umbralKg : null,
      supera: umbral ? cargaKg > umbral.umbralKg : null,
    };
  });
}

/**
 * Valor de un rendimiento (COP, SCOP, EER, ηs) para el documento. Regla del instalador: los
 * rendimientos NO suman, se declaran por máquina separados por «/» («COP: 3,45/4,5») y solo si
 * difieren; si todas coinciden basta un valor.
 *
 * Con UNA sola máquina devuelve el NÚMERO, no texto: así el documento sale exactamente como antes.
 * Solo cuando hay varios valores distintos devuelve texto con coma decimal española, que es como lo
 * escribió el instalador.
 *
 * Si ALGUNA máquina no publica ese dato en su ficha se marca «s.d.» en su posición («s.d./3,65») en
 * vez de enseñar el valor de la otra como si fuera el de la instalación: los puntos de ensayo que
 * faltan son un hecho del catálogo (39 de 87 máquinas no publican COP a 55 °C) y el documento no
 * puede taparlos.
 */
export function valoresPorMaquina(
  items: MaquinaConUnidades[],
  extraer: (maquina: Maquina) => number | null | undefined,
  decimales = 2,
): number | string | null {
  const valores: (number | null)[] = items.map(({ maquina }) => {
    const valor = extraer(maquina);
    return valor === null || valor === undefined ? null : valor;
  });

  const presentes = valores.filter((valor): valor is number => valor !== null);
  if (presentes.length === 0) return null;

  if (items.length === 1) return presentes[0];

  if (presentes.length === valores.length) {
    // Sin ceros de relleno: el instalador escribió «COP: 3,45/4,5», no «4,50».
    return presentes.every((valor) => valor === presentes[0])
      ? presentes[0]
      : presentes.map((valor) => formatearDecimal(valor, decimales)).join('/');
  }

  return valores.map((valor) => (valor === null ? 's.d.' : formatearDecimal(valor, decimales))).join('/');
}

/**
 * Refrigerantes distintos de la instalación, en orden de aparición y con su carga: «R32/R290» y
 * «0,002/2,38» son los dos formatos que pidió el instalador para el MOD-315 cuando hay más de un
 * refrigerante (el del 315 lleva juntos los refrigerantes, el del IF-190 va junto a los valores de
 * cada máquina).
 */
export function refrigerantesPorMaquina(items: MaquinaConUnidades[]): string[] {
  const vistos: string[] = [];
  for (const { maquina } of items) {
    const prefijo = prefijoRefrigerante(maquina.refrigerante);
    if (prefijo === null || vistos.includes(prefijo)) continue;
    vistos.push(prefijo);
  }
  return vistos;
}

/** «R32/R290» si hay más de un refrigerante, o el único que haya. null si no hay dato. */
export function refrigerantesTexto(items: MaquinaConUnidades[]): string | null {
  const refrigerantes = refrigerantesPorMaquina(items);
  return refrigerantes.length > 0 ? refrigerantes.join('/') : null;
}

/**
 * Toneladas equivalentes de CO₂ por refrigerante, en el mismo orden que `refrigerantesPorMaquina`
 * («0,0039/1,0125»). Suma las unidades de cada refrigerante por separado.
 *
 * El redondeo es a 4 decimales porque es el que usa `toneladasCO2Equivalente` y el que ya llevan los
 * documentos de una sola máquina: recortar más aquí haría que el mismo dato saliera con un valor
 * distinto según lleve una máquina o varias (1,0125 → «1,012»).
 */
export function toneladasCO2Texto(items: MaquinaConUnidades[], decimales = 4): string | number | null {
  const refrigerantes = refrigerantesPorMaquina(items);
  if (refrigerantes.length === 0) return null;

  const porRefrigerante = refrigerantes.map((refrigerante) => {
    let cargaKg = 0;
    let hay = false;
    for (const { maquina, unidades } of items) {
      if (prefijoRefrigerante(maquina.refrigerante) !== refrigerante) continue;
      if (maquina.cargaRefrigeranteKg === null || maquina.cargaRefrigeranteKg === undefined) continue;
      cargaKg += maquina.cargaRefrigeranteKg * unidades;
      hay = true;
    }
    return hay ? toneladasCO2Equivalente(refrigerante, cargaKg) : null;
  });

  if (porRefrigerante.every((valor) => valor === null)) return null;
  if (refrigerantes.length === 1) {
    // Un solo refrigerante: número, para que el documento salga como siempre.
    return porRefrigerante[0];
  }

  return porRefrigerante
    .map((valor) => (valor === null ? '' : formatearDecimal(valor, decimales)))
    .join('/');
}

/**
 * Número con coma decimal española y sin ceros de relleno («4,5» en vez de «4,50», «2,38» en vez de
 * «2,380») — así es como el instalador escribió los ejemplos del correo.
 */
function formatearDecimal(valor: number, decimales: number): string {
  return String(Number(valor.toFixed(decimales))).replace('.', ',');
}

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/**
 * Declaración de máquinas tal y como la escribe el instalador (29-sep-2026): una máquina por línea,
 * con «xN» cuando hay varias unidades del mismo modelo.
 *
 *   M-Thermon A x2      → 2 unidades del M-Thermon A (el que encaje con la demanda)
 *   M Thermon A 12      → 1 unidad del M-Thermon A 12
 *
 * Se admite «x2», «X2», «×2», «2x», «2 ud», «2 unidades» y «(2)», delante o detrás del modelo, y
 * varias máquinas en una misma línea separadas por «+», «,» o «;». Todo lo que no sea una máquina
 * (líneas en blanco, comentarios con «#» o «//») se ignora.
 */

/** Una línea de la declaración: la máquina escrita a mano y cuántas unidades son. */
export interface DeclaracionMaquina {
  /** La máquina tal cual la ha escrito el instalador (sin el «x2»). */
  texto: string;
  /** Unidades de ese modelo: 1 si no lo dice. */
  unidades: number;
}

/** Separa las máquinas de una línea (varias máquinas en la misma línea) y las líneas entre sí. */
const SEPARADOR = /[\n\r;+]|,(?![^(]*\))/;

/**
 * «x2», «2x», «× 2», «2 ud(es)», «2 unidades», «(2)» — las formas de decir cuántas unidades.
 *
 * El «x» NO puede ser la letra final de una palabra: sin ese requisito, «Genia Air Max 12» se leería
 * como «Genia Air Ma» + 12 unidades, porque la «x» de «Max» está pegada al número. Con la excepción,
 * «A 10x2» (x pegada a un número) sigue valiendo, que es como lo escribe mucha gente.
 */
const DETRAS = /(?:\s*[([]?\s*(?<![A-Za-zÀ-ÿ])(?:x|×)\s*(\d{1,3})\s*[)\]]?|\s*(\d{1,3})\s*(?:ud|uds|unidad|unidades)\.?\s*|\s*[([]\s*(\d{1,3})\s*[)\]])$/i;
const DELANTE = /^\s*(\d{1,3})\s*[x×]\s*/i;

/**
 * Lee la declaración y devuelve una entrada por máquina, en el orden en que la ha escrito.
 * Lanza si no hay ninguna máquina: una declaración vacía no es «ninguna máquina».
 */
export function leerDeclaracionMaquinas(declaracion: string | null | undefined): DeclaracionMaquina[] {
  if (!declaracion) return [];
  const maquinas: DeclaracionMaquina[] = [];

  for (const trozo of String(declaracion).split(SEPARADOR)) {
    const linea = trozo.trim();
    if (linea === '' || linea.startsWith('#') || linea.startsWith('//')) continue;

    let unidades = 1;
    let texto = linea;

    const delante = texto.match(DELANTE);
    if (delante) {
      unidades = Number(delante[1]);
      texto = texto.slice(delante[0].length);
    }

    const detras = texto.match(DETRAS);
    if (detras) {
      unidades = Number(detras[1] ?? detras[2] ?? detras[3]);
      texto = texto.slice(0, detras.index ?? 0);
    }

    // «M-Thermon A 10 KW» → se quita la unidad de potencia: el catálogo no la lleva en el modelo.
    texto = texto.replace(/\s*\b(kw|kw\.|kilovatios)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
    if (texto === '') continue;

    maquinas.push({ texto, unidades: unidades > 0 ? unidades : 1 });
  }

  return maquinas;
}

/** El texto de la máquina sin acentos, en mayúsculas y con separadores uniformes, para comparar. */
export function normalizarTextoMaquina(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * El texto preparado para comparar: además de normalizado, separa la letra del número
 * («M-Thermon A10» → «A 10»), que es como lo escribe la mitad de la gente y como lo publica el
 * catálogo («M-Thermon A 10»).
 */
function prepararTexto(texto: string | null | undefined): string {
  return normalizarTextoMaquina(texto).replace(/([A-Z])(\d)/g, '$1 $2');
}

/**
 * Palabras significativas del texto. Las de una sola letra SÍ cuentan («M-THERMON **A**» no es lo
 * mismo que «M-THERMON HT»), pero se comparan como palabra completa, no como trozo de otra palabra:
 * si no, la «A» daría por buena cualquier máquina que llevara una «a» en el nombre.
 */
export function palabrasDeMaquina(texto: string | null | undefined): string[] {
  return prepararTexto(texto)
    .split(' ')
    .filter((palabra) => palabra.length >= 1);
}

/** Campos de una máquina del catálogo donde se busca lo que ha escrito el instalador. */
export interface MaquinaBuscable {
  modelo?: string | null;
  gama?: string | null;
  fabricante?: string | null;
  codigoFabricante?: string | null;
}

/** ¿La máquina del catálogo responde a todas las palabras de la declaración? */
export function respondeAlTexto(texto: string, maquina: MaquinaBuscable): boolean {
  const palabras = palabrasDeMaquina(texto);
  if (palabras.length === 0) return false;
  const heno = prepararTexto(
    [maquina.fabricante, maquina.gama, maquina.modelo, maquina.codigoFabricante].filter(Boolean).join(' '),
  );
  const palabrasHeno = heno.split(' ').filter((palabra) => palabra !== '');
  // Las palabras de una letra («A») tienen que ser una palabra del nombre; el resto vale con que
  // aparezcan (así «THERMONA» o «MTHERMON» encuentran el M-Thermon).
  return palabras.every((palabra) =>
    palabra.length >= 2 ? heno.includes(palabra) : palabrasHeno.includes(palabra),
  );
}

/** Máquina del catálogo con su id, para poder resolver la declaración. */
export interface MaquinaDelCatalogo extends MaquinaBuscable {
  id: number;
}

/** Lo que se guarda en el expediente: qué máquina y cuántas unidades. */
export interface MaquinaDeclarada {
  maquinaId: number;
  unidades: number;
}

/**
 * Pasa la declaración escrita a máquinas del catálogo.
 *
 * Cuando una línea encaja con varios modelos («M-Thermon A» son siete: del 4 al 16) se coge la
 * primera del RANKING de la selección, que ya ordena por encaje con la demanda — así «M-Thermon A»
 * con 9,3 kW cae en el M-Thermon A 10. Nunca se elige por orden de catálogo: si no hay ranking que
 * decida, se avisa con las candidatas en la mano en vez de declarar una máquina al azar.
 */
export function resolverDeclaracionMaquinas(
  declaracion: string | null | undefined,
  catalogo: MaquinaDelCatalogo[],
  ranking: number[] = [],
  alFallar: (mensaje: string) => never = (mensaje) => {
    throw new Error(mensaje);
  },
): MaquinaDeclarada[] {
  const lineas = leerDeclaracionMaquinas(declaracion);
  if (lineas.length === 0) return [];

  const posicion = new Map<number, number>();
  ranking.forEach((maquinaId, indice) => posicion.set(maquinaId, indice));

  const declaradas: MaquinaDeclarada[] = [];
  for (const linea of lineas) {
    const candidatas = catalogo.filter((maquina) => respondeAlTexto(linea.texto, maquina));
    if (candidatas.length === 0) {
      return alFallar(`No encuentro en el catálogo ninguna máquina que responda a «${linea.texto}» — revisa el modelo o la marca.`);
    }

    let elegida = candidatas.find((maquina) => normalizarTextoMaquina(maquina.modelo) === normalizarTextoMaquina(linea.texto));
    if (!elegida && candidatas.length === 1) {
      [elegida] = candidatas;
    }
    if (!elegida) {
      const enRanking = candidatas
        .filter((maquina) => posicion.has(maquina.id))
        .sort((a, b) => (posicion.get(a.id) as number) - (posicion.get(b.id) as number));
      if (enRanking.length === 0) {
        return alFallar(
          `«${linea.texto}» encaja con ${candidatas.length} máquinas (${candidatas.map((m) => m.modelo).join(', ')}) ` +
            'y ninguna está en el ranking de la selección: escribe el modelo completo.',
        );
      }
      [elegida] = enRanking;
    }

    declaradas.push({ maquinaId: elegida.id, unidades: linea.unidades });
  }

  return declaradas;
}

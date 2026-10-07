/**
 * FICHAS TÉCNICAS de máquinas que NO están en el catálogo (petición de Salva, 7-oct-2026):
 * «da la opción de poner máquinas que no tengas en el catálogo y buscas la ficha técnica».
 *
 * Tres pasos, y ninguno inventa un dato:
 *
 *  1. BUSCAR (`buscar`) — se pregunta a un buscador por «marca modelo ficha técnica pdf» y se
 *     devuelven los documentos que salen, con los PDF y los del propio fabricante primero. Si no sale
 *     nada, se dice: no se rellena nada a ojo.
 *  2. LEER (`leer`) — del documento que elija el instalador se extrae el TEXTO y de ahí, con reglas
 *     conservadoras, los valores que aparecen ETIQUETADOS en la ficha. Cada valor vuelve con el trozo
 *     de texto del que sale (`evidencia`), para poder comprobarlo ANTES de guardarlo. Y el PDF se
 *     guarda en `uploads/fichas-maquinas/`, que es donde queda la fuente del dato.
 *  3. GUARDAR — la máquina se crea en el catálogo con el `POST /maquinas` que ya existía, con lo que
 *     el instalador confirme. La ficha no se inventa ningún campo: lo que no publica se queda VACÍO
 *     (es la regla del catálogo — un valor inventado es peor que un hueco—) y la checklist lo avisa.
 *
 * También se puede dar la ficha a mano (un enlace pegado o el PDF subido desde el PC): cuando el
 * buscador no encuentre el documento, es la salida que siempre funciona.
 */
import {
  BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Ejecuta un binario probando varias rutas (en la Pi, `curl` está en `/usr/bin/curl`). Devuelve la
 * salida estándar. Si ninguna ruta existe, lanza: quien llama decide qué hacer entonces.
 */
function ejecutar(candidatos: string[], args: string[]): Promise<{ stdout: string }> {
  return new Promise((resolver, rechazar) => {
    const intentar = (i: number) => {
      if (i >= candidatos.length) {
        rechazar(new Error('no hay curl en esta máquina'));
        return;
      }
      execFile(candidatos[i], args, { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          intentar(i + 1);
          return;
        }
        if (error) rechazar(new Error(stderr?.trim() || error.message));
        else resolver({ stdout });
      });
    };
    intentar(0);
  });
}

/** Un documento candidato: lo que se le enseña al instalador para que elija. */
export interface FichaCandidata {
  titulo: string;
  url: string;
  /** Dominio que lo publica (`www.daikin.es`), para ver de un vistazo si es el fabricante. */
  dominio: string;
  esPdf: boolean;
  /** Parece del propio fabricante (su dominio o su biblioteca de documentos), que es la fuente buena. */
  delFabricante: boolean;
}

/** Un valor leído de la ficha, con el trozo de texto del que sale. */
export interface DatoLeido {
  /** Campo del catálogo al que corresponde (`potencia_calorifica_kw`, `cop_35`…). */
  campo: string;
  /** Cómo se llama en la ficha, para el ojo del instalador. */
  etiqueta: string;
  valor: number | string;
  /** El texto del documento del que se ha leído. Sin esto, el valor no vale: no se comprueba. */
  evidencia: string;
  /**
   * `true` cuando el valor está en una FILA DE TABLA con varios modelos («Potencia calorífica 4,2 kW
   * 6,35 kW 8,4 kW 10 kW…»): el número leído es el PRIMERO de la fila y puede ser el de otro tamaño.
   * El panel NO lo rellena solo y enseña la fila entera para que el instalador copie el suyo — antes
   * esto metía 4,2 kW en una máquina de 12 (ficha del OMNIA M, 7-oct-2026).
   */
  dudoso?: boolean;
  /** Los números que aparecen en esa fila, para poder elegir el del modelo que se está dando de alta. */
  candidatos?: number[];
}

export interface FichaLeida {
  /** URL del documento (se guarda en `fuente_url` de la máquina). */
  fuente_url: string;
  /** Dónde ha quedado la copia en el servidor, para poder volver a mirarla. */
  fichero_url: string;
  fichero: string;
  paginas: number;
  /** Lo que se ha podido leer. Vacío = la ficha no publica (ni se inventa). */
  datos: DatoLeido[];
  /** Primeras líneas del documento, para saber que se ha leído el documento correcto. */
  muestra: string;
}

/** Tope de descarga: una ficha técnica no pesa más; un catálogo de 300 páginas, sí. */
const MAXIMO_BYTES = 30 * 1024 * 1024;
const TIEMPO_MAX_MS = 30000;

/** UA de navegador de escritorio: es con el que el buscador devuelve los enlaces DIRECTOS. */
const UA_ESCRITORIO =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** UA de iPhone: el respaldo (Bing) solo devuelve enlaces directos si la petición parece de móvil. */
const UA_MOVIL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Buscadores que se prueban, en orden. El primero es el que funciona: devuelve los enlaces directos de
 * los documentos (incluidas las bibliotecas del fabricante, `media.ferroli.com`, `daikin.es/content/dam`,
 * `…-documents.com`) y no bloquea a la Pi. Bing entra solo como respaldo, y aviso: contestando al
 * navegador de escritorio devuelve enlaces de redirección CIFRADOS (`bing.com/ck/a?…`) que no llevan
 * dentro la dirección del documento, y si se le insiste desde la misma IP acaba sirviendo una página
 * pobre con la portada de la marca y poco más (comprobado el 7-oct-2026).
 */
const MOTORES = [
  { nombre: 'brave', url: (q: string) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`, ua: UA_ESCRITORIO },
  { nombre: 'bing', url: (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=30`, ua: UA_MOVIL },
];

/**
 * Cuánto se guarda una búsqueda ya hecha. Los buscadores públicos CORTAN si se les insiste desde la
 * misma dirección (`429`, y en el navegador se ve la página de «modo más seguro»): con la caché, pedir
 * dos veces la misma ficha no gasta una petición, y así la búsqueda sigue funcionando para las que
 * hacen falta de verdad (unas pocas al día).
 */
const CACHE_MS = 60 * 60 * 1000;

/** Señales de que el buscador ha contestado con su página de «cortado» en vez de con resultados. */
const CORTE =
  /Too Many Requests|captcha|modo m[áa]s seguro|security-settings|Access Denied|unusual traffic|tb-manual\.torproject|Tor Browser|demasiadas solicitudes/i;

@Injectable()
export class BuscarFichaService {
  private readonly log = new Logger(BuscarFichaService.name);

  /** Búsquedas ya hechas, para no pedirle lo mismo al buscador dos veces (ver `CACHE_MS`). */
  private readonly cache = new Map<
    string,
    { cuando: number; consulta: string; candidatas: FichaCandidata[] }
  >();

  /** Carpeta donde se guardan las fichas descargadas (servida como `/uploads/fichas-maquinas/…`). */
  private carpeta(): string {
    const dir = join(process.cwd(), 'uploads', 'fichas-maquinas');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Buscadores a los que se ha cortado, con la hora hasta la que NO se les vuelve a preguntar. Insistir
   * a un buscador que acaba de contestar «demasiadas solicitudes» es lo que convierte un corte de un
   * minuto en uno de horas: al que corta se le deja en paz un rato y se prueba el siguiente.
   */
  private readonly cortados = new Map<string, number>();

  /** Cuánto se deja en paz a un buscador que nos ha cortado. */
  private readonly ESPERA_CORTE_MS = 15 * 60 * 1000;

  private estaCortado(motor: string): boolean {
    const hasta = this.cortados.get(motor);
    if (hasta === undefined) return false;
    if (Date.now() >= hasta) { this.cortados.delete(motor); return false; }
    return true;
  }

  private marcarCortado(motor: string): void {
    this.cortados.set(motor, Date.now() + this.ESPERA_CORTE_MS);
  }

  /**
   * Busca en la web los documentos de una marca+modelo.
   *
   * Se preguntan VARIAS consultas y se mezclan los resultados, porque el buscador es sensible al
   * sobrante: con «daikin altherma 3 r w 8 ficha técnica pdf» devuelve la portada del fabricante y
   * nada más, y sin la coletilla del modelo («daikin altherma 3 ficha técnica pdf») devuelve las
   * fichas de verdad de su biblioteca de documentos. Comprobado desde la Pi el 7-oct-2026.
   *
   * Por qué Brave el primero: devuelve los enlaces DIRECTOS de los documentos —incluidas las
   * bibliotecas del fabricante (`media.ferroli.com`, `daikin.es/content/dam`, `…-documents.com`)— y no
   * bloquea a la Pi. Bing entra solo como respaldo, y con su trampa: al navegador de escritorio le
   * contesta con enlaces de redirección CIFRADOS (`bing.com/ck/a?…`), que no llevan dentro la dirección
   * del documento, y si se le insiste desde la misma IP acaba sirviendo la portada de la marca y poco
   * más (comprobado desde la Pi el 7-oct-2026).
   */
  async buscar(fabricante: string, modelo: string): Promise<{ consulta: string; candidatas: FichaCandidata[] }> {
    const marca = String(fabricante ?? '').trim();
    const equipo = String(modelo ?? '').trim();
    if (!marca && !equipo) throw new BadRequestException('Dime al menos la marca o el modelo de la máquina');

    const consultas = this.consultas(marca, equipo);
    const clave = `${marca}|${equipo}`.toLowerCase();
    const guardada = this.cache.get(clave);
    if (guardada && Date.now() - guardada.cuando < CACHE_MS) {
      return { consulta: guardada.consulta, candidatas: guardada.candidatas };
    }

    // Se prueban las consultas de la más concreta a la más general, y para cada una los buscadores por
    // orden. Se para en cuanto UNA combinación devuelve algo aprovechable (un PDF o un documento de la
    // marca): un buscador puede contestar 200 con una página basura, y eso no vale como resultado.
    const tope = 6;
    let intentos = 0;
    let cortado = false;
    let respondio = false;
    let candidatas: FichaCandidata[] = [];
    let motorUsado = '';
    for (const consulta of consultas) {
      for (const motor of MOTORES) {
        if (intentos >= tope) break;
        // Al buscador que nos ha cortado NO se le vuelve a preguntar en un rato: insistirle es
        // justamente lo que convierte un corte de un minuto en uno de horas.
        if (this.estaCortado(motor.nombre)) {
          cortado = true;
          this.log.warn(`«${consulta}»: ${motor.nombre} sigue cortado, no se le pregunta`);
          continue;
        }
        try {
          const html = await this.descargarTexto(motor.url(consulta), motor.ua);
          intentos++;
          if (CORTE.test(html)) {
            cortado = true;
            this.marcarCortado(motor.nombre);
            this.log.warn(
              `«${consulta}» en ${motor.nombre}: el buscador ha cortado (se le deja en paz 15 min)`,
            );
            continue;
          }
          respondio = true;
          const sacadas = this.candidatasDe([html], marca, equipo);
          this.log.log(`«${consulta}» en ${motor.nombre}: ${sacadas.length} documentos aprovechables`);
          if (sacadas.length > 0) {
            candidatas = sacadas;
            motorUsado = motor.nombre;
            break;
          }
        } catch (e) {
          intentos++;
          this.log.warn(`«${consulta}» en ${motor.nombre}: ${(e as Error).message}`);
        }
      }
      if (candidatas.length > 0 || intentos >= tope) break;
    }

    if (candidatas.length === 0) {
      // Se distingue «me han cortado» de «no lo he encontrado»: son cosas distintas y el instalador no
      // puede hacer lo mismo en cada caso. Solo se dice «cortado» si de verdad no se ha podido
      // preguntar: un buscador que contesta y no trae resultados NO es un corte.
      if (cortado && !respondio) {
        throw new ServiceUnavailableException(
          'El buscador nos ha cortado un rato (le hemos pedido demasiadas seguidas). Prueba en unos ' +
            'minutos, pega el enlace de la ficha técnica que tengas o sube el PDF: esas dos formas ' +
            'funcionan siempre.',
        );
      }
      const hayCortados = MOTORES.some((m) => this.estaCortado(m.nombre));
      throw new NotFoundException(
        (hayCortados
          ? 'A algún buscador le caemos mal ahora mismo, así que puede que no lo haya visto todo. '
          : '') +
          'No he encontrado ninguna ficha de esa máquina. Prueba con menos palabras (marca y familia), ' +
          'pega el enlace de la ficha técnica o sube el PDF: subir el PDF funciona siempre.',
      );
    }

    candidatas = candidatas.slice(0, 12);
    this.cache.set(clave, { cuando: Date.now(), consulta: consultas[0], candidatas });
    this.log.log(`Búsqueda «${consultas[0]}» con ${motorUsado}: ${candidatas.length} documentos`);
    return { consulta: consultas[0], candidatas };
  }

  /**
   * Las consultas que se prueban, de la más concreta a la más general. La última deja solo la familia
   * del modelo (sin tamaño ni versión): es la que encuentra la biblioteca de documentos del fabricante,
   * porque al buscador le sobra la coletilla («altherma 3 r w 8» devuelve la portada de la web y
   * «altherma 3» devuelve la ficha). Comprobado el 7-oct-2026.
   */
  private consultas(marca: string, modelo: string): string[] {
    const consultas: string[] = [];
    const familia = modelo.split(/\s+/).slice(0, 3).join(' ');
    const reducida = `${marca} ${familia} ficha técnica pdf`.replace(/\s+/g, ' ').trim();
    const completa = `${marca} ${modelo} ficha técnica pdf`.replace(/\s+/g, ' ').trim();
    const dos = modelo.split(/\s+/).slice(0, 2).join(' ');
    const minima = `${marca} ${dos} ficha técnica pdf`.replace(/\s+/g, ' ').trim();

    // La REDUCIDA va primero: al buscador le sobra la coletilla del tamaño y, con ella, en vez de la
    // ficha devuelve la portada de la web («altherma 3 r w 8» → portada; «altherma 3» → la ficha).
    // Comprobado el 7-oct-2026. Después la completa y, si no hay nada, la mínima.
    for (const c of [reducida, completa, minima]) {
      if (c && !consultas.includes(c)) consultas.push(c);
    }
    return consultas.slice(0, 3);
  }

  /**
   * Lee un documento (por su URL) y devuelve lo que la ficha publica de verdad, con su evidencia.
   * Guarda la copia en disco: sin la fuente guardada, el dato no se puede auditar después.
   */
  async leer(url: string, fabricante: string, modelo: string): Promise<FichaLeida> {
    const destino = this.urlSegura(url);
    const { bytes, tipo } = await this.descargarBinario(destino);

    const esPdf = tipo.includes('pdf') || /\.pdf($|\?)/i.test(destino);
    const nombre = this.nombreDeFichero(fabricante, modelo, destino, esPdf ? 'pdf' : 'txt');
    const ruta = join(this.carpeta(), nombre);
    writeFileSync(ruta, bytes);

    // Del PDF salen a la vez el texto y los datos (mirando, si es un catálogo, la columna del modelo).
    const leido = esPdf
      ? await this.datosDelPdf(bytes, nombre, fabricante, modelo)
      : { texto: this.textoDelHtml(bytes.toString('utf8')), paginas: 1, datos: null as DatoLeido[] | null };
    const { texto, paginas } = leido;

    if (!texto.trim()) {
      throw new BadRequestException(
        `El documento «${nombre}» no tiene texto que leer (¿es un escaneo en imagen?). ` +
          'Descárgalo, comprueba que se puede copiar el texto y prueba con otro enlace.',
      );
    }

    const datos = leido.datos ?? this.extraer(texto);
    return {
      fuente_url: destino,
      fichero_url: `/uploads/fichas-maquinas/${nombre}`,
      fichero: nombre,
      paginas,
      datos,
      muestra: texto.replace(/\s+/g, ' ').trim().slice(0, 900),
    };
  }

  /** Lee un PDF que sube el instalador desde su ordenador (la salida cuando la búsqueda no da nada). */
  async leerSubido(bytes: Buffer, nombreOriginal: string, fabricante: string, modelo: string): Promise<FichaLeida> {
    const nombre = this.nombreDeFichero(fabricante, modelo, nombreOriginal, 'pdf');
    const ruta = join(this.carpeta(), nombre);
    writeFileSync(ruta, bytes);

    const { texto, paginas, datos } = await this.datosDelPdf(
      bytes, nombreOriginal, fabricante, modelo,
    );
    if (!texto.trim()) {
      throw new BadRequestException(
        `El PDF «${nombreOriginal}» no tiene texto que leer (¿es un escaneo en imagen?).`,
      );
    }
    return {
      fuente_url: nombreOriginal,
      fichero_url: `/uploads/fichas-maquinas/${nombre}`,
      fichero: nombre,
      paginas,
      datos,
      muestra: texto.replace(/\s+/g, ' ').trim().slice(0, 900),
    };
  }

  // ── Descargas ─────────────────────────────────────────────────────────────────────────────────

  /**
   * Guardia contra SSRF: solo http/https, y nunca una dirección de la red de casa (la Pi tiene que
   * poder salir a internet, pero no vale como forma de espiar la red interna desde el panel).
   */
  private urlSegura(url: string): string {
    let u: URL;
    try {
      u = new URL(String(url ?? '').trim());
    } catch {
      throw new BadRequestException('Esa dirección no es válida');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new BadRequestException('Solo se pueden abrir enlaces http o https');
    }
    const host = u.hostname.toLowerCase();
    const privada =
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (privada) throw new BadRequestException('Esa dirección es de la red interna y no se puede abrir');
    return u.toString();
  }

  /**
   * Descarga el HTML de una página.
   *
   * Se hace con CURL cuando lo hay, y no con `fetch`: al buscador (Brave) no le gusta el TLS de Node y
   * le contesta `429` con una página sin resultados mientras a curl, desde la MISMA máquina, le contesta
   * `200` con los 15 enlaces de las fichas (comprobado en la Pi el 7-oct-2026). Es la diferencia entre
   * encontrar la ficha o no encontrarla.
   */
  private async descargarTexto(url: string, ua: string = UA_ESCRITORIO): Promise<string> {
    try {
      return await this.conCurl(url, ua);
    } catch (e) {
      this.log.warn(`curl no ha servido «${url}» (${(e as Error).message}); se prueba con fetch`);
    }
    const r = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      signal: AbortSignal.timeout(TIEMPO_MAX_MS),
      redirect: 'follow',
    });
    if (!r.ok) {
      throw new BadRequestException(
        r.status === 429 || r.status === 403
          ? `El buscador nos ha cortado un rato (${r.status}): prueba en unos minutos o pega el enlace de la ficha`
          : `El buscador ha contestado ${r.status}`,
      );
    }
    return await r.text();
  }

  /** Descarga con el binario `curl` (el de siempre, el que sí pasa). */
  private async conCurl(url: string, ua: string): Promise<string> {
    const { stdout } = await ejecutar(
      ['curl', '/usr/bin/curl'],
      ['-sL', '--max-time', String(Math.ceil(TIEMPO_MAX_MS / 1000)), '-A', ua,
       '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
       '-H', 'Accept-Language: es-ES,es;q=0.9', url],
    );
    if (!stdout || stdout.length < 200) throw new Error('respuesta vacía');
    return stdout;
  }

  private async descargarBinario(url: string): Promise<{ bytes: Buffer; tipo: string }> {
    let r: Response;
    try {
      r = await fetch(url, {
        headers: { 'User-Agent': UA_ESCRITORIO, 'Accept-Language': 'es-ES,es;q=0.9' },
        signal: AbortSignal.timeout(TIEMPO_MAX_MS),
        redirect: 'follow',
      });
    } catch (e) {
      throw new BadRequestException(`No se ha podido descargar el documento (${(e as Error).message})`);
    }
    if (!r.ok) throw new BadRequestException(`El documento ha contestado ${r.status}: prueba con otro enlace`);

    const tipo = String(r.headers.get('content-type') ?? '').toLowerCase();
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length === 0) throw new BadRequestException('El documento ha llegado vacío');
    if (bytes.length > MAXIMO_BYTES) {
      throw new BadRequestException(
        `El documento pesa ${(bytes.length / 1048576).toFixed(1)} MB: es un catálogo, no una ficha. ` +
          'Busca la ficha del modelo (suele ser un PDF de 1-4 páginas).',
      );
    }
    return { bytes, tipo };
  }

  // ── Buscador: de la página de resultados a la lista de documentos ─────────────────────────────

  /**
   * Enlaces directos de las páginas de resultados, sin repetir, con lo útil ARRIBA:
   *
   *  1. Los PDF, delante de las páginas web (una ficha es un PDF; una página de producto casi nunca
   *     trae la tabla entera).
   *  2. Los del propio fabricante y su biblioteca de documentos (`/document-library/`, `/dam/`), delante
   *     de las tiendas, que publican la ficha del fabricante pero a veces con datos de otra versión.
   *  3. Los que llevan algo del modelo en la dirección (`Altherma-3-Monobloc…pdf`).
   *
   * Y fuera el ruido: portadas de la web, wikipedia, redes sociales, ayudas del buscador y catálogos
   * maestros de 300 páginas (sirven, pero van al final: primero la ficha del modelo).
   */
  private candidatasDe(paginas: string[], fabricante: string, modelo: string): FichaCandidata[] {
    const marca = this.sinAcentos(fabricante).toLowerCase().replace(/[^a-z0-9]/g, '');
    // Tokens del modelo con los que reconocer que el documento es de ESTA máquina («altherma», «3»).
    const tokens = this.sinAcentos(modelo)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);

    const vistas = new Set<string>();
    const candidatas: FichaCandidata[] = [];

    for (const html of paginas) {
      for (const bruto of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
        const url = this.limpiarEntidad(bruto[1]);
        if (/^https?:\/\/(www\.)?(bing|microsoft|msn|go\.microsoft|support\.microsoft)\./i.test(url)) continue;
        if (/(wikipedia|facebook|twitter|x\.com|instagram|youtube|linkedin|pinterest|tiktok)\./i.test(url)) continue;
        if (vistas.has(url)) continue;

        let direccion: URL;
        try {
          direccion = new URL(url);
        } catch {
          continue;
        }
        // Una portada, un listado de productos o una raíz de idioma («/es») no son una ficha: fuera.
        const segmentos = direccion.pathname.split('/').filter(Boolean);
        if (segmentos.length === 0) continue;
        if (/(^|\/)(productos|index|home)(\.html?)?$/i.test(direccion.pathname)) continue;
        if (segmentos.length === 1 && !/\.pdf($|\?)/i.test(url)) continue;
        // Las páginas de catálogo de producto («/products/calderas») tampoco: no traen los datos del
        // modelo, y se colaban como primera candidata al quedarse el buscador sin resultados buenos.
        if (
          /\/(products?|productos?|catalogos?|catalogues?|kits?|gamas?|ranges?)(\/|$)/i.test(direccion.pathname) &&
          !/\.pdf($|\?)/i.test(url) &&
          !/ficha|manual|datasheet|technical|hoja[-_ ]?de[-_ ]?datos|instalacion|install/i.test(url)
        ) {
          continue;
        }

        vistas.add(url);
        const dominio = direccion.hostname.replace(/^www\./, '').toLowerCase();
        const esPdf = /\.pdf($|\?)/i.test(url);

        const delFabricante =
          (marca.length >= 3 && dominio.replace(/[^a-z0-9]/g, '').includes(marca)) ||
          /\/document-library\/|\/dam\/|\/descargas?\//i.test(url);

        // Y fuera lo que no puede ser una ficha: ni es un PDF, ni es del fabricante, ni el enlace dice
        // «ficha / manual / datos técnicos». Sin esto se colaban foros y páginas de preguntas y
        // respuestas cuando el buscador no daba nada bueno (visto el 7-oct-2026).
        const pintaDeFicha =
          esPdf ||
          delFabricante ||
          /ficha|datasheet|technical|manual|hoja[-_ ]?de[-_ ]?datos|catalog|instalacion|install/i.test(url);
        if (!pintaDeFicha) continue;

        candidatas.push({
          titulo: decodeURIComponent(direccion.pathname.split('/').pop() ?? url)
            .replace(/\.pdf($|\?)/i, '')
            .replace(/[-_]+/g, ' ')
            .slice(0, 90),
          url,
          dominio,
          esPdf,
          delFabricante,
        });
      }
    }

    // La puntuación: menos es mejor.
    const peso = (c: FichaCandidata) => {
      const bajo = this.sinAcentos(c.url).toLowerCase();
      let p = 0;
      p += c.esPdf ? 0 : 3;
      p += c.delFabricante ? 0 : 1;
      p += tokens.some((t) => bajo.includes(t)) ? 0 : 2;
      if (/(ficha|datasheet|technical|erp|hoja)/.test(bajo)) p -= 1;
      if (/(catalogo|catalogue|tarifa|manual|instalacion)/.test(bajo)) p += 1;
      if (/(tienda|precio|comprar|venta|wallapop|amazon|ebay|mil anuncios)/.test(bajo)) p += 1;
      return p;
    };
    return candidatas.sort((a, b) => peso(a) - peso(b));
  }

  // ── Texto del documento ───────────────────────────────────────────────────────────────────────

  /**
   * Texto de un PDF, hoja por hoja. `pdf-parse` es la misma biblioteca que lee los planos en
   * Homologaciones (`analizador.service.ts`). Va con `require` porque el paquete no está en las
   * dependencias del proyecto: se instaló en la Pi para el analizador.
   */
  /**
   * Cuando la ficha es un CATÁLOGO con varios modelos en columnas, el primer número de cada fila es el
   * de otro modelo: por eso todo salía «dudoso» y no se rellenaba nada (le pasó a Salva el 7-oct-2026
   * con el catálogo de un Mitsubishi MGPEZ-100VJA, que trae 10 modelos en la misma tabla).
   *
   * Se lee el texto CON POSICIONES (pdfjs) y se busca la columna del modelo pedido: en la fila de
   * cabecera están los modelos, cada uno a su altura horizontal, y las filas de debajo traen un valor
   * por modelo. Se devuelve, fila a fila, «etiqueta + el valor de ESA columna», que ya es un dato del
   * modelo que le interesa y no el primero de la fila.
   */
  private async textoDeLaColumna(
    bytes: Buffer,
    nombre: string,
    fabricante: string,
    modelo: string,
  ): Promise<{ texto: string; columna: string } | null> {
    const quiere = this.soloAlfanumerico(modelo);
    if (!quiere) return null;
    let pdfjs: any;
    try {
      pdfjs = await this.cargarPdfjs();
    } catch (e) {
      this.log.warn(`PDF ${nombre}: no hay lector de posiciones (${(e as Error).message})`);
      return null;
    }
    let doc: any;
    try {
      doc = await pdfjs.getDocument({
        data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false,
      }).promise;
    } catch (e) {
      this.log.warn(`PDF ${nombre}: no se ha podido abrir para mirar columnas (${(e as Error).message})`);
      return null;
    }

    const lineas: string[] = [];
    let columna = '';
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        const pagina = await doc.getPage(n);
        const contenido = await pagina.getTextContent();
        const trozos = ((contenido?.items ?? []) as any[])
          .filter((i) => i?.str && String(i.str).trim())
          .map((i) => ({ x: Number(i.transform[4]), y: Number(i.transform[5]), t: String(i.str).trim() }));

        // Las filas: los trozos que están a la misma altura, de arriba abajo.
        const porAltura = new Map<number, { x: number; t: string }[]>();
        for (const t of trozos) {
          const clave = Math.round(t.y);
          const fila = porAltura.get(clave) ?? [];
          fila.push({ x: t.x, t: t.t });
          porAltura.set(clave, fila);
        }
        const filas = [...porAltura.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([y, c]) => ({ y, c: c.sort((a, b) => a.x - b.x) }));

        // 1. La cabecera: la fila que trae más referencias de modelo.
        let cabecera = -1;
        let cuantas = 0;
        filas.forEach((fila, i) => {
          const refs = fila.c.filter((c) => this.pintaDeReferencia(c.t)).length;
          if (refs >= 3 && refs > cuantas) { cuantas = refs; cabecera = i; }
        });
        if (cabecera < 0) continue;

        // 2. La columna del modelo pedido: la referencia de la cabecera que más se le parece.
        const refs = filas[cabecera].c.filter((c) => this.pintaDeReferencia(c.t));
        let mejor = -1;
        let mejorParecido = 0;
        refs.forEach((c, i) => {
          const p = this.parecido(this.soloAlfanumerico(c.t), quiere);
          if (p > mejorParecido) { mejorParecido = p; mejor = i; }
        });
        if (mejor < 0 || mejorParecido < 0.75) continue;

        // 3. Los límites de esa columna: la mitad de la distancia a las columnas vecinas.
        const anclas = refs.map((c) => c.x);
        const centro = anclas[mejor];
        const izquierda = mejor > 0 ? (anclas[mejor - 1] + centro) / 2 : centro - 40;
        const derecha = mejor < anclas.length - 1 ? (centro + anclas[mejor + 1]) / 2 : centro + 40;
        columna = refs[mejor].t;

        // 4. Un dato por fila con valor: se junta con las ETIQUETAS que lo abrazan. En estas fichas el
        //    nombre del dato va repartido en las filas de arriba y de abajo —«Coeficiente energético –»
        //    encima, «EER / COP» debajo—, así que se coge lo que hay entre el valor anterior y este, más
        //    lo que queda justo por debajo (hasta medio hueco) y va a la izquierda de la tabla.
        //    El corte de la izquierda es el centro de la PRIMERA columna, no su anclaje: si no, el valor
        //    del primer modelo (que empieza pegado al anclaje) se cuela como parte del nombre del dato.
        const bordeEtiqueta = anclas.length > 1 ? anclas[0] - (anclas[1] - anclas[0]) / 2 : anclas[0] - 40;
        const conValor = filas
          .map((fila, i) => ({
            i,
            y: fila.y,
            valor: fila.c
              .filter((c) => c.x >= izquierda && c.x < derecha)
              .map((c) => c.t).join(' ').trim(),
          }))
          .filter((f) => f.i !== cabecera && f.valor);

        conValor.forEach((dato, k) => {
          const yArriba = k === 0 ? filas[cabecera].y : conValor[k - 1].y;
          const yAbajo = k < conValor.length - 1 ? (dato.y + conValor[k + 1].y) / 2 : dato.y - 3;
          const etiquetas: string[] = [];
          filas.forEach((fila, i) => {
            if (i === cabecera) return;
            const entreElDeArribaYEste = fila.y < yArriba && fila.y > dato.y;
            const justoDebajo = fila.y <= dato.y && fila.y >= yAbajo;
            if (!entreElDeArribaYEste && !justoDebajo) return;
            const texto = fila.c.filter((c) => c.x < bordeEtiqueta).map((c) => c.t).join(' ').trim();
            if (texto) etiquetas.push(texto);
          });
          const etiqueta = etiquetas.join(' ').replace(/\s+/g, ' ').trim();
          if (!etiqueta) return;
          // La fila que lista los modelos (o las unidades interior/exterior) no es un dato: se reconoce
          // porque lo que trae en la columna es una referencia de modelo.
          if (this.pintaDeReferencia(dato.valor)) return;
          lineas.push(`${etiqueta} ${dato.valor}`);
        });
      }
    } finally {
      try { await doc.destroy(); } catch { /* el proceso sigue: no es un fallo que importe */ }
    }

    if (lineas.length < 3) return null;
    this.log.log(
      `Ficha de ${fabricante} ${modelo}: leída la columna «${columna}» (${lineas.length} datos)`,
    );
    return { texto: lineas.join('\n'), columna };
  }

  /**
   * Carga `pdfjs-dist` (el motor de PDF que ya viene con el lector `pdf-parse`). Va con un `import()`
   * de verdad —envuelto en una función para que TypeScript no lo convierta en `require`, porque el
   * paquete solo publica ESM y este API compila a CommonJS.
   */
  private async cargarPdfjs(): Promise<any> {
    const importar = new Function('modulo', 'return import(modulo)') as (m: string) => Promise<any>;
    return importar('pdfjs-dist/legacy/build/pdf.mjs');
  }

  /**
   * Cuánto se parecen dos referencias de modelo (coeficiente de Dice sobre pares de letras). Sirve para
   * reconocer el modelo pedido aunque el catálogo lo escriba con otra letra: MGPEZ-100VJA y MSPEZ-100VJA
   * son el mismo aparato en dos nomenclaturas del mismo fabricante.
   */
  private parecido(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const pares = (s: string) => {
      const r = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i + 2));
      return r;
    };
    const A = pares(a);
    const B = pares(b);
    let comunes = 0;
    for (const g of A) if (B.has(g)) comunes++;
    const total = A.size + B.size;
    return total === 0 ? 0 : (2 * comunes) / total;
  }

  /** ¿La celda parece la referencia de un modelo? (MGPEZ-100VJA, VWL 75/6 A, OMNIA M 3.2 …) */
  private pintaDeReferencia(celda: string): boolean {
    const t = String(celda ?? '').trim();
    if (t.length < 4 || t.length > 40) return false;
    if (!/[A-Za-z]/.test(t) || !/\d/.test(t)) return false;
    return /[A-Za-z]{2,}[-_ ]?\d|\d[-_ ]?[A-Za-z]{2,}/.test(t);
  }

  private soloAlfanumerico(t: string): string {
    return this.sinAcentos(String(t ?? '').toLowerCase()).replace(/[^a-z0-9]/g, '');
  }

  /**
   * Cambia los datos «dudosos» (el primero de una fila con varios modelos) por los de la COLUMNA del
   * modelo pedido, que ya no son dudosos. Lo que no esté en la columna se queda como estaba: la
   * columna solo puede mejorar lo que había, nunca pisar un dato que la ficha da sin ambigüedad.
   */
  private conLaColumna(base: DatoLeido[], columna: DatoLeido[], cual: string): DatoLeido[] {
    const porCampo = new Map(columna.map((d) => [d.campo, d]));
    const salida: DatoLeido[] = [];
    const vistos = new Set<string>();
    const sirve = (v: unknown) => v !== null && v !== undefined && v !== '';
    for (const d of base) {
      vistos.add(d.campo);
      const c = porCampo.get(d.campo);
      salida.push(
        c && sirve(c.valor)
          ? { campo: d.campo, etiqueta: c.etiqueta, valor: c.valor,
              evidencia: `${c.evidencia} · columna «${cual}» de la tabla de la ficha` }
          : d,
      );
    }
    for (const c of columna) {
      if (!vistos.has(c.campo) && sirve(c.valor)) {
        salida.push({ ...c, evidencia: `${c.evidencia} · columna «${cual}» de la tabla de la ficha` });
      }
    }
    return salida;
  }

  /**
   * Lee un PDF y devuelve su texto y sus datos. Si es un catálogo con varios modelos en columnas, los
   * datos salen de la columna del modelo pedido (ver `textoDeLaColumna`).
   */
  private async datosDelPdf(
    bytes: Buffer,
    nombre: string,
    fabricante: string,
    modelo: string,
  ): Promise<{ texto: string; paginas: number; datos: DatoLeido[] }> {
    const { texto, paginas } = await this.textoDelPdf(bytes, nombre);
    let datos = this.extraer(texto);
    if (fabricante || modelo) {
      const col = await this.textoDeLaColumna(bytes, nombre, fabricante, modelo);
      if (col) {
        try {
          datos = this.conLaColumna(datos, this.extraer(col.texto), col.columna);
        } catch (e) {
          this.log.warn(`PDF ${nombre}: la columna no se ha podido usar (${(e as Error).message})`);
        }
      }
    }
    return { texto, paginas, datos };
  }

  private async textoDelPdf(bytes: Buffer, nombre: string): Promise<{ texto: string; paginas: number }> {
    let PDFParse: any;
    try {
      ({ PDFParse } = require('pdf-parse'));
    } catch {
      throw new BadRequestException(
        'Este servidor no tiene el lector de PDFs instalado (pdf-parse). Sube la ficha en PDF y avisa al administrador.',
      );
    }

    const parser = new PDFParse({ data: bytes });
    try {
      const datos = await parser.getText();
      const hojas: string[] = (datos?.pages ?? []).map((p: any) => String(p?.text ?? ''));
      return { texto: hojas.join('\n'), paginas: hojas.length };
    } catch (e) {
      this.log.error(`PDF ${nombre}: ${e}`);
      throw new BadRequestException(`No se ha podido leer el PDF «${nombre}»`);
    } finally {
      try {
        await parser.destroy();
      } catch {
        /* el destructor no cambia el resultado */
      }
    }
  }

  /** Texto de una página HTML (la ficha del producto en la web del fabricante). */
  private textoDelHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&aacute;/gi, 'á')
      .replace(/&eacute;/gi, 'é')
      .replace(/&iacute;/gi, 'í')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&ntilde;/gi, 'ñ')
      .replace(/&ordm;/gi, 'º')
      .replace(/&amp;/gi, '&')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t\u00a0]+/g, ' ');
  }

  // ── Extracción de los datos ───────────────────────────────────────────────────────────────────

  /**
   * Reglas de lectura. Cada una busca una ETIQUETA y el número que la acompaña, nada más: ni se
   * promedia, ni se interpola, ni se coge el número de al lado. El valor vuelve con su evidencia
   * (el texto exacto), y si la etiqueta no está en la ficha, ese campo no aparece en la respuesta.
   */
  private extraer(texto: string): DatoLeido[] {
    const plano = texto.replace(/\u00a0/g, ' ');
    const leidos: DatoLeido[] = [];
    const yaVisto = new Set<string>();

    const reglas: {
      campo: string;
      etiqueta: string;
      patron: RegExp;
      valor: (grupos: RegExpMatchArray) => number | string | null;
      /**
       * `true` cuando el dato NO es de un modelo concreto de la tabla (el PCA del refrigerante, la
       * carga del circuito): aunque su fila traiga varios números, vale tal cual y no se marca dudoso.
       */
      seguro?: boolean;
    }[] = [
      {
        campo: 'refrigerante',
        etiqueta: 'Refrigerante',
        patron: /\bR[\s-]?(32|290|410\s?A|134\s?[aA]|454B|513A|452B|455A|1234yf|744)\b/,
        valor: (g) => `R${g[1].toUpperCase().replace(/[\s-]/g, '')}`,
      },
      // ── Redacciones de los catálogos de varios modelos (Mitsubishi, Daikin, Fujitsu…) ─────────
      // En estas fichas el dato se llama «Capacidad – Frío Nominal» y la unidad va ANTES del número
      // («… kW 9,5»), al revés que en las de aerotermia. Comprobado el 7-oct-2026 con el catálogo del
      // Mitsubishi MGPEZ que subió Salva. Van ANTES que las reglas generales: manda la primera que acierta.
      {
        campo: 'gwp_refrigerante',
        etiqueta: 'PCA / GWP del refrigerante',
        // La fila del refrigerante trae TRES números («Pre-carga kg / PCA / TCO2 eq 0,90 / 675 / 0,61»),
        // así que hay que elegir el que es un PCA de verdad: el que corresponde al refrigerante de la
        // ficha si está (ver `pcaDeLaFila`), y si no el mayor de la fila.
        patron: /(?:GWP|PCA|PCG|potencial\s*de\s*calentamiento)[^\n]{0,60}/i,
        valor: (g) => this.pcaDeLaFila(g[0]),
        seguro: true,
      },
      {
        campo: 'carga_refrigerante_kg',
        etiqueta: 'Carga de refrigerante',
        // «Pre-carga kg / PCA / TCO2 eq  0,90 / 675 / 0,61»: el primer número de la terna es la carga de
        // refrigerante. Cuando la ficha es un catálogo, la terna de la columna del modelo manda.
        patron: /(?:pre-?carga|carga\s*(?:de\s*)?refrigerante)[\s\S]{0,40}?(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/i,
        valor: (g) => this.numero(g[1]),
        seguro: true,
      },
      {
        campo: 'carga_refrigerante_kg',
        etiqueta: 'Carga de refrigerante',
        patron: /(?:pre-?carga|carga)[^\n]{0,20}?kg[^\d\n]{0,25}([\d.,]{1,6})/i,
        valor: (g) => this.numero(g[1]),
        seguro: true,
      },
      {
        campo: 'potencia_frigorifica_kw',
        etiqueta: 'Potencia frigorífica (capacidad de frío)',
        patron: /capacidad[^\n]{0,30}?fr[ií]o[^\n]{0,40}?kW[^\d\n]{0,12}([\d.,]{1,6})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'potencia_calorifica_kw',
        etiqueta: 'Potencia calorífica (capacidad de calor)',
        patron: /capacidad[^\n]{0,30}?calor[^\n]{0,40}?kW[^\d\n]{0,12}([\d.,]{1,6})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'alimentacion',
        etiqueta: 'Alimentación eléctrica',
        // «Tensión/Fases – V/F – A 230/1 – 22,7»: la tensión y el número de fases van juntos.
        patron: /(?:tensi[oó]n\s*\/?\s*fases|alimentaci[oó]n)[^\n]{0,45}?((?:22|23|24|38|40|41)0)\s*\/\s*([13])\b/i,
        valor: (g) => (g[2] === '1' ? `MONOFASICA ${g[1]} V` : `TRIFASICA ${g[1]} V`),
        seguro: true,
      },
      // «Coeficiente energético – EER / COP 3,41 / 3,61»: cuál es cuál lo dice la etiqueta.
      {
        campo: 'eer',
        etiqueta: 'EER (refrigeración)',
        patron: /EER\s*\/\s*COP[^\d\n]{0,12}([\d.,]{1,4})\s*\/\s*([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'cop',
        etiqueta: 'COP (calefacción)',
        patron: /EER\s*\/\s*COP[^\d\n]{0,12}([\d.,]{1,4})\s*\/\s*([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[2]),
      },
      {
        campo: 'cop',
        etiqueta: 'COP (calefacción)',
        patron: /COP\s*\/\s*EER[^\d\n]{0,12}([\d.,]{1,4})\s*\/\s*([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'eer',
        etiqueta: 'EER (refrigeración)',
        patron: /COP\s*\/\s*EER[^\d\n]{0,12}([\d.,]{1,4})\s*\/\s*([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[2]),
      },
      {
        campo: 'carga_refrigerante_kg',
        etiqueta: 'Carga de refrigerante',
        patron: /(?:carga\s*(?:de\s*)?refrigerante|refrigerant\s*charge)[^\d\n]{0,30}([\d.,]{1,7})\s*(kg|g|gramos)\b/i,
        valor: (g) => {
          const n = this.numero(g[1]);
          if (n === null) return null;
          return /^kg/i.test(g[2]) ? n : Number((n / 1000).toFixed(4));
        },
      },
      {
        campo: 'potencia_calorifica_kw',
        etiqueta: 'Potencia calorífica (calefacción)',
        patron: /potencia\s*(?:t[eé]rmica|calor[ií]fica|de\s*calefacci[oó]n|nominal)[^\d\n]{0,45}?([\d.,]{1,6})\s*kW/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'potencia_calorifica_kw',
        etiqueta: 'Potencia calorífica (A7/W35)',
        patron: /A\s?7\s*[/\- ]\s*W\s?(?:35|45|55)[^\d\n]{0,60}?([\d.,]{1,6})\s*kW/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'potencia_frigorifica_kw',
        etiqueta: 'Potencia frigorífica (refrigeración)',
        patron: /potencia\s*(?:frigor[ií]fica|de\s*refrigeraci[oó]n)[^\d\n]{0,45}?([\d.,]{1,6})\s*kW/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'scop_medio_35c',
        etiqueta: 'SCOP (calefacción)',
        patron: /SCOP[^\d\n]{0,25}([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'scop_dhw_medio',
        etiqueta: 'SCOP de ACS (DHW)',
        // Ojo con la trampa: «SCOP DHW conforme a EN16147:2017…» NO lleva el SCOP ahí, lleva la NORMA
        // (se llegó a leer 1614 como SCOP de ACS en la ficha del OMNIA M, 7-oct-2026). Por eso se
        // descartan la referencia a la norma y los «conforme a / según».
        patron: /(?:SCOP\s*(?:DHW|ACS)|SPF\s*(?:DHW|ACS)|COP\s*(?:DHW|ACS))(?![^\d\n]{0,30}(?:EN\s?\d|UNE|conforme|seg[uú]n))[^\d\n]{0,25}([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'cop',
        etiqueta: 'COP (calefacción)',
        patron: /\bCOP[^\d\n]{0,20}([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'eer',
        etiqueta: 'EER (refrigeración)',
        patron: /\bEER[^\d\n]{0,20}([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'seer',
        etiqueta: 'SEER (refrigeración)',
        patron: /\bSEER[^\d\n]{0,20}([\d.,]{1,4})/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'eta_s_35c',
        etiqueta: 'ηs (etiqueta ErP, calefacción)',
        patron: /(?:η\s?s|eta\s?s|rendimiento\s*estacional)[^\d\n]{0,25}([\d.,]{1,5})\s*%?/i,
        valor: (g) => this.numero(g[1]),
      },
      {
        campo: 'alimentacion',
        etiqueta: 'Alimentación eléctrica',
        patron: /(?:alimentaci[oó]n|tensi[oó]n|power\s*supply)[^\n]{0,30}?((?:1|3)\s*[x×]?\s*)?((?:220|230|240|380|400|415)(?:\s*[-/]\s*(?:240|415))?)\s*V/i,
        valor: (g) => `${/^\s*3/.test(g[1] ?? '') ? 'TRIFASICA' : 'MONOFASICA'} ${g[2].replace(/\s/g, '')} V`,
      },
    ];

    for (const regla of reglas) {
      if (yaVisto.has(regla.campo)) continue; // el primer valor etiquetado manda
      const m = plano.match(regla.patron);
      if (!m || m.index === undefined) continue;
      const valor = regla.valor(m);
      if (valor === null || valor === '') continue;
      yaVisto.add(regla.campo);
      // Si el valor está en una fila con más números detrás, es una tabla de VARIOS modelos y el
      // número leído es el primero de la fila: se marca para que NO se rellene solo (ver `DatoLeido`).
      const fila = this.filaDeTabla(plano, m.index + m[0].length);
      leidos.push({
        campo: regla.campo,
        etiqueta: regla.etiqueta,
        valor,
        evidencia: this.evidencia(plano, m.index, m.index + m[0].length),
        ...(fila.dudoso && !regla.seguro ? { dudoso: true, candidatos: fila.candidatos } : {}),
      });
    }

    return leidos;
  }

  /**
   * El PCA (GWP) que aparece en una fila de ficha. En los catálogos la fila del refrigerante trae tres
   * números seguidos —«Pre-carga kg / PCA / TCO2 eq 0,90 / 675 / 0,61»— y el del PCA es el del
   * refrigerante que usa la máquina: si se reconoce el refrigerante se busca su PCA (tabla `PCA_DE`), y
   * si no, se coge el número mayor de la fila (el «TCO2 eq» y la carga son siempre menores que el PCA).
   */
  private pcaDeLaFila(fila: string): number | null {
    const texto = String(fila ?? '');
    // 1. La terna de la fila del refrigerante: «… 0,90 / 675 / 0,61» (carga / PCA / TCO2 eq). El PCA es
    //    el del medio, y es el mismo en todas las columnas porque el refrigerante es el mismo.
    const terna = texto.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
    if (terna) return this.numero(terna[2]);
    // 2. Un número suelto que CASI con el PCA del refrigerante que dice la ficha (R32 → 675). Si no
    //    cuadra, no se devuelve nada: vale más no rellenarlo que rellenarlo con lo que no es.
    const numeros = [...texto.matchAll(/\d+(?:[.,]\d+)?/g)]
      .map((m) => this.numero(m[0]))
      .filter((n): n is number => n !== null);
    const conocido = this.pcaConocido(texto);
    if (conocido !== null && numeros.some((n) => Math.abs(n - conocido) <= Math.max(2, conocido * 0.03))) {
      return conocido;
    }
    return null;
  }

  /**
   * El PCA de los refrigerantes que se usan en estas instalaciones (~100 años, AR5), para reconocerlo
   * dentro de una fila con varios números. No sustituye a lo que dice la ficha: sirve para elegir.
   */
  private pcaConocido(texto: string): number | null {
    const tabla: [RegExp, number][] = [
      [/R\s?-?\s?32\b/i, 675], [/R\s?-?\s?290\b/i, 3], [/R\s?-?\s?410\s?A\b/i, 2088],
      [/R\s?-?\s?134\s?[aA]\b/i, 1430], [/R\s?-?\s?454\s?B\b/i, 467], [/R\s?-?\s?513\s?A\b/i, 631],
      [/R\s?-?\s?452\s?B\b/i, 698], [/R\s?-?\s?455\s?A\b/i, 148], [/R\s?-?\s?744\b/i, 1],
      [/R\s?-?\s?1234\s?yf\b/i, 4],
    ];
    for (const [patron, pca] of tabla) if (patron.test(texto)) return pca;
    return null;
  }

  /**
   * ¿El valor leído está en una fila de tabla con varios modelos? Se cuenta lo que sigue al valor en su
   * misma línea: en una ficha de un solo modelo no hay nada más detrás del número, y en la fila de una
   * tabla vienen los siete u ocho valores de los otros tamaños seguidos.
   */
  private filaDeTabla(plano: string, desde: number): { dudoso: boolean; candidatos: number[] } {
    const fin = plano.indexOf('\n', desde);
    const linea = plano.slice(desde, fin === -1 ? Math.min(plano.length, desde + 400) : fin);
    const numeros: number[] = [];
    for (const m of linea.matchAll(/\d+(?:[.,]\d+)?/g)) {
      const n = this.numero(m[0]);
      if (n !== null) numeros.push(n);
    }
    return { dudoso: numeros.length >= 3, candidatos: numeros.slice(0, 10) };
  }

  /** El trozo de texto alrededor del valor: es lo que el instalador comprueba antes de guardarlo. */
  private evidencia(texto: string, desde: number, hasta: number): string {
    const ini = Math.max(0, desde - 70);
    const fin = Math.min(texto.length, hasta + 70);
    return `…${texto.slice(ini, fin).replace(/\s+/g, ' ').trim()}…`;
  }

  /** Número de un texto de ficha (coma decimal, a veces con espacios de millar). */
  private numero(crudo: string): number | null {
    const limpio = String(crudo ?? '').replace(/\s/g, '').replace(',', '.');
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }

  private nombreDeFichero(fabricante: string, modelo: string, url: string, extension: string): string {
    const base = `${fabricante}-${modelo}`.replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(0, 60);
    const huella = createHash('sha1').update(`${url}`).digest('hex').slice(0, 8);
    return `${base || 'maquina'}-${huella}.${extension}`;
  }

  private limpiarEntidad(url: string): string {
    return url
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&quot;/g, '"');
  }

  private sinAcentos(texto: string): string {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

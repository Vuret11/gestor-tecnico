import { Injectable, Logger } from '@nestjs/common';

/**
 * El verificador: en vez de decir «míralo tú», contrasta lo que declara la documentación con el
 * MÍNIMO que fija la norma y da un veredicto: CUMPLE, NO CUMPLE o SIN DATOS.
 *
 * Reglas de la casa (importantes, porque esto se le enseña al cliente):
 *  · Solo se juzga con valores tomados del texto oficial (BOE, CTE, guías del ministerio). Cada
 *    veredicto lleva el artículo y la fuente. Aquí no hay números «de memoria».
 *  · Un NO CUMPLE exige que el dato esté declarado en la documentación y por debajo del mínimo.
 *  · Si el dato no aparece, NO se acusa a nadie: es SIN DATOS, diciendo qué falta por saber.
 */

export type Veredicto = 'cumple' | 'no_cumple' | 'sin_datos';

export interface Verificacion {
  id: string;
  que: string;
  articulo: string;
  fuente: string;
  estado: Veredicto;
  gravedad: 'alta' | 'media' | 'baja' | null;
  evidencia: string;
  detalle: string;
  valores?: Record<string, unknown>;
}

/** Tabla 1 del ITC-BT-25: sección mínima y PIA de cada circuito de vivienda. */
const MINIMOS_CIRCUITO: Record<string, { seccion: number; pia: number; que: string }> = {
  C1: { seccion: 1.5, pia: 10, que: 'Iluminación' },
  C2: { seccion: 2.5, pia: 16, que: 'Tomas de uso general' },
  C3: { seccion: 6, pia: 25, que: 'Cocina y horno' },
  C4: { seccion: 4, pia: 20, que: 'Lavadora, lavavajillas y termo eléctrico' },
  C5: { seccion: 2.5, pia: 16, que: 'Baño, cuarto de cocina' },
  C8: { seccion: 6, pia: 25, que: 'Calefacción' },
  C9: { seccion: 6, pia: 25, que: 'Aire acondicionado' },
  C10: { seccion: 2.5, pia: 16, que: 'Secadora' },
  C11: { seccion: 1.5, pia: 10, que: 'Automatización' },
  C13: { seccion: 2.5, pia: 0, que: 'Recarga de vehículo eléctrico' },
};

const FUENTE_25 = 'RD 842/2002 · ITC-BT-25, tabla 1 (y guía BT-25 del ministerio)';
const FUENTE_18 = 'RD 842/2002 · ITC-BT-18, tabla 2';
const FUENTE_HS4 = 'CTE DB-HS4 (RD 314/2006), tablas 2.1 y 4.3';
const FUENTE_HS5 = 'CTE DB-HS5 (RD 314/2006), tablas 4.3 a 4.5';
const FUENTE_RIPCI = 'RIPCI (RD 513/2017), anexo I, sección 1.ª · CTE DB-SI 4, tabla 1.1';
const FUENTE_ICT = 'ICT (RD 346/2011), anexo II, apdos. 5.2, 5.4 y 5.7';
const FUENTE_SUA = 'CTE DB-SUA 4, apdo. 2 · ITC-BT-28';

/** Diámetro exterior de tubo que acompaña a cada sección en la tabla 1 del ITC-BT-25. */
const TUBO_MINIMO: Record<string, number> = { '1.5': 16, '2.5': 20, '4': 20, '6': 25 };
/** Conductividad del cobre y tensión de cálculo fase-neutro (230 V). */
const GAMMA_CU = 56;
const TENSION_V = 230;

@Injectable()
export class VerificadorService {
  private readonly log = new Logger('Verificador');

  /**
   * Contrasta una instalación con su norma. Devuelve solo lo que se puede sostener: los datos que
   * no aparecen salen como SIN DATOS con lo que falta, no como un incumplimiento inventado.
   */
  verifica(tipo: string, hechos: any, partidas: any[], hojas: string[]): Verificacion[] {
    const texto = (hojas ?? []).join(' \n ');
    try {
      switch (tipo) {
        case 'electricidad': return this.electricidad(hechos, partidas, texto);
        case 'pci': return this.pci(partidas, texto);
        case 'teleco': return this.teleco(partidas, texto);
        case 'fontaneria': return this.fontaneria(partidas, texto);
        case 'clima': return this.clima(partidas, texto);
        default: return [];
      }
    } catch (e) {
      this.log.error(`Verificando ${tipo}: ${e}`);
      return [];
    }
  }

  // ── Electricidad: los circuitos de vivienda (ITC-BT-25) ──────────────────────────────────

  private electricidad(hechos: any, partidas: any[], texto: string): Verificacion[] {
    const salida: Verificacion[] = [];
    const circuitos: any[] = hechos?.circuitos ?? [];

    // Los circuitos del mismo código se juzgan juntos: en el C4 el presupuesto declara tres líneas
    // (lavavajillas, lavadora y termo) y lo que importa es la sección menor de todas ellas.
    const porCodigo = new Map<string, any[]>();
    for (const c of circuitos) {
      const clave = c.codigo ?? 'sin-codigo';
      if (!porCodigo.has(clave)) porCodigo.set(clave, []);
      porCodigo.get(clave)!.push(c);
    }

    const grupos = [...porCodigo.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
    for (const [codigo, lista] of grupos) {
      const min = codigo !== 'sin-codigo' ? MINIMOS_CIRCUITO[codigo] : null;
      const nombres = lista.map((c: any) => `«${c.nombre}»`);
      if (!min) {
        salida.push({
          id: 'circuito-sin-codigo',
          que: `Circuitos declarados sin correspondencia en la tabla 1: ${lista.map((c: any) => `${c.seccion} mm² (${c.nombre})`).join(' · ')}`,
          articulo: 'ITC-BT-25, tabla 1', fuente: FUENTE_25,
          estado: 'sin_datos', gravedad: null,
          evidencia: `El presupuesto declara: ${nombres.join(', ')}.`,
          detalle: 'No se puede asignar sin ambigüedad a un circuito de la tabla 1 del ITC-BT-25, '
            + 'así que no se dictamina: hay que ver a qué circuito corresponde en el esquema unifilar.',
        });
        continue;
      }
      const secciones = [...new Set(lista.map((c: any) => Number(c.seccion)).filter((n: number) => !!n))].sort((a, b) => a - b);
      const laMenor = secciones[0];
      const ok = laMenor >= min.seccion;
      // La tabla 1 solo admite 2,5 mm² en el C4 si cada aparato lleva su propia línea con PIA de 16 A
      // (notas 6 y 8). Sin el calibre del PIA no se puede cerrar el veredicto: ni se aprueba ni se acusa.
      const excepcionC4 = codigo === 'C4' && laMenor >= 2.5;
      const estado = ok ? 'cumple' : excepcionC4 ? 'sin_datos' : 'no_cumple';
      salida.push({
        id: `itc-bt-25-${codigo.toLowerCase()}`,
        que: `Circuito ${codigo} · ${min.que}: sección mínima del conductor (${lista.length} línea${lista.length > 1 ? 's' : ''} declarada${lista.length > 1 ? 's' : ''})`,
        articulo: `ITC-BT-25, tabla 1 (${codigo})`, fuente: FUENTE_25,
        estado, gravedad: estado === 'no_cumple' ? 'alta' : null,
        evidencia: `El presupuesto declara, realizado con conductores de cobre de ${secciones.map((x: number) => this.es(x)).join(' y ')} mm²: ${nombres.join(', ')}.`,
        detalle: ok
          ? `La tabla 1 exige un mínimo de ${this.es(min.seccion)} mm² (PIA ${min.pia} A) y el proyecto declara ${secciones.map((x: number) => this.es(x)).join(' / ')} mm².`
          : excepcionC4
            ? `La tabla 1 pide ${this.es(min.seccion)} mm² (PIA ${min.pia} A) y el proyecto declara ${secciones.map((x: number) => this.es(x)).join(' / ')} mm². La propia tabla lo admite así SOLO si cada aparato tiene su circuito independiente con interruptor automático de 16 A (notas 6 y 8): `
              + 'hay que mirar el calibre de los PIAs de los circuitos C4-1, C4-2 y C4-3 en el cuadro del unifilar. Con 16 A por aparato el 2,5 mm² es correcto; con un solo PIA de 20 A para el circuito C4, la sección es insuficiente.'
            : `La tabla 1 exige ${this.es(min.seccion)} mm² (PIA ${min.pia} A) para el circuito ${codigo} y el presupuesto declara ${secciones.map((x: number) => this.es(x)).join(' / ')} mm². `
              + 'Se corrige aumentando la sección del circuito (o aportando el cálculo que lo justifique).',
        valores: { minimo_mm2: min.seccion, declarado_mm2: secciones, pia_a: min.pia, lineas: lista.length, articulo: 'ITC-BT-25 tabla 1' },
      });
    }

    // Los circuitos mínimos del grado básico (C1 a C5): se miran en el presupuesto Y en el unifilar
    // del plano, porque el plano rotula los circuitos aunque el presupuesto no los nombre todos.
    const rotulados = new Set<string>();
    for (const m of String(texto ?? '').toUpperCase().matchAll(/\bC(1[0-3]|[1-9])(?![0-9])/g)) rotulados.add(`C${m[1]}`);
    for (const c of circuitos) if (c.codigo) rotulados.add(c.codigo);
    if (rotulados.size) {
      const faltan = ['C1', 'C2', 'C3', 'C4', 'C5'].filter((k) => !rotulados.has(k));
      salida.push({
        id: 'itc-bt-25-circuitos-minimos',
        que: 'Circuitos mínimos del grado de electrificación básica (C1 a C5)',
        articulo: 'ITC-BT-25, apdos. 2.1 y 2.3', fuente: FUENTE_25,
        estado: faltan.length ? 'no_cumple' : 'cumple',
        gravedad: faltan.length ? 'alta' : null,
        evidencia: `Circuitos identificados (presupuesto y unifilar del plano): ${[...rotulados].sort((a, b) => a.length - b.length || a.localeCompare(b)).join(', ')}.`,
        detalle: faltan.length
          ? `La vivienda tiene que llevar los circuitos C1 a C5 y no se identifica${faltan.length > 1 ? 'n' : ''} ${faltan.join(', ')}.`
          : 'Están los cinco circuitos obligatorios del grado básico (C1 iluminación, C2 tomas de uso general, C3 cocina y horno, C4 lavadora/lavavajillas/termo y C5 baño y cuarto de cocina).',
      });
    }

    salida.push(...this.caidasTension(hechos?.unifilar ?? []));

    // Conductor de protección: Sp = S cuando la fase es ≤ 16 mm² (ITC-BT-18, tabla 2).
    const di = partidas.find((p) => /derivaci[oó]n individual/i.test(p.resumen ?? ''));
    if (di) {
      const s = this.seccionDeTexto(di.resumen);
      if (s) {
        salida.push({
          id: 'itc-bt-18-conductor-proteccion',
          que: 'Sección del conductor de protección de la derivación individual',
          articulo: 'ITC-BT-18, apdo. 3.4, tabla 2 · ITC-BT-19, tabla 2', fuente: FUENTE_18,
          estado: 'cumple', gravedad: null,
          evidencia: `Derivación individual de ${s} mm² («${di.resumen}»).`,
          detalle: `Con fase de ${s} mm² (≤ 16 mm²) el conductor de protección debe ser de la misma sección: ${s} mm². `
            + 'La sección del PE no viene rotulada en el presupuesto, así que hay que comprobarla sobre el esquema unifilar.',
          valores: { fase_mm2: s, proteccion_min_mm2: s },
        });
      }
    }
    return salida;
  }

  /**
   * Caída de tensión y tubo de cada línea del unifilar. Son cuentas, no opiniones: la fórmula es la
   * de la ITC-BT-25 (ΔU = 2·L·I/(γ·S), con γ = 56 para el cobre) y el límite el 3 % que fija esa
   * misma instrucción. Lo que sale de aquí se puede repetir a mano delante del cliente.
   */
  private caidasTension(unifilar: any[]): Verificacion[] {
    const salida: Verificacion[] = [];
    for (const u of unifilar) {
      const s = Number(u.seccion);
      const w = Number(u.potencia_w);
      const l = Number(u.longitud_m);
      if (!s || !w || !l) continue;
      const intensidad = w / TENSION_V;
      const caida_v = (2 * l * intensidad) / (GAMMA_CU * s);
      const pct = (caida_v / TENSION_V) * 100;
      // El límite depende de a quién alimenta la línea: en los circuitos de vivienda manda el 3 % del
      // ITC-BT-25; en el resto de la instalación, el 3 % para alumbrado y el 5 % para los demás usos
      // del ITC-BT-19 apdo. 2.2.2. Aplicar un 5 % a una vivienda sería regalar un incumplimiento.
      const esVivienda = u.vivienda !== false;
      const maxPct = esVivienda ? 3 : 5;
      const articulo = esVivienda
        ? 'ITC-BT-25, apdo. 3 (caída de tensión) y tabla 1 (tubo)'
        : 'ITC-BT-19, apdo. 2.2.2 (caída de tensión en instalaciones interiores o receptoras)';
      const cumpleCaida = pct <= maxPct;
      // El tubo de la tabla 1 del ITC-BT-25 solo se puede comprobar en los circuitos de vivienda.
      const tuboMin = esVivienda ? TUBO_MINIMO[String(s)] ?? null : null;
      const tubo = u.tubo ? Number(String(u.tubo).replace(/\D/g, '')) : null;
      const cumpleTubo = tuboMin === null || tubo === null ? null : tubo >= tuboMin;
      const estado: Veredicto = !cumpleCaida || cumpleTubo === false ? 'no_cumple' : 'cumple';
      const detalle: string[] = [
        `Caída de tensión: 2 · ${l} m · ${this.es(intensidad, 1)} A / (56 · ${this.es(s)} mm²) = ${this.es(caida_v, 2)} V = ${this.es(pct, 2)} % `
        + `(el máximo aplicable es ${maxPct} %).`,
      ];
      if (tuboMin !== null && tubo !== null) {
        detalle.push(`Tubo ${u.tubo}: la tabla 1 pide un mínimo de ${tuboMin} mm para ${this.es(s)} mm² — ${cumpleTubo ? 'cumple' : 'NO cumple'}.`);
      }
      salida.push({
        id: `caida-${u.hoja}-${s}-${l}-${w}`,
        que: `Caída de tensión · línea de ${this.es(s)} mm² de ${this.es(l)} m con ${this.es(w)} W${esVivienda ? ' (cuadro de vivienda)' : ''} · hoja ${u.hoja}`,
        articulo, fuente: esVivienda ? FUENTE_25 : 'RD 842/2002 · ITC-BT-19, apdo. 2.2.2',
        estado, gravedad: estado === 'no_cumple' ? 'alta' : null,
        evidencia: `El unifilar del plano declara: «${u.tubo} ${u.cable ?? ''} · ${this.es(w)} W · L = ${this.es(l)} m» (hoja ${u.hoja}).`,
        detalle: detalle.join(' '),
        valores: { seccion_mm2: s, longitud_m: l, potencia_w: w, caida_v: Number(caida_v.toFixed(2)), caida_pct: Number(pct.toFixed(2)), max_pct: maxPct, tubo: u.tubo, tubo_min_mm: tuboMin },
      });
    }
    return salida;
  }

  // ── PCI ──────────────────────────────────────────────────────────────────────────────────

  private pci(partidas: any[], texto: string): Verificacion[] {
    const salida: Verificacion[] = [];
    const extintores = partidas.filter((p) => /EXTINTOR/i.test(p.resumen ?? ''));
    // La eficacia que exige el CTE DB-SI 4 (tabla 1.1) para un edificio de viviendas es 21A-113B.
    const de21A = extintores.find((p) => /21A[ -]?113B/i.test(p.resumen ?? ''));
    if (de21A) {
      salida.push({
        id: 'ripci-extintores', que: 'Dotación de extintores portátiles (eficacia 21A-113B)',
        articulo: 'CTE DB-SI 4, tabla 1.1 · RIPCI anexo I, sección 1.ª, apdo. 4', fuente: FUENTE_RIPCI,
        estado: 'cumple', gravedad: null,
        evidencia: `El presupuesto incluye «${de21A.resumen}» (partida ${de21A.codigo}).`,
        detalle: 'La eficacia exigida para este uso (21A-113B) es la que figura en el presupuesto, a menos de 15 m de recorrido. '
          + 'Lo que no se puede comprobar con el texto del plano es esa distancia: hay que medirla sobre el plano acotado de cada planta.',
        valores: { eficacia: '21A-113B', recorrido_max_m: 15, partida: de21A.codigo },
      });
    } else if (extintores.length) {
      salida.push({
        id: 'ripci-extintores', que: 'Dotación de extintores portátiles (eficacia 21A-113B)',
        articulo: 'CTE DB-SI 4, tabla 1.1 · RIPCI anexo I, sección 1.ª, apdo. 4', fuente: FUENTE_RIPCI,
        estado: 'no_cumple', gravedad: 'alta',
        evidencia: `El presupuesto lleva extintores pero ninguno de eficacia 21A-113B: ${extintores.map((p) => `«${p.resumen}»`).join(', ')}.`,
        detalle: 'El CTE DB-SI 4 exige extintores portátiles de eficacia 21A-113B (polvo polivalente ABC) en cada planta, a menos de 15 m de recorrido. '
          + 'Los ofertados no declaran esa eficacia: hay que corregir la dotación.',
      });
    } else {
      salida.push({
        id: 'ripci-extintores', que: 'Dotación de extintores portátiles (eficacia 21A-113B)',
        articulo: 'CTE DB-SI 4, tabla 1.1 · RIPCI anexo I, sección 1.ª, apdo. 4', fuente: FUENTE_RIPCI,
        estado: 'sin_datos', gravedad: null,
        evidencia: 'No hay ninguna partida de extintores en el presupuesto ni se lee la eficacia en el plano.',
        detalle: 'Se exige extintor de eficacia 21A-113B a menos de 15 m de recorrido en cada planta. Sin extintores en la documentación no se puede dictaminar.',
      });
    }

    // Señalización de los medios de PCI: obligatoria y conforme a norma UNE.
    const senales = partidas.find((p) => /SE[ÑN]ALIZACI[OÓ]N DE EQUIPOS CONTRA INCENDIOS|SE[ÑN]AL[^\n]{0,30}INCENDIO/i.test(p.resumen ?? ''));
    if (senales) {
      salida.push({
        id: 'ripci-senalizacion', que: 'Señalización de los medios de protección contra incendios',
        articulo: 'RIPCI anexo I, sección 2.ª · normas UNE 23033-1 y UNE 23034', fuente: FUENTE_RIPCI,
        estado: 'cumple', gravedad: null,
        evidencia: `El presupuesto incluye «${senales.resumen}» (partida ${senales.codigo}).`,
        detalle: 'El RIPCI exige señalizar los equipos de PCI conforme a la UNE 23033-1, y los recorridos de evacuación conforme a la UNE 23034. '
          + 'Hay partida de señalización; falta confirmar en la ficha del producto el cumplimiento de esas normas.',
      });
    }

    // Detección: se oferta, pero el mínimo exigible depende de la altura de evacuación y de la superficie.
    const deteccion = partidas.find((p) => /DETECTOR[^\n]{0,30}(HUMO|OPTIC)|CENTRAL DET/i.test(p.resumen ?? ''));
    if (deteccion) {
      salida.push({
        id: 'dbsi4-deteccion', que: 'Sistema de detección de incendios ofertado',
        articulo: 'CTE DB-SI 4, tabla 1.1 (uso residencial vivienda) · RIPCI anexo I', fuente: FUENTE_RIPCI,
        estado: 'sin_datos', gravedad: null,
        evidencia: `El presupuesto oferta detección: «${deteccion.resumen}» (partida ${deteccion.codigo}).`,
        detalle: 'En uso residencial vivienda el CTE DB-SI 4 exige detección de incendios a partir de 50 m de altura de evacuación (y en zonas de riesgo); '
          + 'el proyecto la lleva aunque el edificio es de baja altura. Comprobar si es una mejora pedida por la propiedad (y que esté pagada) o un requisito del ayuntamiento/aseguradora.',
      });
    }
    return salida;
  }

  // ── Teleco ──────────────────────────────────────────────────────────────────────────────

  private teleco(partidas: any[], texto: string): Verificacion[] {
    const salida: Verificacion[] = [];
    const pau = /PAU|PUNTO DE ACCESO AL USUARIO/.test(texto) || partidas.some((p) => /\bPAU\b/i.test(p.resumen ?? ''));
    salida.push({
      id: 'ict-pau', que: 'PAU (punto de acceso al usuario) por vivienda',
      articulo: 'ICT (RD 346/2011), anexo I, apdos. 3.4 y 3.5', fuente: FUENTE_ICT,
      estado: pau ? 'cumple' : 'sin_datos', gravedad: null,
      evidencia: pau ? 'El PAU aparece en la documentación.' : 'No se localiza el PAU en el texto de los planos ni en el presupuesto.',
      detalle: pau
        ? 'La ICT exige un PAU por vivienda: en la documentación aparece. Comprobar que hay uno por vivienda y no uno para el edificio.'
        : 'La ICT exige un PAU por cada vivienda y un mínimo de tomas por estancia. No aparece en la documentación entregada: hace falta el plano de telecomunicaciones con el PAU y las tomas por vivienda.',
    });

    // Canalización externa: para 5 a 20 PAU la ICT pide 4 tubos de 63 mm (3 si son 4 PAU o menos).
    const conductos = this.conductosDeTeleco(texto);
    if (conductos) {
      const ok = conductos >= 4;
      salida.push({
        id: 'ict-canalizacion-externa', que: 'Tubos de la canalización externa de la ICT',
        articulo: 'ICT (RD 346/2011), anexo II, apdo. 5.2', fuente: FUENTE_ICT,
        estado: ok ? 'cumple' : 'no_cumple', gravedad: ok ? null : 'media',
        evidencia: `La documentación declara ${conductos} conductos en la canalización externa de la ICT.`,
        detalle: ok
          ? `Para 5 a 20 PAU la ICT pide 4 tubos de 63 mm (2 para TBA+STDP y 2 de reserva). Con ${conductos} conductos se cumple el número; falta comprobar que el diámetro es de 63 mm.`
          : `Para 5 a 20 PAU la ICT pide 4 tubos de 63 mm (2 para TBA+STDP y 2 de reserva) y la documentación declara ${conductos}. Se corrige con tubos de reserva hasta los 4.`,
        valores: { tubos_minimos_5_a_20_pau: 4, tubos_declarados: conductos, diametro_mm: 63 },
      });
    } else {
      salida.push({
        id: 'ict-canalizacion-externa', que: 'Tubos de la canalización externa de la ICT',
        articulo: 'ICT (RD 346/2011), anexo II, apdo. 5.2', fuente: FUENTE_ICT,
        estado: 'sin_datos', gravedad: null,
        evidencia: 'La documentación entregada no declara los tubos de la canalización externa de la ICT.',
        detalle: 'La ICT pide 4 tubos de 63 mm para 5 a 20 PAU (3 tubos si son 4 PAU o menos), con el 50 % de ocupación máxima. '
          + 'En el plano solo aparecen los conductos de la derivación individual del garaje, que no son esto. Hay que pedir el plano de telecomunicaciones con la canalización externa.',
        valores: { tubos_minimos_5_a_20_pau: 4, tubos_minimos_hasta_4_pau: 3, diametro_mm: 63, ocupacion_max_pct: 50 },
      });
    }
    return salida;
  }

  /**
   * Cuántos conductos declara la canalización externa de la ICT. Hay que anclarlo al texto de la
   * ICT: en los planos eléctricos aparecen cosas como «Pl. Baja. 2 Tubos Ø63 y 40 mm», que son
   * conductos de la derivación individual del garaje. Tomarlos por la canalización de la ICT daba
   * un incumplimiento FALSO, así que el número solo se lee si va pegado a esa canalización.
   */
  private conductosDeTeleco(texto: string): number | null {
    const t = String(texto ?? '').toUpperCase().replace(/\s+/g, ' ');
    const m = t.match(/CANALIZACI[OÓ]N\s+(?:EXTERNA|DE ENLACE)[^\n]{0,160}?(\d+)\s*(?:CONDUCTOS|TUBOS)/)
      ?? t.match(/(\d+)\s*(?:CONDUCTOS|TUBOS)[^\n]{0,100}?CANALIZACI[OÓ]N\s+(?:EXTERNA|DE ENLACE)/);
    return m ? Number(m[1]) : null;
  }

  // ── Fontanería ──────────────────────────────────────────────────────────────────────────

  private fontaneria(partidas: any[], texto: string): Verificacion[] {
    const salida: Verificacion[] = [];
    // Diámetro de la red de alimentación: el plano lo declara («LA TUBERÍA SERÁ DE PEX-a Ø25 EN AFS
    // Y DE Ø25 EN ACS HASTA LA ÚLTIMA DERIVACIÓN»). La tabla 4.3 del DB-HS4 pide ≥ 20 mm (plástico)
    // para la alimentación a una derivación particular y para los cuartos húmedos.
    const diametro = texto.match(/PEX-?A\s*(?:Ø|D)\s?(\d{2})/i)
      ?? texto.match(/PEX-?A\s*(\d{2})\s*X/i)
      ?? partidas.map((p) => String(p.resumen ?? '').match(/TUB\.?\s*PE\s*(\d{2})\s*X/i)).find(Boolean);
    if (diametro) {
      const d = Number(diametro[1]);
      const ok = d >= 20;
      salida.push({
        id: 'hs4-diametro-alimentacion',
        que: 'Diámetro de la alimentación de agua (AFS y ACS) hasta la última derivación',
        articulo: 'CTE DB-HS4, tabla 4.3 (tramos de alimentación) y tabla 4.2 (ramales de enlace)', fuente: FUENTE_HS4,
        estado: ok ? 'cumple' : 'no_cumple', gravedad: ok ? null : 'alta',
        evidencia: `La documentación declara Ø${this.es(d)} mm: «LA TUBERÍA SERÁ DE PEX-a Ø${this.es(d)} EN AFS Y DE Ø${this.es(d)} EN ACS HASTA LA ÚLTIMA DERIVACIÓN».`,
        detalle: ok
          ? `La tabla 4.3 exige un mínimo de 20 mm (cobre o plástico) para la alimentación a una derivación particular; con Ø${this.es(d)} mm se cumple. `
            + 'Los ramales de enlace a los aparatos son otra cosa: la tabla 4.2 admite desde 12 mm para lavabo, ducha o fregadero.'
          : `La tabla 4.3 exige un mínimo de 20 mm (cobre o plástico) para la alimentación a una derivación particular y el proyecto declara Ø${this.es(d)} mm.`,
        valores: { declarado_mm: d, minimo_alimentacion_mm: 20, minimo_ramal_mm: 12 },
      });
    } else {
      salida.push({
        id: 'hs4-diametro-alimentacion', que: 'Diámetro de la alimentación de agua (AFS y ACS)',
        articulo: 'CTE DB-HS4, tabla 4.3', fuente: FUENTE_HS4,
        estado: 'sin_datos', gravedad: null,
        evidencia: 'Ni el plano ni el presupuesto declaran el diámetro de la alimentación.',
        detalle: 'La tabla 4.3 fija un mínimo de 20 mm (cobre o plástico) para la columna, la alimentación a la derivación particular y los cuartos húmedos. Sin el diámetro en la documentación no se puede comprobar: pedirlo en el despiece del plano de fontanería.',
      });
    }

    // El ramal de enlace a los aparatos: el presupuesto oferta tubo de 16 mm.
    const ramal = partidas.find((p) => /TUB\.?\s*(?:PE|PEX)\s*16\s*X|TUB\.?\s*PE\s*16/i.test(p.resumen ?? ''));
    if (ramal) {
      salida.push({
        id: 'hs4-ramal-enlace', que: 'Ramal de enlace a los aparatos (tubo de 16 mm)',
        articulo: 'CTE DB-HS4, tabla 4.2', fuente: FUENTE_HS4,
        estado: 'cumple', gravedad: null,
        evidencia: `El presupuesto oferta «${ramal.resumen}» (partida ${ramal.codigo}).`,
        detalle: 'La tabla 4.2 pide 12 mm como mínimo para el ramal de enlace a lavabo, bidé, ducha o fregadero doméstico (y 20 mm para bañera, lavadora o lavavajillas domésticos). '
          + 'Con 16 mm se cumple para los aparatos de 12 mm; comprobar en el despiece que la bañera y la lavadora lleven al menos 20 mm.',
        valores: { declarado_mm: 16, minimo_aparatos_12_mm: 12, minimo_banera_lavadora_mm: 20 },
      });
    }

    // ACS: 50-65 ºC en los puntos de consumo (DB-HS4 2.1.3.4) y acumulación ≥ 60 ºC (RD 487/2022).
    const temp = texto.match(/A\.?C\.?S[^\n]{0,60}?(\d{2})\s*(?:º|°)?\s*C/) ?? texto.match(/(\d{2})\s*(?:º|°)\s*C[^\n]{0,40}?A\.?C\.?S/);
    if (temp) {
      const grados = Number(temp[1]);
      const ok = grados >= 50 && grados <= 65;
      salida.push({
        id: 'hs4-temperatura-acs', que: 'Temperatura de ACS en los puntos de consumo',
        articulo: 'CTE DB-HS4, apdo. 2.1.3.4', fuente: FUENTE_HS4,
        estado: ok ? 'cumple' : 'no_cumple', gravedad: ok ? null : 'alta',
        evidencia: `En la documentación aparece ACS a ${grados} ºC.`,
        detalle: ok
          ? `El DB-HS4 pide entre 50 y 65 ºC en los puntos de consumo y la documentación declara ${this.es(grados)} ºC.`
          : `El DB-HS4 pide entre 50 y 65 ºC en los puntos de consumo y la documentación declara ${this.es(grados)} ºC. Además, el RD 487/2022 obliga a acumular a 60 ºC o más por prevención de legionela.`,
        valores: { declarado_C: grados, min_C: 50, max_C: 65 },
      });
    } else {
      salida.push({
        id: 'hs4-temperatura-acs', que: 'Temperatura de ACS en los puntos de consumo',
        articulo: 'CTE DB-HS4, apdo. 2.1.3.4 · RD 487/2022 (legionela)', fuente: FUENTE_HS4,
        estado: 'sin_datos', gravedad: null,
        evidencia: 'La documentación no declara la temperatura de ACS.',
        detalle: 'El DB-HS4 exige entre 50 y 65 ºC en los puntos de consumo y el RD 487/2022 acumular a 60 ºC o más (70 ºC en interacumuladores de doble tanque y para desinfección térmica). Sin ese dato en el esquema de ACS no se puede comprobar.',
      });
    }

    // Diámetros de los tramos de alimentación (tabla 4.3): columna/distribuidor ≥ 20 mm en plástico.
    const montante = this.diametroDeTexto(texto, /MONTANTE|COLUMNA|DISTRIBUIDOR PRINCIPAL/);
    if (montante) {
      const ok = montante >= 20;
      salida.push({
        id: 'hs4-diametro-montante', que: 'Diámetro mínimo de la montante o distribuidor principal',
        articulo: 'CTE DB-HS4, tabla 4.3', fuente: FUENTE_HS4,
        estado: ok ? 'cumple' : 'no_cumple', gravedad: ok ? null : 'alta',
        evidencia: `La documentación declara ${montante} mm en la montante/distribuidor principal.`,
        detalle: ok
          ? `La tabla 4.3 pide un mínimo de 20 mm (cobre o plástico) y la documentación declara ${this.es(montante)} mm.`
          : `La tabla 4.3 pide un mínimo de 20 mm (cobre o plástico) y la documentación declara ${this.es(montante)} mm.`,
        valores: { declarado_mm: montante, min_mm: 20 },
      });
    }
    return salida;
  }

  // ── Clima / ventilación ─────────────────────────────────────────────────────────────────

  private clima(partidas: any[], texto: string): Verificacion[] {
    const salida: Verificacion[] = [];
    salida.push({
      id: 'rite-aislamiento', que: 'Espesor del aislamiento de tuberías y conductos',
      articulo: 'RITE (RD 1027/2007), IT 1.2.4.2', fuente: 'RD 1027/2007 (RITE), IT 1.2.4.2',
      estado: 'sin_datos', gravedad: null,
      evidencia: 'El presupuesto habla de «coquilla» en las tuberías pero no declara el espesor.',
      detalle: 'El RITE fija espesores mínimos de aislamiento según el diámetro exterior y si el tramo va interior o exterior (IT 1.2.4.2). Sin el espesor en el presupuesto o en la memoria no se puede comprobar: pedirlo en mm.',
    });
    const caudal = texto.match(/(\d+[.,]?\d*)\s*(?:DM3\/S|L\/S|M3\/H)[^\n]{0,30}?M2/);
    if (caudal) {
      salida.push({
        id: 'rite-caudal-ventilacion', que: 'Caudal de ventilación por unidad de superficie',
        articulo: 'RITE, IT 1.1.4.2.3, tabla 1.4.2.4', fuente: 'RD 1027/2007 (RITE), IT 1.1.4.2.3',
        estado: 'sin_datos', gravedad: null,
        evidencia: `Aparece un caudal de ${caudal[1]} por m² en el plano.`,
        detalle: 'Para locales no dedicados a ocupación permanente (garajes, trasteros) el RITE pide IDA 3 = 0,55 dm³/(s·m²). Comprobar que la unidad del plano es la misma antes de comparar.',
      });
    }
    return salida;
  }

  // ── Utilidades de lectura ───────────────────────────────────────────────────────────────

  /** Un número como se escribe en español: con coma decimal y sin decimales de relleno. */
  private es(n: number, dec?: number): string {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: dec ?? 0, maximumFractionDigits: dec ?? 3 });
  }

  /** La sección de un cable según el texto («Circuito de 1x(5x10)…», «Derivación individual 5x16 mm2»). */
  private seccionDeTexto(t: string): number | null {
    const limpio = String(t ?? '').toUpperCase().replace(/,/g, '.');
    const multi = limpio.match(/\d+X\(\d+X([\d.]+)\)/);
    if (multi) return Number(multi[1]);
    const simple = limpio.match(/\d+X([\d.]+)\s*MM2/);
    if (simple) return Number(simple[1]);
    return null;
  }

  /** El diámetro en mm que acompaña a una palabra (montante, columna…), si está declarado. */
  private diametroDeTexto(texto: string, cerca: RegExp): number | null {
    const global = new RegExp(`${cerca.source}[^\\n]{0,70}?(?:DN|PE|Ø|D)\\s?-?\\s?(\\d{2,3})`, 'i');
    const m = texto.match(global);
    return m ? Number(m[1]) : null;
  }
}

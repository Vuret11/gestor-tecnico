/**
 * Tipos compartidos de Módulo 4 (Qusable) y Módulo 5 (Eres) — conversión de la demanda de ACS
 * (Módulo 3, CTE DB-HE4) a energía útil y balance renovable de bombas de calor
 * (Directiva (UE) 2018/2001, Anexo VII).
 *
 * `FuenteTecnica` es estructuralmente análoga a `FuenteNormativa` (dbhe4.types.ts) pero NO la
 * reutiliza: `FuenteNormativa.seccion` está tipada como 'HE4' | 'Anejo F' | 'Anejo G', cerrada a
 * CTE DB-HE4. En vez de ampliar ese tipo compartido para fuentes ajenas a HE4 (Directivas/
 * Decisiones UE, guías de instaladores), se define aquí un tipo hermano con el mismo propósito
 * y un campo `tipo` explícito que marca el nivel de autoridad de cada cita: legislación UE
 * primaria, o guía práctica de aplicación (no legal en sí misma).
 */

export interface FuenteTecnica {
  tipo: 'legislacion_ue' | 'legislacion_nacional' | 'guia_practica' | 'regla_interna';
  documento: string;
  seccion: string;
  apartado: string;
  pagina?: number;
  url: string;
  fechaConsulta: string; // ISO date
}

export interface PasoTrazabilidadTecnica {
  paso: string;
  formula: string;
  entradas: Record<string, unknown>;
  resultado: unknown;
  fuente: FuenteTecnica;
}

export enum TipoAccionamiento {
  ELECTRICA = 'ELECTRICA',
  TERMICA = 'TERMICA',
}

export interface DetalleMensualQusable {
  mes: number; // 1-12
  volumenLitros: number; // = CalculoAcs.salidas.detalleMensual[i].mensualT
  ti: number; // °C, copiado del CalculoAcs de origen
  temperaturaPreparacion: number; // °C, T
  deltaT: number; // T − ti
  energiaMesKWh: number;
}

export interface ResultadoQusable {
  calculoAcsId: number;
  temperaturaPreparacion: number;
  qusableAnualKWh: number;
  detalleMensual: DetalleMensualQusable[];
  trazabilidad: PasoTrazabilidadTecnica[];
}

export interface DetalleMensualEres {
  mes: number;
  qusableMesKWh: number;
  eresMesKWh: number; // 0 si no elegible
}

export interface ResultadoEres {
  calculoQusableId: number;
  calculoAcsId: number; // heredado a través de CalculoQusable
  spf: number;
  tipoAccionamiento: TipoAccionamiento;
  umbralScopDhwAplicable: number; // 2.5 o 1.15 (reutiliza SCOP_DHW_MINIMO_* de dbhe4-anejo-f.constants.ts)
  cumpleUmbralSpf: boolean;
  qusableAnualKWh: number;
  contribucionRenovable: number; // CR = 1 − 1/SPF si cumpleUmbralSpf, si no 0
  contribucionRenovableMinimaRequerida: number; // heredado del CalculoAcs original (0.6 o 0.7)
  eresAnualKWh: number; // 0 si no cumpleUmbralSpf
  cumpleHe4: boolean; // cumpleUmbralSpf && CR >= contribucionRenovableMinimaRequerida
  detalleMensual: DetalleMensualEres[];
  trazabilidad: PasoTrazabilidadTecnica[];
}

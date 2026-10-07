import { Empresa } from '../crm/tipos';
import { Persona } from '../crm/tipos';
import { Expediente } from '../crm/tipos';
import { Maquina } from '../crm/tipos';
import { TipoEmisor } from '../crm/normativa/demanda.constants';
import { MaquinaConUnidades, TotalesInstalacion } from '../maquina-instalacion';

export interface ContextoIf190 {
  expediente: Expediente;
  empresa: Empresa;
  tecnico: Persona;
  apoderado: Persona | null;
  /** Máquina principal (la primera de la instalación). */
  maquina: Maquina;
  /**
   * Máquinas de la instalación con sus unidades. El IF-190 tiene una columna por SISTEMA de
   * refrigeración, así que cada unidad física ocupa su columna (ver `unidadesEnOrden`): carga y CO₂
   * por columna y la suma por refrigerante en «Carga máxima de la instalación».
   */
  maquinas: MaquinaConUnidades[];
  /** Totales ya sumados de toda la instalación. */
  totales: TotalesInstalacion;
  /** Tipo de emisor del cálculo de demanda (Módulo 2) — decide el régimen de temperatura. */
  tipoEmisor: TipoEmisor | null;
  /** Emisores marcados en el expediente (puede haber varios, 2026-09-29). */
  tipoEmisores: TipoEmisor[];
  /** 'AEROTERMIA' | 'GEOTERMIA' — tipo de energía de la instalación (2026-10-02). */
  tipoEnergia: 'AEROTERMIA' | 'GEOTERMIA';
  /**
   * 'NUEVA' | 'REFORMA' — punto 1 de las Características Técnicas (Nueva / Modificación-Ampliación),
   * mismas casillas que el NUEVA/REFORMA del MOD-315.
   */
  tipoInstalacion: 'NUEVA' | 'REFORMA';
}

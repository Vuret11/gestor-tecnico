import { Empresa } from '../crm/tipos';
import { Persona } from '../crm/tipos';
import { Expediente } from '../crm/tipos';
import { Maquina } from '../crm/tipos';
import { TipoEmisor } from '../crm/normativa/demanda.constants';
import { MaquinaConUnidades } from '../maquina-instalacion';

export interface ContextoCertificadoRsif {
  expediente: Expediente;
  empresa: Empresa;
  tecnico: Persona;
  /** Máquina principal (la primera de la instalación). */
  maquina: Maquina;
  /**
   * Máquinas de la instalación con sus unidades. Los datos del RSIF son de conjunto (potencia
   * frigorífica total, potencia de accionamiento, refrigerante): con varias máquinas suman y los
   * refrigerantes se declaran por separado («R32/R290»).
   */
  maquinas: MaquinaConUnidades[];
  requiereMemoriaTecnica: boolean | null;
  /** Tipo de emisor del cálculo de demanda (Módulo 2) — decide el régimen de temperatura. */
  tipoEmisor: TipoEmisor | null;
  /** Emisores marcados en el expediente (puede haber varios, 2026-09-29). */
  tipoEmisores: TipoEmisor[];
}

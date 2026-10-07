import { Empresa } from '../crm/tipos';
import { Persona } from '../crm/tipos';
import { Expediente } from '../crm/tipos';
import { Maquina } from '../crm/tipos';
import { TipoEmisor } from '../crm/normativa/demanda.constants';
import { MaquinaConUnidades } from '../maquina-instalacion';

/**
 * Claves esperadas en Expediente.datosObra para MOD-318 — el propio campo de la entidad sigue
 * siendo `Record<string, unknown>` (forma libre, a propósito: nada de esto lo produce ningún
 * cálculo de la app, son medidas físicas del instalador en obra). Esta interfaz es solo una
 * ayuda de tipado para el código de este mapeo concreto, no se valida contra ella.
 */
export interface DatosObraMod318 {
  fechaPruebaEquipos?: string;
  fechaPruebaEstanqueidadTuberiasAgua?: string;
  fechaPruebaEstanqueidadCircuitosFrigorificos?: string;
  fechaPruebaLibreDilatacion?: string;
  fechaPruebaRecepcionRedesConductosAire?: string;
  fechaPruebaEstanqueidadChimeneas?: string;
  fechaPruebasFinales?: string;
  fechaPruebasEficienciaEnergetica?: string;
  pMaxCircuitosCerrados?: string;
  pPruebaCircuitosCerrados?: string;
  pMaxTuberiasAcs?: string;
  pPruebaTuberiasAcs?: string;
  pMaxCircuitoSolar?: string;
  pPruebaCircuitoSolar?: string;
  eerMedido?: string;
  copMedido?: string;
}

export interface ContextoMod318 {
  expediente: Expediente;
  empresa: Empresa;
  instaladorHabilitado: Persona | null;
  /** Máquina principal (la primera de la instalación). */
  maquina: Maquina;
  /**
   * Máquinas de la instalación con sus unidades. El bloque de rendimientos del impreso tiene 3 filas
   * de «Generador de calor y/o frío» y 3 de «Generador de ACS»: cada equipo ocupa su fila.
   */
  maquinas: MaquinaConUnidades[];
  tieneCalefaccion: boolean;
  tieneAcsPorBombaDeCalor: boolean;
  /** Emisores de la instalación: fijan el régimen (A7W55/A7W35, A35W18/A35W7). */
  tipoEmisor: TipoEmisor | null;
  tipoEmisores: TipoEmisor[];
  datosObra: DatosObraMod318;
}

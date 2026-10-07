import { Empresa } from '../crm/tipos';
import { Persona } from '../crm/tipos';
import { Expediente } from '../crm/tipos';
import { Maquina } from '../crm/tipos';
import { TipoEdificio } from '../crm/normativa/dbhe4.types';
import { TipoEmisor } from '../crm/normativa/demanda.constants';
import { MaquinaConUnidades, TotalesInstalacion } from '../maquina-instalacion';

export interface ContextoMod315 {
  expediente: Expediente;
  empresa: Empresa;
  apoderado: Persona | null;
  instaladorHabilitado: Persona | null;
  /** Máquina principal (la primera de la instalación) — la que usan los datos que no se suman. */
  maquina: Maquina;
  /**
   * Máquinas de la instalación con sus unidades, en orden. Una instalación puede llevar varias
   * (mismo modelo repetido o modelos distintos, 2026-09-29): potencias, cargas y CO₂ SUMAN;
   * COP/SCOP/EER/ηs se declaran por máquina separados por «/».
   */
  maquinas: MaquinaConUnidades[];
  /** Totales ya sumados de la instalación (potencias, carga por refrigerante, tCO₂eq, unidades). */
  totales: TotalesInstalacion;
  tipoEdificio: TipoEdificio;
  numeroViviendas: number | null;
  tieneCalefaccion: boolean;
  tieneAcsPorBombaDeCalor: boolean;
  qusableAnualKWh: number | null;
  eresAnualKWh: number | null;
  /** Demanda diaria de ACS a 60 °C (l/día) del CTE DB-HE4, Anejo F — CalculoAcs del expediente. */
  acsDemandaDiaria60C: number | null;
  /** Volumen de acumulador de ACS definido en el cálculo de ACS (l), si lo hay. */
  acsVolumenAcumuladorLitros: number | null;
  requiereMemoriaTecnica: boolean | null;
  /** null = no se sabe (dato pendiente del expediente) — ver nota de "8 primeras filas de Documentación aportada" en el mapeo. */
  esAnteriorRd1027_2007: boolean | null;
  /**
   * Tipo de energía: 'AEROTERMIA' o 'GEOTERMIA' (nunca las dos). Marca la casilla del punto 7 de la
   * memoria (Datos Bomba de Calor) y la del punto 5 (ACS) y elige el texto de OBSERVACIONES del
   * punto 1. Dictado del instalador, 2-oct-2026.
   */
  tipoEnergia: 'AEROTERMIA' | 'GEOTERMIA';
  /**
   * Tipo de instalación: 'NUEVA' o 'REFORMA'. Marca la casilla «INSTALACIÓN: NUEVA / REFORMA
   * AMPLIACIÓN DE EXISTENTE» del punto 1 de la memoria y decide el texto de OBSERVACIONES.
   */
  tipoInstalacion: 'NUEVA' | 'REFORMA';
  /**
   * La instalación es de **aire acondicionado** (climatización sola, uso `SOLO_CLIMATIZACION`): un split
   * que enfría (y calienta) pero no produce ACS. Lo pidió Salva el 7-oct-2026 con las anotaciones de
   * Ariel: para estas instalaciones el bloque «Datos Bomba de Calor» no se rellena, se rellena el de
   * «Datos Aire Acondicionado», la columna CLIMATIZACIÓN de regulación y control SÍ se marca, y en
   * OBSERVACIONES se escribe «INSTALACIÓN NUEVA AIRE ACONDICIONADO».
   */
  esAireAcondicionado: boolean;
  /** Tipo de emisor usado en el cálculo de demanda (Módulo 2), si se usó el modo automático — null si fue manual o si no hay CalculoDemanda vinculado. */
  tipoEmisor: TipoEmisor | null;
  /** Emisores marcados en el expediente (puede haber varios, 2026-09-29). */
  tipoEmisores: TipoEmisor[];
  /**
   * Superficie (m²) del cálculo de demanda del expediente — la que da el instalador. La usan el
   * «RESUMEN DE CARGAS CALORÍFICAS POR LOCAL Y ELEMENTO INSTALADO» (pág. 11) y su carga.
   */
  superficieM2: number | null;
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Legalizacion } from '../../entities/legalizacion.entity';
import { Maquina } from '../../../maquinas/entities/maquina.entity';
import { aMaquinaDelCatalogo } from '../generador.service';
import { potenciaCalorificaDeLaMaquina, produceAcsConBombaDeCalor } from '../maquina-instalacion';
import { TipoUsoMaquina } from '../crm/tipos';
import { demandaAcs, eresAnualKWh, qusableAnualKWh } from './calculo-cte';

/**
 * Campos del trámite que SOLO tienen sentido si la instalación produce ACS: su demanda diaria, el
 * Qusable y el Eres (que salen de esa demanda) y el volumen del acumulador. Cuando el uso declarado es
 * «climatización sola» se vacían si venían puestos (ver `calcular`), que es el «recorte» que pidió
 * Salva el 7-oct-2026 para la legalización de Ariel (un split de aire acondicionado).
 */
const CAMPOS_QUE_SOLO_TIENEN_SENTIDO_CON_ACS: (keyof Legalizacion)[] = [
  'acs_demanda_diaria_60c',
  'qusable_anual_kwh',
  'eres_anual_kwh',
  'acs_volumen_acumulador_l',
];

/**
 * Rellena en el trámite los datos que CALCULA EL PROGRAMA, para no pedírselos a nadie.
 *
 * Pedido del instalador el 2-oct-2026: «todo esto no debería aparecer, esto es lo que calculas tú
 * internamente». El alta se queda con los 17 datos del correo y aquí se sacan solos:
 *
 * - la demanda diaria de ACS a 60 °C (CTE DB-HE4, anejos F y G, con la provincia y los dormitorios),
 * - el Qusable anual, que sale de esa demanda mes a mes,
 * - y el Eres, con el SCOP de ACS de la máquina declarada.
 *
 * Regla: SOLO se rellena lo que está vacío. Un valor que venga puesto (del CRM o de una corrección a
 * mano) manda siempre; no se pisa. Y lo que no se puede calcular con los datos que hay se deja en
 * blanco, porque no se inventa ningún dato.
 *
 * La demanda de CALEFACCIÓN también está en el motor (`calculo-cte.demandaCalefaccion`), pero los
 * documentos no la imprimen: sirve para elegir la máquina y el trámite no tiene columna para ella.
 */
@Injectable()
export class CalcularTramiteService {
  private readonly log = new Logger(CalcularTramiteService.name);
  constructor(@InjectRepository(Maquina) private readonly maquinas: Repository<Maquina>) {}

  /**
   * Devuelve los campos calculados que le faltan al trámite (vacío si no hay nada que calcular).
   * No guarda: lo asigna y guarda quien llama, en la misma escritura del alta o de la edición.
   */
  async calcular(tramite: Legalizacion): Promise<Partial<Legalizacion>> {
    const cambios: Partial<Legalizacion> = {};

    // La POTENCIA no se pide en el alta: sale de la ficha técnica de las máquinas del trámite, que
    // es lo que pide el instalador («no pidas potencia, la debes sacar tú de la máquina»).
    if (tramite.potencia == null) {
      const potencia = await this.potenciaDeLaInstalacion(tramite);
      if (potencia !== null) cambios.potencia = potencia;
    }

    // ── De aquí abajo, todo es de la PRODUCCIÓN DE ACS ────────────────────────────────────────────
    // La demanda diaria de ACS, el Qusable y el Eres salen de la demanda de ACS del CTE DB-HE4: en
    // una instalación de **climatización sola** (sin ACS) no hay ACS que declarar, así que no se
    // calculan y esas casillas del MOD-315 salen en blanco. Antes se calculaban siempre y un trámite
    // sin ACS habría declarado una demanda de agua caliente que no existe.
    // El uso declarado del trámite manda; si no lo dice, el de la máquina principal.
    if (!(await this.produceAcs(tramite))) {
      // Y si ya venían puestos, se VACÍAN. Lo pidió Salva el 7-oct-2026: «la última legalización que
      // le he hecho a Ariel está mal: es solo climatización, es un split, un aire acondicionado». Un
      // trámite que primero se declaró con ACS y luego se corrige a climatización sola seguía
      // enseñando su demanda de agua caliente y su Qusable (no se puede declarar un ACS que no
      // existe), y los documentos salían con esa parte dentro. Este es el «recorte»: sin ACS que
      // declarar, esos cuatro campos se quedan en blanco.
      for (const campo of CAMPOS_QUE_SOLO_TIENEN_SENTIDO_CON_ACS) {
        if (tramite[campo] != null) (cambios as any)[campo] = null;
      }
      return cambios;
    }

    const acs = demandaAcs({
      tipoEdificio: tramite.tipo_edificio,
      dormitorios: tramite.dormitorios,
      viviendas: tramite.viviendas,
      provincia: tramite.provincia,
    });
    if (!acs) return cambios; // sin provincia de la tabla, sin dormitorios… no se calcula nada

    if (tramite.acs_demanda_diaria_60c == null) cambios.acs_demanda_diaria_60c = acs.demandaReferenciaDiaria60C;

    const qusable = qusableAnualKWh(acs);
    if (qusable !== null && tramite.qusable_anual_kwh == null) cambios.qusable_anual_kwh = qusable;

    // El Eres necesita el SCOP de ACS de la máquina: el SPF que pide el anexo VII del RITE. Es el
    // `scop_dhw_medio` del catálogo (el que ya cae al SCOP de 55 °C cuando el fabricante no publica
    // uno de ACS, con su origen en `scop_dhw_origen`). Sin él, ni Eres ni contribución renovable.
    if (qusable !== null && tramite.eres_anual_kwh == null) {
      const spf = await this.scopAcsDeLaMaquina(tramite);
      const eres = eresAnualKWh(qusable, spf);
      if (eres) cambios.eres_anual_kwh = eres.eresAnualKWh;
    }

    const claves = Object.keys(cambios);
    if (claves.length > 0) this.log.log(`Calculado en el trámite ${tramite.id}: ${claves.join(', ')}`);
    return cambios;
  }

  /**
   * ¿Esta instalación produce ACS con la bomba de calor? Manda el uso declarado del trámite y, si no
   * lo dice, el de la máquina principal. Es el mismo dato que decide las casillas del 315/318 (ver
   * `produceAcsConBombaDeCalor`), así que lo que se calcula y lo que se marca en el impreso nunca se
   * contradicen.
   */
  private async produceAcs(tramite: Legalizacion): Promise<boolean> {
    const dicho = (tramite.tipo_uso ?? '').toString().trim().toUpperCase();
    if ((Object.values(TipoUsoMaquina) as string[]).includes(dicho)) {
      return produceAcsConBombaDeCalor({ tipoUso: dicho as TipoUsoMaquina });
    }
    const maquina = await this.maquinaPrincipal(tramite);
    return produceAcsConBombaDeCalor(
      maquina ? { tipoUso: maquina.tipo_uso as TipoUsoMaquina } : null,
    );
  }

  /**
   * La máquina principal de la instalación: la que manda cuando el dato solo admite una (el SPF de
   * ACS del Eres). Es la primera de la lista declarada o la máquina suelta si no hay lista.
   */
  private async maquinaPrincipal(tramite: Legalizacion): Promise<Maquina | null> {
    const declaradas = (tramite.maquinas_instalacion ?? []).filter((m) => Number(m.unidades) > 0);
    const id = declaradas.length > 0 ? Number(declaradas[0].maquina_id) : tramite.maquina_id;
    if (id == null || Number.isNaN(Number(id))) return null;
    return this.maquinas.findOne({ where: { id: Number(id) } });
  }

  /** SCOP de ACS (SPF) de la máquina principal, o null si no hay o no lo publica. */
  private async scopAcsDeLaMaquina(tramite: Legalizacion): Promise<number | null> {
    const maquina = await this.maquinaPrincipal(tramite);
    return maquina?.scop_dhw_medio ?? null;
  }

  /**
   * Potencia calorífica de toda la instalación (kW): la de cada máquina de su ficha técnica, por sus
   * unidades y sumada. Es la potencia que se declaraba a mano en el alta y ahora se saca del catálogo.
   * Si a alguna máquina le falta el dato en la ficha, devuelve null: no se inventa un total a medias.
   */
  private async potenciaDeLaInstalacion(tramite: Legalizacion): Promise<number | null> {
    const declaradas = (tramite.maquinas_instalacion ?? []).filter((m) => Number(m.unidades) > 0);
    const lista = declaradas.length > 0
      ? declaradas
      : tramite.maquina_id
        ? [{ maquina_id: tramite.maquina_id, unidades: 1 }]
        : [];
    if (lista.length === 0) return null;

    let total = 0;
    for (const item of lista) {
      const maquina = await this.maquinas.findOne({ where: { id: Number(item.maquina_id) } });
      if (!maquina) return null;
      // OJO: la ficha se lee del catálogo con la forma que esperan los mapeos (camelCase), no con las
      // columnas de la tabla (snake_case): `potenciaCalorificaDeLaMaquina` busca `potenciaCalorificaKW`.
      const potencia = potenciaCalorificaDeLaMaquina(aMaquinaDelCatalogo(maquina));
      if (potencia == null) return null;
      total += potencia * Number(item.unidades);
    }
    return Number(total.toFixed(2));
  }
}

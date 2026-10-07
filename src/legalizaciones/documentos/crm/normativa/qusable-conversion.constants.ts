/**
 * Conversión de demanda de ACS (volumen, L) a energía térmica útil (Qusable, kWh) mediante el
 * calor específico del agua. NIVEL DE AUTORIDAD 2 — fórmula APLICADA de una guía práctica de
 * instaladores, NO texto legal primario (a diferencia de dbhe4-anejo-f.constants.ts y
 * eres.constants.ts). La constante 1,16 Wh/(L·°C) en sí es física (4,186 kJ/(kg·°C) ÷ 3,6 =
 * 1,163 Wh/(kg·°C), agua ≈1 kg/L, redondeado a 1,16 por convención del sector); lo que aporta
 * la guía es la fórmula aplicada a la demanda de ACS de CTE DB-HE4/RITE2021, no un texto legal.
 * Fuente: "Bombas de Calor Ambiente", Javier Ponce, CNI-Instaladores, rev. 17/09/2021
 * (ref. RITE2021/CTE2019). Guía de formación de instalador, no documento legal.
 */
import { FuenteTecnica } from './qusable-eres.types';

export const FUENTE_CNI_CONVERSION_ENERGIA_ACS: FuenteTecnica = {
  tipo: 'guia_practica',
  documento: 'Bombas de Calor Ambiente (Javier Ponce, CNI-Instaladores, rev. 17/09/2021, ref. RITE2021/CTE2019)',
  seccion: 'Cálculo de energía útil de ACS',
  apartado: 'EU(kWh) = D × (T − TAFS) × 1,16 / 1000',
  url: 'https://www.cni-instaladores.com/wp-content/uploads/2021/10/Aerotermia-Renovable-Actual_2021_para-CNI.pdf',
  fechaConsulta: '2026-09-02',
};

/** Calor específico del agua, Wh/(L·°C): 4,186 kJ/(kg·°C) ÷ 3,6 = 1,163, redondeado a 1,16. Agua ≈ 1 kg/L. */
export const CALOR_ESPECIFICO_AGUA_WH_L_C = 1.16;

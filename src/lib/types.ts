import type { LotCode } from "./lots";
import type { PayMethodId, StageId } from "./process";

export type PayModel = "por_kg" | "jornal";
export type HarvestType = "Principal" | "Secundaria";

export type WorkerRow = {
  id: string;
  nombre: string;
  hi: string;
  hf: string;
  kg: number;
  horas: number;
  pago: number;
  alim: number;
};

export type HarvestSession = {
  id: string;
  code: string;
  fecha: string;
  lote: LotCode;
  bloque: string;
  tipo: HarvestType;
  pasada: number;
  modelo: PayModel;
  valorKg: number;
  jornal: number;
  alimUnit: number;
  factor: number;
  responsable: string;
  obs: string;
  trabajadores: WorkerRow[];
  totKg: number;
  totPay: number;
  totHrs: number;
  totAlim: number;
  totCost: number;
};

export type ProcessEvent = {
  id: string;
  stage: StageId;
  skipped: boolean;
  at: string;
  kgIn: number;
  kgOut: number;
  notas: string;
  responsable: string;
};

export type ProcessBatch = {
  id: string;
  sessionId: string;
  code: string;
  fecha: string;
  lote: LotCode;
  kgCereza: number;
  kgActual: number;
  factor: number;
  events: ProcessEvent[];
  saleId: string | null;
};

export type Liquidation = {
  id: string;
  fecha: string;
  trabajador: string;
  periodo: string;
  monto: number;
  tipo: "semana" | "anticipo";
  obs: string;
  sessionIds: string[];
};

export type Sale = {
  id: string;
  fecha: string;
  cliente: string;
  tipo: "pergamino" | "cereza";
  kg: number;
  precioKg: number;
  total: number;
  cobrado: number;
  metodo: PayMethodId;
  lote: LotCode | "";
  batchId: string;
  obs: string;
};

export type CostLine = {
  id: string;
  fecha: string;
  lote: LotCode | "";
  categoria: "fertilizacion" | "arvenses" | "renovacion" | "indirecto" | "otro";
  concepto: string;
  monto: number;
};

export type JournalLine = {
  cuenta: string;
  nombre: string;
  debe: number;
  haber: number;
};

export type JournalEntry = {
  id: string;
  fecha: string;
  origen: "cosecha" | "liquidacion" | "venta" | "costo" | "manual";
  origenId: string;
  glosa: string;
  lineas: JournalLine[];
};

export type Settings = {
  valorKg: number;
  jornal: number;
  alim: number;
  factor: number;
  responsable: string;
};

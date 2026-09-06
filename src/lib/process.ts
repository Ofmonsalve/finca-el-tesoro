export const PROCESS_STAGES = [
  {
    id: "tolva",
    label: "Tolva",
    hint: "Recepción de cereza del día",
    skippable: false,
  },
  {
    id: "flotacion",
    label: "Flotación",
    hint: "Separación por densidad. Puede omitirse.",
    skippable: true,
  },
  {
    id: "fermentacion_aire",
    label: "Fermentación al aire",
    hint: "Pre-despulpado. Puede omitirse.",
    skippable: true,
  },
  {
    id: "despulpado",
    label: "Despulpado",
    hint: "Retiro de pulpa",
    skippable: false,
  },
  {
    id: "fermentacion_tanque",
    label: "Fermentación en tanque",
    hint: "Mucílago. Puede omitirse y pasar a lavado.",
    skippable: true,
  },
  {
    id: "lavado",
    label: "Lavado",
    hint: "Retiro de mucílago",
    skippable: false,
  },
  {
    id: "secado",
    label: "Secado",
    hint: "Patio, marquesina o silo",
    skippable: false,
  },
  {
    id: "bodega",
    label: "Pergamino en bodega",
    hint: "Ciclo de secado cumplido, listo para despacho",
    skippable: false,
  },
  {
    id: "despacho",
    label: "Despacho",
    hint: "Salida hacia el comprador",
    skippable: false,
  },
  {
    id: "venta",
    label: "Venta e ingreso",
    hint: "Documento de venta y recaudo",
    skippable: false,
  },
] as const;

export type StageId = (typeof PROCESS_STAGES)[number]["id"];

export function stageMeta(id: StageId) {
  return PROCESS_STAGES.find((s) => s.id === id)!;
}

export function nextPendingStage(done: StageId[]): (typeof PROCESS_STAGES)[number] | null {
  return PROCESS_STAGES.find((s) => !done.includes(s.id)) ?? null;
}

export const PAY_METHODS = [
  { id: "efectivo", label: "Efectivo", cuenta: "1105", nombre: "Caja" },
  { id: "transferencia", label: "Transferencia", cuenta: "1110", nombre: "Bancos" },
  { id: "consignacion", label: "Consignación", cuenta: "1110", nombre: "Bancos" },
  { id: "cheque", label: "Cheque", cuenta: "1115", nombre: "Cheques por consignar" },
  { id: "credito", label: "Crédito / cartera", cuenta: "1305", nombre: "Clientes" },
] as const;

export type PayMethodId = (typeof PAY_METHODS)[number]["id"];

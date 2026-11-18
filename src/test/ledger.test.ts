import { describe, it, expect } from "vitest";
import { agregar, validar, PARTICIPANTES, type Bloque, type Solicitud } from "@/lib/ledger";
const P = (rol: string) => PARTICIPANTES.find((p) => p.rol === rol)!;
const s = (tipo: Solicitud["tipo"], rol: string, h = "h" + tipo, motivo?: string): Solicitud => ({ id_oc: "OC-1", tipo, participante: P(rol), hash_documento: h, nombreArchivo: "a.pdf", motivo });
async function run(c: Bloque[], x: Solicitud) { const r = validar(c, x); if (r.ok) c.push(await agregar(c, x)); return r; }

describe("reglas del contrato", () => {
  it("rechaza cuenta no registrada", () => { expect(validar([], s("EMISION", "NO_REGISTRADO")).ok).toBe(false); });
  it("rechaza entrega antes de aceptación", async () => { const c: Bloque[] = []; await run(c, s("EMISION", "ENTIDAD")); expect((await run(c, s("ENTREGA", "PROVEEDOR"))).ok).toBe(false); });
  it("bloquea modificar una OC cerrada", async () => {
    const c: Bloque[] = [];
    for (const [t, r] of [["EMISION","ENTIDAD"],["ACEPTACION","PROVEEDOR"],["ENTREGA","PROVEEDOR"],["CONFORMIDAD","ALMACEN"],["CIERRE","ENTIDAD"]] as const) expect((await run(c, s(t, r))).ok).toBe(true);
    expect((await run(c, s("MODIFICACION", "ENTIDAD", "x", "cambio"))).ok).toBe(false);
  });
  it("proveedor no puede emitir", () => { expect(validar([], s("EMISION", "PROVEEDOR")).ok).toBe(false); });
});

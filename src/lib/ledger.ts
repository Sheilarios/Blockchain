export type Rol = "PERU_COMPRAS" | "ENTIDAD" | "PROVEEDOR" | "ALMACEN" | "CONTRALORIA" | "OECE" | "NO_REGISTRADO";
export type TipoEvento = "EMISION" | "ACEPTACION" | "ENTREGA" | "CONFORMIDAD" | "MODIFICACION" | "ANULACION" | "CIERRE";
export type EstadoOC = "Emitida" | "Aceptada" | "Entregada" | "Conforme" | "Modificada" | "Anulada" | "Cerrada";

export interface Participante { id: string; nombre: string; rol: Rol }
export const PARTICIPANTES: Participante[] = [
  { id: "PC-001", nombre: "Perú Compras (plataforma)", rol: "PERU_COMPRAS" },
  { id: "ENT-MINSA", nombre: "Entidad: Ministerio de Salud", rol: "ENTIDAD" },
  { id: "PRV-20512345678", nombre: "Proveedor: Insumos Andinos SAC", rol: "PROVEEDOR" },
  { id: "ALM-MINSA", nombre: "Almacén MINSA", rol: "ALMACEN" },
  { id: "CGR-001", nombre: "Contraloría General", rol: "CONTRALORIA" },
  { id: "OECE-001", nombre: "OECE", rol: "OECE" },
  { id: "X-999", nombre: "Cuenta no registrada", rol: "NO_REGISTRADO" },
];

export interface Evento {
  id_evento: string; id_oc: string; tipo_evento: TipoEvento; hash_documento: string;
  estado_oc: EstadoOC; id_participante: string; fecha_evento: string; firma_digital: string;
  id_evento_anterior: string | null; referencia_documento: string; motivo?: string | undefined;
}
export interface Bloque { numero: number; hash: string; hash_anterior: string; evento: Evento; validadores: string[] }

// Matriz de permisos (5.16)
export const PERMISOS: Record<TipoEvento, Rol[]> = {
  EMISION: ["PERU_COMPRAS", "ENTIDAD"],
  ACEPTACION: ["PROVEEDOR"],
  ENTREGA: ["PROVEEDOR"],
  CONFORMIDAD: ["ENTIDAD", "ALMACEN"],
  MODIFICACION: ["ENTIDAD"],
  ANULACION: ["ENTIDAD", "PERU_COMPRAS"],
  CIERRE: ["ENTIDAD"],
};
const ESTADO_RESULTANTE: Record<TipoEvento, EstadoOC> = {
  EMISION: "Emitida", ACEPTACION: "Aceptada", ENTREGA: "Entregada", CONFORMIDAD: "Conforme",
  MODIFICACION: "Modificada", ANULACION: "Anulada", CIERRE: "Cerrada",
};
// Secuencia válida (5.8)
const PREVIO: Record<TipoEvento, EstadoOC[] | null> = {
  EMISION: null,
  ACEPTACION: ["Emitida", "Modificada"],
  ENTREGA: ["Aceptada"],
  CONFORMIDAD: ["Entregada"],
  MODIFICACION: ["Emitida", "Aceptada"],
  ANULACION: ["Emitida", "Aceptada", "Modificada"],
  CIERRE: ["Conforme"],
};

export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function estadoActual(cadena: Bloque[], id_oc: string): Evento | undefined {
  const evs = cadena.filter((b) => b.evento.id_oc === id_oc);
  return evs[evs.length - 1]?.evento;
}

export interface Solicitud { id_oc: string; tipo: TipoEvento; participante: Participante; hash_documento: string; nombreArchivo: string; motivo?: string | undefined }
export type Resultado = { ok: true } | { ok: false; error: string };

export function validar(cadena: Bloque[], s: Solicitud): Resultado {
  if (s.participante.rol === "NO_REGISTRADO") return { ok: false, error: "Participante no autorizado en la red permisionada." };
  if (!PERMISOS[s.tipo].includes(s.participante.rol)) return { ok: false, error: `El rol ${s.participante.rol} no puede registrar ${s.tipo}.` };
  if (!s.id_oc.trim()) return { ok: false, error: "Falta el identificador de la OC." };
  if (!s.hash_documento) return { ok: false, error: "Debe adjuntar el documento para calcular su hash." };
  const ultimo = estadoActual(cadena, s.id_oc);
  if (s.tipo === "EMISION") {
    if (ultimo) return { ok: false, error: "La orden de compra ya existe." };
  } else {
    if (!ultimo) return { ok: false, error: "La orden de compra no existe." };
    if (!PREVIO[s.tipo]!.includes(ultimo.estado_oc)) return { ok: false, error: `No se puede registrar ${s.tipo}: la OC está en estado "${ultimo.estado_oc}".` };
    if ((s.tipo === "MODIFICACION" || s.tipo === "ANULACION") && !s.motivo?.trim()) return { ok: false, error: "Modificación/anulación requiere motivo." };
  }
  const dup = cadena.some((b) => b.evento.id_oc === s.id_oc && b.evento.tipo_evento === s.tipo && b.evento.hash_documento === s.hash_documento);
  if (dup) return { ok: false, error: "Evento duplicado." };
  return { ok: true };
}

export const NODOS = ["Nodo Perú Compras", "Nodo OECE", "Nodo Contraloría"];

export async function agregar(cadena: Bloque[], s: Solicitud): Promise<Bloque> {
  const ultimo = estadoActual(cadena, s.id_oc);
  const fecha = new Date().toISOString();
  const id_evento = "EV-" + (await sha256(s.id_oc + s.tipo + fecha)).slice(0, 10).toUpperCase();
  const evento: Evento = {
    id_evento, id_oc: s.id_oc, tipo_evento: s.tipo, hash_documento: s.hash_documento,
    estado_oc: ESTADO_RESULTANTE[s.tipo], id_participante: s.participante.id, fecha_evento: fecha,
    firma_digital: "0x" + (await sha256(s.participante.id + s.hash_documento + fecha)).slice(0, 40),
    id_evento_anterior: ultimo?.id_evento ?? null, referencia_documento: `repo://perucompras/${s.id_oc}/${s.nombreArchivo}`,
    motivo: s.motivo,
  };
  const hash_anterior = cadena[cadena.length - 1]?.hash ?? "0".repeat(64);
  const numero = cadena.length;
  const hash = await sha256(numero + hash_anterior + JSON.stringify(evento));
  return { numero, hash, hash_anterior, evento, validadores: NODOS };
}

export async function integridadCadena(cadena: Bloque[]): Promise<boolean> {
  for (let i = 0; i < cadena.length; i++) {
    const b = cadena[i]!;
    const prev = i === 0 ? "0".repeat(64) : cadena[i - 1]!.hash;
    if (b.hash_anterior !== prev) return false;
    if ((await sha256(b.numero + b.hash_anterior + JSON.stringify(b.evento))) !== b.hash) return false;
  }
  return true;
}

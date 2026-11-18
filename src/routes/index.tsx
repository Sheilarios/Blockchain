import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, SearchX, Boxes, FileUp, Link2, Hammer, RotateCcw, QrCode } from "lucide-react";
import {
  PARTICIPANTES, PERMISOS, agregar, validar, sha256, integridadCadena, estadoActual,
  type Bloque, type TipoEvento,
} from "@/lib/ledger";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrazaOC · Prototipo blockchain de contrataciones públicas" },
      { name: "description", content: "Registre, valide y verifique órdenes de compra de Perú Compras en una red blockchain permisionada simulada." },
      { property: "og:title", content: "TrazaOC · Prototipo blockchain" },
      { property: "og:description", content: "Trazabilidad y verificación de órdenes de compra públicas del Perú." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

const KEY = "trazaoc-cadena";
const TIPOS = Object.keys(PERMISOS) as TipoEvento[];
type Tab = "registrar" | "verificar" | "cadena";

function App() {
  const [cadena, setCadena] = useState<Bloque[]>([]);
  const [tab, setTab] = useState<Tab>("registrar");
  const [integra, setIntegra] = useState(true);
  useEffect(() => { const r = localStorage.getItem(KEY); if (r) setCadena(JSON.parse(r)); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cadena)); integridadCadena(cadena).then(setIntegra); }, [cadena]);
  const ocs = [...new Set(cadena.map((b) => b.evento.id_oc))];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-accent text-accent-foreground"><Link2 className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TrazaOC</h1>
              <p className="text-xs opacity-75">Capa de trazabilidad blockchain · Catálogos Electrónicos Perú Compras</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {["Perú Compras", "OECE", "Contraloría"].map((n) => (
              <span key={n} className="flex items-center gap-1.5 rounded border border-primary-foreground/25 px-2 py-1">
                <span className={`h-2 w-2 rounded-full ${integra ? "bg-success" : "bg-destructive"}`} />Nodo {n}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-xl">
          <Stat label="Bloques" value={cadena.length} />
          <Stat label="Órdenes" value={ocs.length} />
          <Stat label="Cadena" value={integra ? "Íntegra" : "Alterada"} tone={integra ? "text-success" : "text-destructive"} />
        </div>
        <nav className="mb-6 flex gap-1 border-b border-border">
          {([["registrar", "Registrar evento"], ["verificar", "Verificar documento"], ["cadena", "Libro de bloques"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </nav>
        {tab === "registrar" && <Registrar cadena={cadena} setCadena={setCadena} ocs={ocs} />}
        {tab === "verificar" && <Verificar cadena={cadena} ocs={ocs} />}
        {tab === "cadena" && <Cadena cadena={cadena} setCadena={setCadena} integra={integra} />}
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return <div className="rounded border border-border bg-card p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`font-mono text-xl font-semibold ${tone}`}>{value}</p></div>;
}

const input = "w-full rounded border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const Label = ({ children }: { children: React.ReactNode }) => <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</label>;

function FilePick({ onHash, file }: { onHash: (h: string, name: string) => void; file: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded border border-dashed border-input bg-muted px-3 py-3 text-sm hover:border-primary">
      <FileUp className="h-4 w-4 text-muted-foreground" />
      <span className="truncate">{file || "Seleccionar documento (PDF u otro)"}</span>
      <input type="file" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onHash(await sha256(await f.arrayBuffer()), f.name); }} />
    </label>
  );
}

function Registrar({ cadena, setCadena, ocs }: { cadena: Bloque[]; setCadena: (c: Bloque[]) => void; ocs: string[] }) {
  const [pid, setPid] = useState(PARTICIPANTES[1]!.id);
  const [tipo, setTipo] = useState<TipoEvento>("EMISION");
  const [idOc, setIdOc] = useState("OC-2026-000123");
  const [hash, setHash] = useState(""); const [file, setFile] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const p = PARTICIPANTES.find((x) => x.id === pid)!;
  const estado = estadoActual(cadena, idOc)?.estado_oc;

  async function enviar() {
    const s = { id_oc: idOc.trim(), tipo, participante: p, hash_documento: hash, nombreArchivo: file, motivo };
    const r = validar(cadena, s);
    if (!r.ok) return setMsg({ ok: false, t: r.error });
    const b = await agregar(cadena, s);
    setCadena([...cadena, b]);
    setMsg({ ok: true, t: `Bloque #${b.numero} validado por 3 nodos (QBFT). Estado: ${b.evento.estado_oc}` });
    setHash(""); setFile(""); setMotivo("");
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="space-y-4 rounded border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Participante (firma)</Label>
            <select className={input} value={pid} onChange={(e) => setPid(e.target.value)}>{PARTICIPANTES.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
          <div><Label>Tipo de evento</Label>
            <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><Label>Identificador OC</Label>
            <input className={input} list="ocs" value={idOc} onChange={(e) => setIdOc(e.target.value)} /><datalist id="ocs">{ocs.map((o) => <option key={o} value={o} />)}</datalist>
            <p className="mt-1 text-xs text-muted-foreground">Estado actual: <b>{estado ?? "no registrada"}</b></p></div>
          {(tipo === "MODIFICACION" || tipo === "ANULACION") && <div><Label>Motivo</Label><input className={input} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>}
        </div>
        <div><Label>Documento asociado</Label><FilePick file={file} onHash={(h, n) => { setHash(h); setFile(n); }} />
          {hash && <p className="mt-2 break-all font-mono text-xs text-muted-foreground">SHA-256: {hash}</p>}</div>
        <button onClick={enviar} className="rounded bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Firmar y enviar a la red</button>
        {msg && <div className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${msg.ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{msg.ok ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}{msg.t}</div>}
      </section>
      <aside className="rounded border border-border bg-card p-5 text-sm">
        <h3 className="mb-3 font-semibold">Matriz de permisos</h3>
        <ul className="space-y-2">{TIPOS.map((t) => <li key={t} className="flex justify-between gap-2"><span className="font-mono text-xs">{t}</span><span className="text-right text-xs text-muted-foreground">{PERMISOS[t].join(", ")}</span></li>)}</ul>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Secuencia: Emitida → Aceptada → Entregada → Conforme → Cerrada. Modificación y anulación se agregan como nuevos eventos; nada se borra.</p>
      </aside>
    </div>
  );
}

function Verificar({ cadena, ocs }: { cadena: Bloque[]; ocs: string[] }) {
  const [idOc, setIdOc] = useState(ocs[0] ?? "");
  const [res, setRes] = useState<"ok" | "mod" | "nf" | null>(null);
  const [file, setFile] = useState("");
  const hist = cadena.filter((b) => b.evento.id_oc === idOc);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4 rounded border border-border bg-card p-6">
        <div><Label>Identificador OC o código QR</Label>
          <div className="flex gap-2"><QrCode className="mt-2 h-5 w-5 text-muted-foreground" /><input className={input} list="ocs2" value={idOc} onChange={(e) => { setIdOc(e.target.value); setRes(null); }} /></div>
          <datalist id="ocs2">{ocs.map((o) => <option key={o} value={o} />)}</datalist></div>
        <div><Label>Documento a verificar</Label>
          <FilePick file={file} onHash={(h, n) => { setFile(n); setRes(hist.length === 0 ? "nf" : hist.some((b) => b.evento.hash_documento === h) ? "ok" : "mod"); }} /></div>
        {res === "ok" && <Res icon={<ShieldCheck />} tone="border-success/40 bg-success/10 text-success" t="Documento íntegro" d="El hash coincide con el registrado en blockchain." />}
        {res === "mod" && <Res icon={<ShieldAlert />} tone="border-destructive/40 bg-destructive/10 text-destructive" t="Documento modificado" d="El hash no coincide con ninguna evidencia registrada." />}
        {res === "nf" && <Res icon={<SearchX />} tone="border-warning/50 bg-warning/10 text-foreground" t="Registro no encontrado" d="No existe evidencia asociada al identificador consultado." />}
      </section>
      <section className="rounded border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Historial público de {idOc || "—"}</h3>
        {hist.length === 0 ? <p className="text-sm text-muted-foreground">Sin eventos.</p> :
          <ol className="relative space-y-4 border-l-2 border-border pl-5">
            {hist.map((b) => <li key={b.hash} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-accent" />
              <p className="text-sm font-semibold">{b.evento.tipo_evento} → {b.evento.estado_oc}</p>
              <p className="text-xs text-muted-foreground">{new Date(b.evento.fecha_evento).toLocaleString("es-PE")} · {b.evento.id_participante}</p>
              {b.evento.motivo && <p className="text-xs">Motivo: {b.evento.motivo}</p>}
              <p className="truncate font-mono text-xs text-muted-foreground">{b.evento.hash_documento}</p></li>)}
          </ol>}
      </section>
    </div>
  );
}
const Res = ({ icon, tone, t, d }: { icon: React.ReactNode; tone: string; t: string; d: string }) => (
  <div className={`flex gap-3 rounded border p-4 [&>svg]:h-6 [&>svg]:w-6 ${tone}`}>{icon}<div><p className="font-semibold">{t}</p><p className="text-sm opacity-80">{d}</p></div></div>
);

function Cadena({ cadena, setCadena, integra }: { cadena: Bloque[]; setCadena: (c: Bloque[]) => void; integra: boolean }) {
  function manipular() {
    if (!cadena.length) return;
    const c = structuredClone(cadena); c[0]!.evento.estado_oc = "Cerrada"; setCadena(c);
  }
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={manipular} className="flex items-center gap-2 rounded border border-destructive/50 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"><Hammer className="h-4 w-4" />Simular manipulación del bloque #0</button>
        <button onClick={() => confirm("¿Reiniciar la red de prueba?") && setCadena([])} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-muted"><RotateCcw className="h-4 w-4" />Reiniciar red</button>
        <span className={`ml-auto text-sm font-semibold ${integra ? "text-success" : "text-destructive"}`}>{integra ? "Todos los enlaces de hash son válidos" : "¡Integridad rota! Los nodos rechazan la cadena"}</span>
      </div>
      {cadena.length === 0 ? <p className="rounded border border-dashed border-border p-10 text-center text-sm text-muted-foreground"><Boxes className="mx-auto mb-2 h-6 w-6" />Aún no hay bloques. Registre una OC en la pestaña "Registrar evento".</p> :
        <div className="space-y-3">{[...cadena].reverse().map((b) => (
          <div key={b.numero + b.hash} className="rounded border border-border bg-card p-4 font-mono text-xs">
            <div className="mb-2 flex justify-between font-sans text-sm"><b>Bloque #{b.numero} · {b.evento.tipo_evento}</b><span className="text-muted-foreground">{b.evento.id_oc} · {b.evento.estado_oc}</span></div>
            <p className="truncate"><span className="text-muted-foreground">hash: </span>{b.hash}</p>
            <p className="truncate"><span className="text-muted-foreground">anterior: </span>{b.hash_anterior}</p>
            <p className="truncate"><span className="text-muted-foreground">doc: </span>{b.evento.hash_documento} <span className="text-muted-foreground">({b.evento.referencia_documento} · off-chain)</span></p>
            <p className="truncate"><span className="text-muted-foreground">firma: </span>{b.evento.firma_digital} · {b.evento.id_participante}</p>
          </div>))}</div>}
    </section>
  );
}

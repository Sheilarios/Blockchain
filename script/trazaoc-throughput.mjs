import { webcrypto } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const TOTAL = 100;
const EMISOR = "ENT-MINSA";
const ARCHIVO = "resultados_throughput.csv";

async function registrarOC(id, emisor, registro) {
  if (registro.has(id)) throw new Error(`La OC ${id} ya existe`);

  const datos = new TextEncoder().encode(JSON.stringify({ id, emisor }));
  const digest = await webcrypto.subtle.digest("SHA-256", datos);
  registro.set(id, { emisor, hash: Buffer.from(digest).toString("hex") });
}

async function main() {
  const ids = Array.from({ length: TOTAL }, (_, i) => `OC-2026-${String(i + 1).padStart(6, "0")}`);
  const registro = new Map();
  const resultados = [];
  const errores = [];

  const inicio = performance.now();
  for (const [i, id] of ids.entries()) {
    let estado = "OK";
    const envio = performance.now();
    try {
      await registrarOC(id, EMISOR, registro);
    } catch (error) {
      estado = "ERROR";
      errores.push({ id, error });
    }
    resultados.push({ nro: i + 1, id, estado, latencia: performance.now() - envio });
  }
  const totalMs = performance.now() - inicio;

  const throughput = TOTAL / (totalMs / 1000);
  const latenciaPromedio = resultados.reduce((suma, fila) => suma + fila.latencia, 0) / TOTAL;
  const csv = [
    "Nro,ID_OC,Estado,Latencia (ms)",
    ...resultados.map(({ nro, id, estado, latencia }) => `${nro},${id},${estado},${latencia.toFixed(6)}`),
  ].join("\n");
  await writeFile(ARCHIVO, `${csv}\n`, "utf8");

  console.log(`Transacciones: ${TOTAL} | Exitosas: ${registro.size} | Fallidas: ${errores.length}`);
  console.log(`Tiempo total: ${totalMs.toFixed(3)} ms`);
  console.log(`Throughput: ${throughput.toFixed(2)} intentos/s`);
  if (errores.length) {
    console.log(`Throughput exitoso: ${(registro.size / (totalMs / 1000)).toFixed(2)} transacciones/s`);
    for (const { id, error } of errores) console.error(id, error);
    process.exitCode = 1;
  }
  console.log(`Latencia promedio: ${latenciaPromedio.toFixed(6)} ms`);
  console.log(`CSV generado: ${ARCHIVO}`);
}

main().catch((error) => {
  console.error("No se pudo completar la prueba:", error);
  process.exitCode = 1;
});

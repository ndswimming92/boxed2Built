import type { CompileRequest, CompileResult } from './types';
import type { ParamValue } from './params';

/**
 * Main-thread handle for the OpenSCAD worker.
 *
 * The worker is created on first use and kept for the session — it is the 14 MB
 * WASM module that is expensive to fetch, not the worker itself, and reusing the
 * worker keeps that download in memory across compiles. Nothing here runs at
 * import time: the module is only ever reached from an admin route, and the
 * build prerenders pages with a mocked DOM, so construction has to stay tied to
 * an explicit user action rather than to module evaluation.
 */

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (result: CompileResult) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: 'openscad',
    });
    worker.onmessage = (event: MessageEvent<CompileResult>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        pending.delete(event.data.id);
        resolve(event.data);
      }
    };
    worker.onerror = (event) => {
      // A worker-level failure kills every in-flight compile, so fail them all
      // rather than leaving the UI spinning forever.
      const message = event.message || 'The CAD compiler crashed';
      for (const [id, resolve] of pending) {
        resolve({ id, ok: false, error: message, log: '', durationMs: 0 });
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export interface CompileOptions {
  paramValues?: Record<string, ParamValue>;
  /** Guards against a pathological model locking the worker up. */
  timeoutMs?: number;
}

export function compileScad(
  source: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const id = nextId;
  nextId += 1;

  const request: CompileRequest = {
    id,
    source,
    paramValues: options.paramValues,
  };

  return new Promise<CompileResult>((resolve) => {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      // The worker is wedged inside a WASM call and cannot be interrupted, so
      // replace it outright instead of waiting on a reply that is not coming.
      worker?.terminate();
      worker = null;
      resolve({
        id,
        ok: false,
        error: `Compile timed out after ${Math.round(timeoutMs / 1000)}s. The model is probably too complex — try lowering $fn or simplifying the design.`,
        log: '',
        durationMs: timeoutMs,
      });
    }, timeoutMs);

    pending.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    getWorker().postMessage(request);
  });
}

/** Frees the WASM module. Called when the studio unmounts. */
export function disposeCompiler(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}

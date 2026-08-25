/** Shared types for the browser-side OpenSCAD compile pipeline. */

export interface CompileRequest {
  id: number;
  source: string;
  /** Rendered into the source as top-level assignments before compiling. */
  paramValues?: Record<string, number | boolean | string>;
}

export interface CompileSuccess {
  id: number;
  ok: true;
  /** Binary STL bytes, ready for parsing or upload. */
  stl: Uint8Array;
  /** Everything OpenSCAD wrote to stdout/stderr, kept for the log panel. */
  log: string;
  durationMs: number;
}

export interface CompileFailure {
  id: number;
  ok: false;
  /** The compiler output an admin (and Claude, on repair) needs to see. */
  error: string;
  log: string;
  durationMs: number;
}

export type CompileResult = CompileSuccess | CompileFailure;

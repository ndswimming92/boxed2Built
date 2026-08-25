/// <reference lib="webworker" />
import { createOpenSCAD } from 'openscad-wasm';
import fontUrl from '../../assets/fonts/DejaVuSans.ttf?url';
import { applyParamValues } from './params';
import type { CompileRequest, CompileResult } from './types';

/**
 * OpenSCAD compiles inside this worker rather than on a server: the site is a
 * static SPA with no Node runtime, and Supabase Edge Functions are Deno with no
 * OpenSCAD binary. Running it here also makes slider tweaks free — re-compiling
 * costs nothing and never touches the Claude API.
 *
 * Two constraints from the WASM build shape everything below:
 *   1. `callMain` is single-use. A second call on the same module throws, so
 *      every compile builds a fresh instance. That costs ~40-140 ms, which is
 *      cheap enough not to matter next to a ~30-60 ms compile.
 *   2. The build ships no fonts and no fontconfig, so `text()` fails outright
 *      until a font and a config are written into the virtual filesystem.
 */

const FONTS_CONF = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/usr/share/fonts</dir>
  <cachedir>/tmp/fontconfig</cachedir>
</fontconfig>`;

/** Fetched once and reused; the worker outlives individual compiles. */
let fontBytesPromise: Promise<Uint8Array> | null = null;

function loadFontBytes(): Promise<Uint8Array> {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(fontUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Font fetch failed (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => new Uint8Array(buf))
      .catch((error) => {
        // A missing font must not take down models that never call text().
        fontBytesPromise = null;
        throw error;
      });
  }
  return fontBytesPromise;
}

async function compile(request: CompileRequest): Promise<CompileResult> {
  const started = performance.now();
  const output: string[] = [];

  try {
    const instance = await createOpenSCAD({
      noInitialRun: true,
      print: (text) => output.push(text),
      printErr: (text) => output.push(text),
    });
    const scad = instance.getInstance();

    // Font setup. Best-effort: a model that never calls text() should still
    // compile if the font asset is unreachable for any reason.
    try {
      const fontBytes = await loadFontBytes();
      for (const dir of ['/etc', '/etc/fonts', '/usr', '/usr/share', '/usr/share/fonts', '/tmp', '/tmp/fontconfig']) {
        try {
          scad.FS.mkdir(dir);
        } catch {
          // Already exists — Emscripten's FS throws rather than returning.
        }
      }
      scad.FS.writeFile('/etc/fonts/fonts.conf', FONTS_CONF);
      scad.FS.writeFile('/usr/share/fonts/DejaVuSans.ttf', fontBytes);
      if (scad.ENV) {
        scad.ENV.FONTCONFIG_FILE = '/etc/fonts/fonts.conf';
        scad.ENV.FONTCONFIG_PATH = '/etc/fonts';
        scad.ENV.HOME = '/tmp';
      }
    } catch (fontError) {
      output.push(`WARNING: font setup failed, text() will not render: ${String(fontError)}`);
    }

    const source = applyParamValues(request.source, request.paramValues ?? {});
    scad.FS.writeFile('/model.scad', source);

    let code: number;
    try {
      code = scad.callMain([
        '/model.scad',
        '-o',
        '/model.stl',
        // `--enable=manifold` is rejected by this build as an unknown feature;
        // the backend flag is what actually selects the fast manifold kernel.
        '--backend=manifold',
        '--export-format=binstl',
      ]);
    } catch (runtimeError) {
      // A hard WASM trap (deep recursion, out of memory) surfaces here rather
      // than as a non-zero exit code.
      output.push(`FATAL: ${String(runtimeError)}`);
      code = -1;
    }

    const log = output.join('\n');

    if (code !== 0) {
      return {
        id: request.id,
        ok: false,
        error: extractError(log) || `OpenSCAD exited with code ${code}`,
        log,
        durationMs: performance.now() - started,
      };
    }

    const stl = scad.FS.readFile('/model.stl', { encoding: 'binary' });
    if (!stl || stl.length < 84) {
      return {
        id: request.id,
        ok: false,
        error: 'The model compiled but produced no geometry. Check that the design is a solid and sits above Z=0.',
        log,
        durationMs: performance.now() - started,
      };
    }

    return {
      id: request.id,
      ok: true,
      // Copy out of the WASM heap — the underlying buffer is freed with the
      // module, and this is about to be transferred to the main thread.
      stl: new Uint8Array(stl),
      log,
      durationMs: performance.now() - started,
    };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Compile failed',
      log: output.join('\n'),
      durationMs: performance.now() - started,
    };
  }
}

/**
 * OpenSCAD prints a lot of cache statistics and localization noise around the
 * one or two lines that actually say what went wrong. Those lines are what gets
 * shown to the admin and fed back to Claude on a repair, so pull them out.
 */
function extractError(log: string): string {
  const lines = log
    .split('\n')
    .filter((line) => /^(ERROR|WARNING: Can't|FATAL|Can't parse|Parser error)/i.test(line.trim()))
    // Fontconfig complains on every run even when fonts resolve correctly.
    .filter((line) => !/fontconfig|localization/i.test(line));
  return lines.slice(0, 8).join('\n').trim();
}

self.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const result = await compile(event.data);
  if (result.ok) {
    (self as unknown as Worker).postMessage(result, [result.stl.buffer]);
  } else {
    (self as unknown as Worker).postMessage(result);
  }
};

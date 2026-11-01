import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

/**
 * The Edge Functions run on Deno and are not type-checked by `npm run typecheck`,
 * and most of their code cannot be loaded by these tests. A helper that is used but
 * never imported (or a typo in a name) therefore only shows up when the function runs:
 * for texting it showed up as every text failing with "sentApiKey is not defined",
 * which the sender catches and logs, so nothing visibly broke.
 *
 * This asks the TypeScript compiler for "Cannot find name" and "Cannot find name, did
 * you mean" errors only, across every function and shared file. It ignores everything
 * else Deno-specific (npm: and jsr: imports it cannot resolve, the Deno and EdgeRuntime globals), so it
 * stays quiet unless a name really is undefined.
 */

const FUNCTIONS_DIR = resolve('supabase/functions');
const CANNOT_FIND_NAME = new Set([2304, 2552]);
// Provided by Supabase's runtime, so the compiler cannot see them.
const RUNTIME_GLOBALS = new Set(['Deno', 'EdgeRuntime']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
  });
}

function undefinedNames(files: string[]): string[] {
  const program = ts.createProgram(files, {
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
    types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  });

  const problems: string[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    for (const diagnostic of program.getSemanticDiagnostics(source)) {
      if (!CANNOT_FIND_NAME.has(diagnostic.code) || diagnostic.start === undefined) continue;
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      const name = /Cannot find name '([^']+)'/.exec(message)?.[1];
      if (name && RUNTIME_GLOBALS.has(name)) continue;
      const { line } = source.getLineAndCharacterOfPosition(diagnostic.start);
      problems.push(`${file.replace(`${resolve('.')}/`, '')}:${line + 1} ${message}`);
    }
  }
  return problems;
}

test('every name used in an Edge Function or its shared code is defined or imported', () => {
  const problems = undefinedNames(sourceFiles(FUNCTIONS_DIR));
  assert.deepEqual(problems, [], `Undefined names:\n${problems.join('\n')}`);
});

test('the check does catch a helper that is used but not imported', () => {
  const source = ts.createSourceFile('probe.ts', 'export const x = missingHelper();', ts.ScriptTarget.ES2022);
  const host = ts.createCompilerHost({});
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ...rest) => (name.endsWith('probe.ts') ? source : original(name, ...rest));
  const program = ts.createProgram(['probe.ts'], { noEmit: true, types: [], lib: ['lib.es2022.d.ts'] }, host);
  const codes = program.getSemanticDiagnostics(program.getSourceFile('probe.ts')).map((d) => d.code);
  assert.ok(codes.some((code) => CANNOT_FIND_NAME.has(code)));
});

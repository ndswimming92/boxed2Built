/**
 * `openscad-wasm@0.0.4` points its `types` field at the 14 MB bundle itself, so
 * TypeScript finds no declarations. The package also ships `.d.ts` stubs for
 * `openscad.fonts` and `openscad.mcad` with no matching JavaScript — importing
 * either throws at runtime. Only `createOpenSCAD` actually exists.
 */
declare module 'openscad-wasm' {
  export interface OpenSCADFS {
    mkdir(path: string): void;
    readFile(path: string, opts: { encoding: 'binary' }): Uint8Array;
    readFile(path: string, opts: { encoding: 'utf8' }): string;
    writeFile(path: string, data: string | ArrayBufferView): void;
    unlink(path: string): void;
  }

  export interface OpenSCADModule {
    /** Emscripten's entry point. Single-use: a second call throws. */
    callMain(args: string[]): number;
    FS: OpenSCADFS;
    /** Emscripten environment map; fontconfig is configured through it. */
    ENV?: Record<string, string>;
  }

  export interface OpenSCADInstance {
    renderToStl(code: string): Promise<string>;
    getInstance(): OpenSCADModule;
  }

  export function createOpenSCAD(options?: {
    noInitialRun?: boolean;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
  }): Promise<OpenSCADInstance>;
}

declare module '*.ttf' {
  const url: string;
  export default url;
}

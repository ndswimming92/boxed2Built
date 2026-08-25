# DejaVuSans.ttf

Bundled so OpenSCAD's `text()` resolves a font inside the WASM sandbox, which
ships with no fonts and no fontconfig setup at all. The worker writes this file
into the virtual filesystem at `/usr/share/fonts/` before every compile — see
`src/lib/openscad/worker.ts`.

DejaVu Sans is released under a permissive Bitstream Vera derived licence
(free to use, embed and redistribute, including commercially):
https://dejavu-fonts.github.io/License.html

It is the only font available to generated models, which is why the model
generation prompt in `supabase/functions/generate-print-model/index.ts` requires
`font = "DejaVu Sans"` on every `text()` call.

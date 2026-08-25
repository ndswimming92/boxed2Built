import { test, expect, type Page } from '@playwright/test';

/**
 * Every assertion here corresponds to something that reached production and had
 * to be found by eye. Typecheck, lint and build all passed on each of them.
 */

const HARNESS = '/tests/harness/index.html';

/** A small, fast, unambiguous solid: a box with a cavity. */
const TRAY = `/* [Dimensions] */
// Outside width
width = 60;   // [20:1:120]
// Wall thickness
wall = 2.4;   // [1.2:0.2:6]
difference() {
  cube([width, 40, 20]);
  translate([wall, wall, wall]) cube([width - 2 * wall, 40 - 2 * wall, 20]);
}`;

async function openHarness(page: Page) {
  await page.goto(HARNESS);
  await page.waitForFunction(() => typeof window.__harness?.compile === 'function');
}

/**
 * Samples the WebGL canvas and counts pixels that are not the scene background.
 *
 * This is the check that matters: the canvas can be present, correctly sized
 * and mounted while showing nothing at all, which is exactly what happened when
 * the drawing buffer and the CSS box disagreed.
 */
async function paintedPixelRatio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#viewer canvas') as HTMLCanvasElement | null;
    if (!canvas) return -1;

    const probe = document.createElement('canvas');
    probe.width = 200;
    probe.height = 200;
    const context = probe.getContext('2d');
    if (!context) return -1;
    context.drawImage(canvas, 0, 0, probe.width, probe.height);

    const { data } = context.getImageData(0, 0, probe.width, probe.height);
    // Scene background is #f8fafc.
    const [bgR, bgG, bgB] = [248, 250, 252];
    let painted = 0;
    for (let i = 0; i < data.length; i += 4) {
      const distance =
        Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB);
      if (distance > 24) painted += 1;
    }
    return painted / (probe.width * probe.height);
  });
}

test('compiles OpenSCAD to a watertight mesh in the browser', async ({ page }) => {
  await openHarness(page);

  const result = await page.evaluate(
    (source) => window.__harness.compile(source),
    TRAY,
  );

  expect(result.ok, result.error).toBe(true);
  expect(result.metrics!.watertight).toBe(true);
  expect(result.metrics!.openEdges).toBe(0);
  expect(result.metrics!.triangleCount).toBeGreaterThan(10);
  // 60 x 40 x 20 as declared, proving parameters reached the compiler.
  expect(result.metrics!.bbox.x).toBeCloseTo(60, 1);
  expect(result.metrics!.bbox.y).toBeCloseTo(40, 1);
  expect(result.metrics!.bbox.z).toBeCloseTo(20, 1);
  // A flat base resting on the plate is not an overhang.
  expect(result.metrics!.maxOverhangDeg).toBeLessThanOrEqual(45);
  expect(result.paramNames).toEqual(['width', 'wall']);
});

test('the preview actually paints at 2x device pixel ratio', async ({ page }) => {
  await openHarness(page);
  await page.evaluate((source) => window.__harness.compile(source), TRAY);

  // The canvas must fill its container. When setSize() was told not to update
  // the style, the element laid out at twice this and the visible region was
  // empty background.
  const box = await page.evaluate(() => {
    const canvas = document.querySelector('#viewer canvas') as HTMLCanvasElement;
    const host = document.querySelector('#viewer') as HTMLElement;
    return {
      canvasWidth: canvas.getBoundingClientRect().width,
      canvasHeight: canvas.getBoundingClientRect().height,
      hostWidth: host.getBoundingClientRect().width,
      hostHeight: host.getBoundingClientRect().height,
    };
  });
  // Tolerance covers the viewer's 1px border. The regression this guards
  // against is the canvas laying out at the device pixel ratio - twice the
  // container - not a couple of pixels of chrome.
  expect(box.canvasWidth / box.hostWidth).toBeGreaterThan(0.9);
  expect(box.canvasWidth / box.hostWidth).toBeLessThan(1.1);
  expect(box.canvasHeight / box.hostHeight).toBeGreaterThan(0.9);
  expect(box.canvasHeight / box.hostHeight).toBeLessThan(1.1);

  await expect
    .poll(() => paintedPixelRatio(page), {
      message: 'canvas rendered nothing but background',
    })
    .toBeGreaterThan(0.02);
});

test('the mesh survives a printer change', async ({ page }) => {
  await openHarness(page);
  await page.evaluate((source) => window.__harness.compile(source), TRAY);
  await expect.poll(() => paintedPixelRatio(page)).toBeGreaterThan(0.02);

  // The scene used to be rebuilt on a bed-size change while the effect that
  // adds the mesh had no reason to re-run, stranding the model in the disposed
  // scene and blanking the view.
  await page.evaluate(() => window.__harness.setBed(180, 180));

  await expect
    .poll(() => paintedPixelRatio(page), {
      message: 'canvas went blank after the build plate changed',
    })
    .toBeGreaterThan(0.02);
});

test('text() renders, so the bundled font reached the sandbox', async ({ page }) => {
  await openHarness(page);

  // The WASM build ships no fonts at all; text() fails outright unless a font
  // and a fontconfig are written into its virtual filesystem.
  const result = await page.evaluate(() =>
    window.__harness.compile(
      'linear_extrude(3) text("BOXED2BUILT", size=10, font="DejaVu Sans");',
    ),
  );

  expect(result.ok, result.error).toBe(true);
  expect(result.metrics!.triangleCount).toBeGreaterThan(100);
  expect(result.metrics!.bbox.x).toBeGreaterThan(40);
});

test('a compile error surfaces the compiler message', async ({ page }) => {
  await openHarness(page);

  // This message is what gets fed back to Claude for the repair loop, so it has
  // to be the real diagnostic rather than a generic failure.
  const result = await page.evaluate(() => window.__harness.compile('cube([10,20,30)'));

  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/syntax error|Parser error|parse/i);
});

test('sliders change the geometry without a new generation', async ({ page }) => {
  await openHarness(page);

  const base = await page.evaluate((source) => window.__harness.compile(source), TRAY);
  const wider = await page.evaluate(
    (source) => window.__harness.compile(source, { width: 100, wall: 3 }),
    TRAY,
  );

  expect(base.metrics!.bbox.x).toBeCloseTo(60, 1);
  expect(wider.metrics!.bbox.x).toBeCloseTo(100, 1);
  expect(wider.metrics!.watertight).toBe(true);
});

test('the 3MF is a valid container Bambu Studio can open', async ({ page }) => {
  await openHarness(page);
  const result = await page.evaluate((source) => window.__harness.compile(source), TRAY);

  // Size is not the contract - on a small mesh the container's fixed XML
  // overhead outweighs the vertex sharing, and that is fine. What matters is
  // that the archive has the entries a slicer looks for.
  expect(result.threeMfEntries).toEqual(
    expect.arrayContaining([
      '[Content_Types].xml',
      '_rels/.rels',
      '3D/3dmodel.model',
      'Metadata/project_settings.config',
    ]),
  );
  expect(result.threeMfModelXml).toContain('unit="millimeter"');
  expect(result.threeMfModelXml).toMatch(/<vertex x="[^"]+" y="[^"]+" z="[^"]+"\/>/);
  expect(result.threeMfModelXml).toMatch(/<triangle v1="\d+" v2="\d+" v3="\d+"\/>/);
  // Vertices are indexed rather than repeated three-per-triangle as in STL.
  expect(result.threeMfVertexCount!).toBeLessThan(result.metrics!.triangleCount * 3);
});

/** A two-part model, shaped the way Claude actually writes them. */
const TWO_PART = `/* [Part] */
// Which piece to generate
part = "cabinet";   // [cabinet, drawer]

/* [Cabinet] */
// Cabinet shell thickness
cabinet_wall = 3;   // [2:0.2:6]

/* [Drawers] */
// Sliding clearance per side
drawer_clearance = 0.5;  // [0.2:0.1:1]

/* [Handle] */
// Handle length along the drawer front
handle_length = 60;      // [20:1:120]

/* [Shared] */
// Gap between cabinet and drawer
fit_gap = 0.4;      // [0.1:0.1:1]
// Bottom edge chamfer
chamfer = 0.6;      // [0:0.1:2]
`;

test('only the selected piece\'s settings are shown', async ({ page }) => {
  await openHarness(page);

  const onCabinet = await page.evaluate(
    (source) => window.__harness.hiddenParams(source, { part: 'cabinet' }),
    TWO_PART,
  );
  // Named for the drawer, so not the cabinet's business - including the handle,
  // whose label mentions the drawer front.
  expect(onCabinet).toEqual(['drawer_clearance', 'handle_length']);

  const onDrawer = await page.evaluate(
    (source) => window.__harness.hiddenParams(source, { part: 'drawer' }),
    TWO_PART,
  );
  expect(onDrawer).toEqual(['cabinet_wall']);

  // Parameters naming both pieces, or neither, are shared and always visible.
  expect(onCabinet).not.toContain('fit_gap');
  expect(onDrawer).not.toContain('fit_gap');
  expect(onCabinet).not.toContain('chamfer');
  expect(onDrawer).not.toContain('chamfer');
});

test('a single-part model hides nothing', async ({ page }) => {
  await openHarness(page);

  // No selector means no other piece to scope against; every slider stays.
  const hidden = await page.evaluate(
    (source) => window.__harness.hiddenParams(source, { width: 60 }),
    TRAY,
  );
  expect(hidden).toEqual([]);
});

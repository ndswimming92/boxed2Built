import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inferRoom,
  inferServiceType,
  resolveRoom,
  resolveServiceType,
} from '../../src/utils/galleryTaxonomy.ts';

test('detects service type from the title', () => {
  assert.equal(inferServiceType('TV Mounted Above Electric Fireplace in Spring Hill'), 'tv-mounting');
  assert.equal(inferServiceType('Electric Fireplace TV Stand Assembly in Spring Hill'), 'furniture-assembly');
  assert.equal(inferServiceType('Springfree Large Square Trampoline Assembly in Franklin'), 'outdoor');
  assert.equal(inferServiceType('Black Adirondack Chair Assembly in Thompson\'s Station'), 'outdoor');
  assert.equal(inferServiceType('Custom Corner Floating Shelves Install - Boxed2Built'), 'wall-install');
  assert.equal(inferServiceType('Garage Slatwall Panel Assembly in Spring Hill'), 'wall-install');
  assert.equal(inferServiceType('UPLIFT Parsons Standing Desk Assembly in Franklin, TN'), 'furniture-assembly');
});

test('detects room from the title', () => {
  assert.equal(inferRoom('Cradlewise Smart Bassinet Assembly in Columbia, TN'), 'nursery');
  assert.equal(inferRoom('West Elm Orb Base Oval Coffee Table Assembly in Franklin, TN'), 'living-room');
  assert.equal(inferRoom('HOSTACK 75-Inch Coffee Bar Hutch Cabinet Assembly in Spring Hill'), 'kitchen-dining');
  assert.equal(inferRoom('RedLemon 60" Farmhouse Desk with Hutch Assembly'), 'office');
  assert.equal(inferRoom('Lark Manor Farmhouse Murphy Bed Assembly in Franklin'), 'bedroom');
  assert.equal(inferRoom('Patio Rocking Chair Assembly in Spring Hill'), 'patio-yard');
  assert.equal(inferRoom('Heavy-Duty Storage Rack Assembly in Franklin'), 'garage');
  assert.equal(inferRoom('Something Unusual'), null);
});

test('a saved tag wins over detection, and unknown tags are ignored', () => {
  assert.equal(resolveServiceType('tv-mounting', 'Coffee Table Assembly'), 'tv-mounting');
  assert.equal(resolveServiceType('bogus', 'Coffee Table Assembly'), 'furniture-assembly');
  assert.equal(resolveServiceType(null, 'Trampoline Assembly'), 'outdoor');
  assert.equal(resolveRoom('garage', 'Coffee Table Assembly'), 'garage');
  assert.equal(resolveRoom(undefined, 'Nightstand Assembly'), 'bedroom');
});

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Eye, Loader2, RotateCcw } from 'lucide-react';
import type { Mesh as MeshData } from '../../lib/mesh/stl';

/**
 * Turntable preview of the compiled mesh, sitting on a scaled build plate so
 * the size of the thing is legible at a glance.
 *
 * The overhang view colours faces by how far past 45 degrees they lean, which is
 * the single most useful thing to look at before slicing — it shows *where* the
 * problem is, which a number in the report cannot.
 */

export interface ModelViewerHandle {
  /** Renders a PNG of the current view, used as the saved thumbnail. */
  capture: () => Promise<Blob | null>;
}

interface ModelViewerProps {
  mesh: MeshData | null;
  bedX: number;
  bedY: number;
  busy?: boolean;
}

const SURFACE = 0x2563eb;
const OVERHANG = 0xe11d48;
const NEAR_LIMIT = 0xf59e0b;

function buildGeometry(mesh: MeshData, overhangView: boolean): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
  geometry.computeVertexNormals();

  if (overhangView) {
    const colors = new Float32Array(mesh.triangleCount * 9);
    const normal = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const colour = new THREE.Color();

    for (let t = 0; t < mesh.triangleCount; t += 1) {
      const o = t * 9;
      a.fromArray(mesh.positions, o);
      b.fromArray(mesh.positions, o + 3);
      c.fromArray(mesh.positions, o + 6);
      normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();

      const deg = normal.z < 0 ? Math.asin(Math.min(1, -normal.z)) * (180 / Math.PI) : 0;
      colour.setHex(deg > 45 ? OVERHANG : deg > 35 ? NEAR_LIMIT : SURFACE);

      for (let v = 0; v < 3; v += 1) {
        colors[o + v * 3] = colour.r;
        colors[o + v * 3 + 1] = colour.g;
        colors[o + v * 3 + 2] = colour.b;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  return geometry;
}

const ModelViewer = React.forwardRef<ModelViewerHandle, ModelViewerProps>(
  ({ mesh, bedX, bedY, busy = false }, ref) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const [overhangView, setOverhangView] = useState(false);

    // Scene setup runs once; the mesh is swapped in and out separately so that
    // recompiling on a slider drag does not rebuild the whole renderer.
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return undefined;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8fafc);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
      camera.up.set(0, 0, 1);
      camera.position.set(180, -220, 160);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        // Required for toBlob() to see anything on most drivers.
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(1, -1, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-1, 1, 0.5);
      scene.add(fill);

      const grid = new THREE.GridHelper(Math.max(bedX, bedY), 16, 0xcbd5e1, 0xe2e8f0);
      grid.rotation.x = Math.PI / 2;
      grid.name = 'plate';
      scene.add(grid);

      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      controlsRef.current = controls;

      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const resize = () => {
        const { clientWidth, clientHeight } = mount;
        if (clientWidth === 0 || clientHeight === 0) return;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight, false);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
        rendererRef.current = null;
        sceneRef.current = null;
      };
    }, [bedX, bedY]);

    // Swap the mesh whenever the compile output or the colour mode changes.
    useEffect(() => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!scene || !camera || !controls) return;

      if (meshRef.current) {
        scene.remove(meshRef.current);
        meshRef.current.geometry.dispose();
        (meshRef.current.material as THREE.Material).dispose();
        meshRef.current = null;
      }
      if (!mesh) return;

      const geometry = buildGeometry(mesh, overhangView);
      const material = new THREE.MeshStandardMaterial({
        color: overhangView ? 0xffffff : SURFACE,
        vertexColors: overhangView,
        roughness: 0.65,
        metalness: 0.05,
        flatShading: false,
      });
      const object = new THREE.Mesh(geometry, material);
      scene.add(object);
      meshRef.current = object;

      // Frame the model rather than leaving it a speck or clipped off screen.
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (sphere) {
        const distance = (sphere.radius * 2.6) / Math.tan((camera.fov * Math.PI) / 360);
        const direction = new THREE.Vector3(0.7, -0.9, 0.65).normalize();
        camera.position.copy(sphere.center).addScaledVector(direction, Math.max(distance, 60));
        controls.target.copy(sphere.center);
        camera.near = Math.max(0.1, distance / 100);
        camera.far = distance * 10;
        camera.updateProjectionMatrix();
        controls.update();
      }
    }, [mesh, overhangView]);

    const resetView = useCallback(() => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const geometry = meshRef.current?.geometry;
      if (!camera || !controls || !geometry) return;
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (!sphere) return;
      const distance = (sphere.radius * 2.6) / Math.tan((camera.fov * Math.PI) / 360);
      camera.position
        .copy(sphere.center)
        .addScaledVector(new THREE.Vector3(0.7, -0.9, 0.65).normalize(), Math.max(distance, 60));
      controls.target.copy(sphere.center);
      controls.update();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        capture: () =>
          new Promise<Blob | null>((resolve) => {
            const renderer = rendererRef.current;
            const scene = sceneRef.current;
            const camera = cameraRef.current;
            if (!renderer || !scene || !camera) {
              resolve(null);
              return;
            }
            // Force a fresh frame so the buffer matches what is on screen.
            renderer.render(scene, camera);
            renderer.domElement.toBlob((blob) => resolve(blob), 'image/png');
          }),
      }),
      [],
    );

    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div ref={mountRef} className="h-full w-full" />

        {!mesh && !busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Eye className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">Nothing to preview yet</p>
            <p className="text-xs">Describe a part and generate it to see the model here.</p>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/80">
            <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
            <p className="text-sm font-medium text-slate-600">Compiling…</p>
          </div>
        )}

        {mesh && (
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOverhangView((value) => !value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                overhangView
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
              title="Colour faces by overhang angle"
            >
              Overhangs
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-lg bg-white px-2 py-1.5 text-slate-700 shadow-sm transition hover:bg-slate-100"
              title="Reset view"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {mesh && overhangView && (
          <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> under 35°
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 35–45°
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> needs support
            </span>
          </div>
        )}
      </div>
    );
  },
);

ModelViewer.displayName = 'ModelViewer';

export default ModelViewer;

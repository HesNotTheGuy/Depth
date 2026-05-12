import JSZip from 'jszip';
import * as THREE from 'three';
import { useSceneStore, type SceneObjectInstance, type ObjectPreset } from '../store/useSceneStore';
import { captureCanvas } from './exportUtils';
import { downloadBlob } from './exportHelpers';

/** A single variation dimension the user has configured. */
export type VariationDimensionKind = 'color' | 'material' | 'object' | 'background';

export type MaterialPreset = SceneObjectInstance['material'];

export interface ColorDimension {
  kind: 'color';
  values: string[]; // hex strings
}
export interface MaterialDimension {
  kind: 'material';
  values: MaterialPreset[];
}
export interface ObjectDimension {
  kind: 'object';
  values: ObjectPreset[];
}
export interface BackgroundDimension {
  kind: 'background';
  /** data URLs (or null for "no background"). Labelled for filename safety. */
  values: { label: string; dataUrl: string | null }[];
}

export type VariationDimension =
  | ColorDimension
  | MaterialDimension
  | ObjectDimension
  | BackgroundDimension;

export interface BulkExportConfig {
  dimensions: VariationDimension[];
  filename: string;
  scale: number;
}

export interface BulkExportProgress {
  current: number;
  total: number;
  lastFilename: string | null;
}

export interface BulkExportHandle {
  /** Resolves when the export completes (success or cancellation). */
  promise: Promise<BulkExportResult>;
  /** Request that the running loop stop after the current frame. */
  cancel: () => void;
}

export interface BulkExportResult {
  exported: number;
  total: number;
  canceled: boolean;
  skipped: number;
}

/** Sanitize a value for use inside a filename. */
function sanitizeForFilename(s: string): string {
  return s
    .replace(/^#/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 40);
}

/** Number of variations a dimension contributes. */
export function dimensionCount(d: VariationDimension): number {
  return d.values.length;
}

/** Total exports = product of dimension counts. */
export function totalVariations(dims: VariationDimension[]): number {
  if (dims.length === 0) return 0;
  return dims.reduce((acc, d) => acc * dimensionCount(d), 1);
}

/**
 * Enumerate the cartesian product of dimension value indices.
 * Yields arrays of indices, one per input dimension.
 */
export function* cartesianIndices(dims: VariationDimension[]): Generator<number[]> {
  if (dims.length === 0) return;
  const sizes = dims.map(dimensionCount);
  if (sizes.some((n) => n === 0)) return;
  const idx = sizes.map(() => 0);
  while (true) {
    yield [...idx];
    // increment from rightmost
    let i = idx.length - 1;
    while (i >= 0) {
      idx[i]++;
      if (idx[i] < sizes[i]) break;
      idx[i] = 0;
      i--;
    }
    if (i < 0) return;
  }
}

/** A single combination represented as (dim, valueIndex) pairs plus a label suffix. */
export interface VariationCombo {
  parts: { kind: VariationDimensionKind; rawValue: string; label: string }[];
}

/** Build the filename suffix for a combination, e.g. "color-3b82f6-material-glossy". */
export function buildVariationSuffix(combo: VariationCombo): string {
  return combo.parts
    .map((p) => `${p.kind}-${sanitizeForFilename(p.label)}`)
    .join('-');
}

/** Build a VariationCombo from the cartesian index tuple. */
export function comboFromIndices(
  dims: VariationDimension[],
  indices: number[]
): VariationCombo {
  const parts: VariationCombo['parts'] = dims.map((d, i) => {
    const v = d.values[indices[i]];
    if (d.kind === 'color') {
      return { kind: 'color', rawValue: v as string, label: v as string };
    }
    if (d.kind === 'material') {
      return { kind: 'material', rawValue: v as string, label: v as string };
    }
    if (d.kind === 'object') {
      return { kind: 'object', rawValue: v as string, label: v as string };
    }
    const bg = v as BackgroundDimension['values'][number];
    return { kind: 'background', rawValue: bg.dataUrl ?? '', label: bg.label };
  });
  return { parts };
}

/** Snapshot of the relevant scene fields we mutate during bulk export. */
interface SceneSnapshot {
  backgroundImage: string | null;
  objects: SceneObjectInstance[];
  selectedObjectId: string | null;
}

function takeSnapshot(): SceneSnapshot {
  const s = useSceneStore.getState();
  return {
    backgroundImage: s.backgroundImage,
    // structured clone to detach references — variation mutations must not
    // leak into the original objects when we restore at the end.
    objects: structuredClone(s.objects),
    selectedObjectId: s.selectedObjectId,
  };
}

function restoreSnapshot(snap: SceneSnapshot): void {
  useSceneStore.setState({
    backgroundImage: snap.backgroundImage,
    objects: structuredClone(snap.objects),
    selectedObjectId: snap.selectedObjectId,
  });
}

/** Apply a variation combo to the scene. The selected object receives any color/material/object change. */
function applyCombo(combo: VariationCombo, baseObjects: SceneObjectInstance[], selectedId: string | null): void {
  // Compute mutated objects array (shallow patch on the selected object).
  let nextObjects = baseObjects;
  let nextBackground: string | null | undefined;
  // Find target object — selected if present, else first.
  const targetId = selectedId ?? baseObjects[0]?.id ?? null;

  for (const part of combo.parts) {
    if (part.kind === 'background') {
      nextBackground = part.rawValue || null;
      continue;
    }
    if (!targetId) continue;
    nextObjects = nextObjects.map((o) => {
      if (o.id !== targetId) return o;
      if (part.kind === 'color') return { ...o, color: part.rawValue };
      if (part.kind === 'material') {
        return { ...o, material: part.rawValue as MaterialPreset };
      }
      if (part.kind === 'object') {
        return { ...o, type: part.rawValue as ObjectPreset };
      }
      return o;
    });
  }

  const patch: Partial<{ objects: SceneObjectInstance[]; backgroundImage: string | null }> = {};
  if (nextObjects !== baseObjects) patch.objects = nextObjects;
  if (nextBackground !== undefined) patch.backgroundImage = nextBackground;
  if (Object.keys(patch).length > 0) {
    useSceneStore.setState(patch);
  }
}

/** Wait for the next animation frame so Three.js can apply state changes. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 16);
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}

export interface BulkExportDeps {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

/**
 * Run a bulk export. Iterates the cartesian product of variations, captures a
 * composite for each, and packs everything into a single zip download.
 *
 * Cancellation: the returned handle's `cancel()` aborts the loop after the
 * current frame; the partial zip is NOT downloaded and state is restored.
 */
export function runBulkExport(
  deps: BulkExportDeps,
  config: BulkExportConfig,
  onProgress: (p: BulkExportProgress) => void
): BulkExportHandle {
  let canceled = false;

  const promise = (async (): Promise<BulkExportResult> => {
    const { renderer, scene, camera } = deps;
    const snapshot = takeSnapshot();
    const baseObjects = snapshot.objects;
    const selectedId = snapshot.selectedObjectId;

    const total = totalVariations(config.dimensions);
    onProgress({ current: 0, total, lastFilename: null });

    if (total === 0) {
      return { exported: 0, total: 0, canceled: false, skipped: 0 };
    }

    const baseW = renderer.domElement.clientWidth;
    const baseH = renderer.domElement.clientHeight;
    const w = Math.round(baseW * config.scale);
    const h = Math.round(baseH * config.scale);

    const zip = new JSZip();
    let exported = 0;
    let skipped = 0;

    try {
      for (const indices of cartesianIndices(config.dimensions)) {
        if (canceled) break;

        const combo = comboFromIndices(config.dimensions, indices);

        // Skip combos whose background dataUrl is malformed (non-null but invalid).
        const bg = combo.parts.find((p) => p.kind === 'background');
        if (bg && bg.rawValue && !bg.rawValue.startsWith('data:') && !bg.rawValue.startsWith('http')) {
          console.warn('[depth] skipping variation with invalid background reference');
          skipped++;
          exported++;
          onProgress({ current: exported, total, lastFilename: null });
          continue;
        }

        applyCombo(combo, baseObjects, selectedId);
        // Let React + R3F apply the state change before we render.
        await nextFrame();
        if (canceled) break;

        const blob = await captureCanvas(renderer, scene, camera, w, h, 'png');
        const suffix = buildVariationSuffix(combo);
        const name = `depth-${config.filename}-${suffix}.png`;
        zip.file(name, blob);

        exported++;
        onProgress({ current: exported, total, lastFilename: name });
      }
    } finally {
      restoreSnapshot(snapshot);
    }

    if (canceled) {
      return { exported, total, canceled: true, skipped };
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `depth-${config.filename}-variations.zip`);
    return { exported, total, canceled: false, skipped };
  })();

  return {
    promise,
    cancel: () => {
      canceled = true;
    },
  };
}

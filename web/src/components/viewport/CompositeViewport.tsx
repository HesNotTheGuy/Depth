import { Suspense, useEffect, useCallback, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useUIStore } from '../../store/useUIStore';
import { useExportStore } from '../../store/useExportStore';
import { useHoverStore } from '../../store/useHoverStore';
import { SceneObjects } from './SceneObject';
import { AlignmentGuides } from './AlignmentGuides';
import { BackgroundPlane } from './BackgroundPlane';
import { SceneLights } from './SceneLights';
import { SurfaceDrawingOverlay } from './SurfaceDrawingOverlay';
import { Maximize2, Move3d, RotateCcw, Maximize } from 'lucide-react';

/** Face names for which we render real per-face textures (box / card). */
const BOX_FACE_NAMES = new Set(['right', 'left', 'top', 'bottom', 'front', 'back']);
const MAX_DROP_BYTES = 5 * 1024 * 1024;
const DROP_HINT_KEY = 'depth.viewport.dropHintDismissed';

function SceneLighting() {
  const brightness = useSceneStore((s) => s.brightness);
  const lightAngle = useSceneStore((s) => s.lightAngle);
  const lightElevation = useSceneStore((s) => s.lightElevation);
  const lightColor = useSceneStore((s) => s.lightColor);
  const shadowOpacity = useSceneStore((s) => s.shadowOpacity);
  const shadowSoftness = useSceneStore((s) => s.shadowSoftness);
  const shadowColor = useSceneStore((s) => s.shadowColor);
  const surfaces = useSceneStore((s) => s.surfaces);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => { invalidate(); }, [brightness, lightAngle, lightElevation, lightColor, shadowOpacity, shadowSoftness, shadowColor, surfaces, invalidate]);

  const dirRad = (lightAngle * Math.PI) / 180;
  const height = 2 + lightElevation * 6;
  const dist = 4;
  const lightPos: [number, number, number] = [
    Math.cos(dirRad) * dist,
    height,
    Math.sin(dirRad) * dist,
  ];

  const lowestSurfaceY = surfaces.length > 0
    ? Math.min(...surfaces.filter((s) => s.visible).map((s) => s.position.y), 0)
    : 0;
  const shadowY = lowestSurfaceY - 0.01;
  const blurRadius = 0.5 + shadowSoftness * 3.5;

  return (
    <>
      <ambientLight intensity={brightness * 0.35} color={lightColor} />
      <directionalLight
        position={lightPos}
        intensity={brightness * 1.5}
        color={lightColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <ContactShadows
        position={[0, shadowY, 0]}
        opacity={shadowOpacity}
        blur={blurRadius}
        color={shadowColor}
        far={4}
        resolution={512}
      />
      <FloorReflection groundY={shadowY} />
    </>
  );
}

/** Glossy mirror floor. Resolution and blur are the main perf knobs: 1024px
 *  resolution + low blur values can drop frame rate noticeably on integrated
 *  GPUs because MeshReflectorMaterial renders the scene into an off-screen
 *  target every frame. We sit the plane fractionally below the contact
 *  shadow Y so depth-fighting doesn't strobe. */
function FloorReflection({ groundY }: { groundY: number }) {
  const floorReflection = useSceneStore((s) => s.floorReflection);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, [floorReflection, groundY, invalidate]);
  if (!floorReflection.enabled) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY - 0.001, 0]}>
      <planeGeometry args={[20, 20]} />
      <MeshReflectorMaterial
        mirror={floorReflection.intensity}
        blur={[floorReflection.blur, floorReflection.blur]}
        resolution={floorReflection.resolution}
        color={floorReflection.color}
        roughness={floorReflection.roughness}
        metalness={0.5}
        mixBlur={1}
        mixStrength={1}
        depthScale={0.5}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
      />
    </mesh>
  );
}

/** Drei's <Environment> only supports its built-in preset names. Our store
 *  exposes 12 curated presets; the last two are stand-ins we render as
 *  'studio' (with tuned defaults already applied by setEnvironmentPreset). */
type DreiPreset = 'apartment' | 'city' | 'dawn' | 'forest' | 'lobby' | 'night' | 'park' | 'studio' | 'sunset' | 'warehouse';
function mapToDreiPreset(p: string): DreiPreset {
  switch (p) {
    case 'sunset': case 'dawn': case 'night': case 'warehouse':
    case 'forest': case 'apartment': case 'city': case 'park':
    case 'lobby': case 'studio':
      return p;
    // TODO: ship custom HDRIs for 'softbox' and 'window-light'.
    default:
      return 'studio';
  }
}

function HDRIEnvironment() {
  const useEnvironment = useSceneStore((s) => s.useEnvironment);
  const environmentPreset = useSceneStore((s) => s.environmentPreset);
  const environmentIntensity = useSceneStore((s) => s.environmentIntensity);
  const environmentRotation = useSceneStore((s) => s.environmentRotation);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => { invalidate(); }, [useEnvironment, environmentPreset, environmentIntensity, environmentRotation, invalidate]);

  if (!useEnvironment) return null;
  return (
    <Environment
      preset={mapToDreiPreset(environmentPreset)}
      environmentIntensity={environmentIntensity}
      environmentRotation={new THREE.Euler(0, (environmentRotation * Math.PI) / 180, 0)}
    />
  );
}

function ThreeRefCapture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setThreeRefs = useExportStore((s) => s.setThreeRefs);

  useEffect(() => {
    setThreeRefs(gl, scene, camera);
  }, [gl, scene, camera, setThreeRefs]);

  return null;
}

export function CompositeViewport() {
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  const scale = useSceneStore((s) => s.objects.find((o) => o.id === s.selectedObjectId)?.scale ?? 1);
  const updateObject = useSceneStore((s) => s.updateObject);
  const selectObject = useSceneStore((s) => s.selectObject);
  const setFaceTextureForSelected = useSceneStore((s) => s.setFaceTextureForSelected);
  const setScale = useCallback((v: number) => {
    if (selectedObjectId) updateObject(selectedObjectId, { scale: v });
  }, [selectedObjectId, updateObject]);
  const blendMode = useSceneStore((s) => s.blendMode);
  const backgroundImage = useSceneStore((s) => s.backgroundImage);
  const canvasZoom = useUIStore((s) => s.canvasZoom);
  const canvasPan = useUIStore((s) => s.canvasPan);
  const setCanvasZoom = useUIStore((s) => s.setCanvasZoom);
  const setCanvasPan = useUIStore((s) => s.setCanvasPan);
  const fitToScreen = useUIStore((s) => s.fitToScreen);
  const gizmoMode = useUIStore((s) => s.gizmoMode);
  const setGizmoMode = useUIStore((s) => s.setGizmoMode);
  const isPickingColor = useUIStore((s) => s.isPickingColor);
  const setPickingColor = useUIStore((s) => s.setPickingColor);
  const addRecentColor = useUIStore((s) => s.addRecentColor);
  const updateSelected = useSceneStore((s) => s.updateSelected);

  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Drag-and-drop image placement state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [flashTarget, setFlashTarget] = useState(false);
  const dragDepthRef = useRef(0);
  const [showDropHint, setShowDropHint] = useState(false);
  const dropHintShownRef = useRef(false);

  // Load image dimensions when background changes
  useEffect(() => {
    if (!backgroundImage) {
      setImageSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.width, h: img.height });
      // Auto-fit on first load
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = rect.width / img.width;
        const scaleY = rect.height / img.height;
        const fit = Math.min(scaleX, scaleY) * 0.95; // 95% to leave a small margin
        setCanvasZoom(fit);
        setCanvasPan({ x: 0, y: 0 });
      }
    };
    img.src = backgroundImage;
  }, [backgroundImage, setCanvasPan, setCanvasZoom]);

  // Keyboard shortcuts for gizmo mode (W/E/R)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'w' || e.key === 'W') setGizmoMode('translate');
      else if (e.key === 'e' || e.key === 'E') setGizmoMode('rotate');
      else if (e.key === 'r' || e.key === 'R') setGizmoMode('scale');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setGizmoMode]);

  // Wheel: Ctrl/Meta+Scroll = canvas zoom, Alt+Scroll = canvas zoom, plain Scroll = object scale
  // Zoom is anchored to the mouse position so the user can zoom toward a target area.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      if (!containerRef.current) return;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, canvasZoom * zoomFactor));
      const actualFactor = newZoom / canvasZoom;
      if (actualFactor === 1) return;

      // Mouse position relative to container center
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const mx = e.clientX - cx;
      const my = e.clientY - cy;

      // Keep the point under the mouse fixed while zooming.
      // New pan = (mouse - center) * (1 - r) + oldPan * r
      const newPanX = mx * (1 - actualFactor) + canvasPan.x * actualFactor;
      const newPanY = my * (1 - actualFactor) + canvasPan.y * actualFactor;

      setCanvasZoom(newZoom);
      setCanvasPan({ x: newPanX, y: newPanY });
    } else {
      // Plain scroll = object scale
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setScale(Math.max(0.1, Math.min(5, scale + delta)));
    }
  }, [scale, setScale, canvasZoom, canvasPan, setCanvasZoom, setCanvasPan]);

  // Middle mouse drag on empty space = pan canvas
  const handleContainerPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1) { // middle click
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: canvasPan.x, panY: canvasPan.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [canvasPan]);

  const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setCanvasPan({
      x: panStart.current.panX + dx,
      y: panStart.current.panY + dy,
    });
  }, [setCanvasPan]);

  const handleContainerPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Fit to screen handler
  const handleFit = useCallback(() => {
    if (!imageSize || !containerRef.current) { fitToScreen(); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / imageSize.w;
    const scaleY = rect.height / imageSize.h;
    const fit = Math.min(scaleX, scaleY) * 0.95;
    setCanvasZoom(fit);
    setCanvasPan({ x: 0, y: 0 });
  }, [imageSize, setCanvasZoom, setCanvasPan, fitToScreen]);

  // Auto-dismiss the toast after 2.5s
  useEffect(() => {
    if (!dropFeedback) return;
    const t = setTimeout(() => setDropFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [dropFeedback]);

  // Briefly flash the target ring after a successful drop
  useEffect(() => {
    if (!flashTarget) return;
    const t = setTimeout(() => setFlashTarget(false), 500);
    return () => clearTimeout(t);
  }, [flashTarget]);

  // One-time keyboard hint on first viewport hover
  const handleViewportEnter = useCallback(() => {
    if (dropHintShownRef.current) return;
    try {
      if (localStorage.getItem(DROP_HINT_KEY) === '1') {
        dropHintShownRef.current = true;
        return;
      }
    } catch { /* localStorage unavailable */ }
    dropHintShownRef.current = true;
    setShowDropHint(true);
    setTimeout(() => {
      setShowDropHint(false);
      try { localStorage.setItem(DROP_HINT_KEY, '1'); } catch { /* ignore */ }
    }, 4000);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0]; // Multi-file drop: take only the first; ignore the rest.
    if (!file.type.startsWith('image/')) {
      setDropFeedback({ message: 'Only image files are supported', type: 'error' });
      return;
    }
    if (file.size > MAX_DROP_BYTES) {
      setDropFeedback({ message: 'Image too large (max 5 MB)', type: 'error' });
      return;
    }

    // Resolve target: most-recent hover, else selected object, else nothing.
    const hover = useHoverStore.getState().latest;
    const sceneState = useSceneStore.getState();
    const targetId = hover?.objectId ?? sceneState.selectedObjectId;
    if (!targetId) {
      setDropFeedback({ message: 'Drop on an object or select one first', type: 'error' });
      return;
    }
    const targetObj = sceneState.objects.find((o) => o.id === targetId);
    if (!targetObj) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') return;

      // Decide face-texture vs global-texture.
      // Per-face textures only render for box/card (the multi-material path in
      // SceneObject). For other shapes we fall back to the global object texture.
      const face = hover?.face;
      const shapeSupportsPerFace = targetObj.type === 'box' || targetObj.type === 'card';
      const isNamedFace = face != null && BOX_FACE_NAMES.has(face);

      if (shapeSupportsPerFace && isNamedFace) {
        // setFaceTextureForSelected operates on the selected object; ensure that.
        if (sceneState.selectedObjectId !== targetId) selectObject(targetId);
        setFaceTextureForSelected(face, dataUrl);
        setDropFeedback({ message: `Applied image to ${targetObj.name} (${face} face)`, type: 'success' });
      } else {
        updateObject(targetId, { texture: dataUrl });
        const where = face && face !== 'all' ? ` (${face})` : '';
        setDropFeedback({ message: `Applied image to ${targetObj.name}${where}`, type: 'success' });
      }
      setFlashTarget(true);
    };
    reader.onerror = () => {
      setDropFeedback({ message: 'Failed to read image file', type: 'error' });
    };
    reader.readAsDataURL(file);
  }, [selectObject, setFaceTextureForSelected, updateObject]);

  // Reset color-picker canvas cache when the background image changes.
  useEffect(() => {
    clearColorPickerCache();
  }, [backgroundImage]);

  // Escape cancels the eyedropper picking mode.
  useEffect(() => {
    if (!isPickingColor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickingColor(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPickingColor, setPickingColor]);

  // Click handler for the fallback overlay: project the screen click back to
  // background-image coordinates (accounting for zoom/pan/letterboxing) and
  // sample the pixel via an offscreen canvas.
  const handlePickerClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!backgroundImage || !containerRef.current || !imageSize) {
      setPickingColor(false);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    // The inner image-bearing div is centered then translated by canvasPan then scaled.
    const centerX = rect.left + rect.width / 2 + canvasPan.x;
    const centerY = rect.top + rect.height / 2 + canvasPan.y;
    // Screen offset from that center, in screen pixels.
    const sx = e.clientX - centerX;
    const sy = e.clientY - centerY;
    // Undo zoom -> image-space offset from image center.
    const ix = sx / canvasZoom + imageSize.w / 2;
    const iy = sy / canvasZoom + imageSize.h / 2;
    if (ix < 0 || iy < 0 || ix >= imageSize.w || iy >= imageSize.h) {
      // Outside image bounds: cancel without applying.
      setPickingColor(false);
      return;
    }
    try {
      const hex = await pickColorFromImage(backgroundImage, ix, iy);
      updateSelected({ color: hex });
      addRecentColor(hex);
    } catch {
      // sampling failed — silently exit
    } finally {
      setPickingColor(false);
    }
  }, [backgroundImage, imageSize, canvasZoom, canvasPan, setPickingColor, updateSelected, addRecentColor]);

  const isBlended = blendMode !== 'normal';

  // Canvas dimensions: either match image or fill viewport
  const canvasW = imageSize ? imageSize.w : undefined;
  const canvasH = imageSize ? imageSize.h : undefined;

  const zoomPercent = Math.round(canvasZoom * 100);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-surface overflow-hidden"
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerEnter={handleViewportEnter}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Checkerboard background to indicate canvas bounds */}
      <div
        className="absolute"
        style={{
          width: canvasW ?? '100%',
          height: canvasH ?? '100%',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Blend mode: background image as HTML element */}
        {isBlended && backgroundImage && (
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        <Canvas
          shadows
          frameloop="demand"
          gl={{
            preserveDrawingBuffer: true,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          camera={{ position: [0, 0.5, 4], fov: 45, near: 0.1, far: 50 }}
          style={{
            width: '100%',
            height: '100%',
            mixBlendMode: isBlended ? blendMode : undefined,
          }}
        >
          <ThreeRefCapture />
          <Suspense fallback={null}>
            <BackgroundPlane />
            <SceneLighting />
            <SceneLights />
            <SceneObjects />
            <AlignmentGuides />
          </Suspense>
          <Suspense fallback={null}>
            <HDRIEnvironment />
          </Suspense>
        </Canvas>

        {/* Surface drawing overlay */}
        <SurfaceDrawingOverlay />
      </div>

      {/* Transform gizmo toolbar (top-left) */}
      {selectedObjectId && (
        <div className="absolute top-3 left-3 flex items-center gap-1 pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-md p-1">
          {([
            { mode: 'translate' as const, Icon: Move3d, label: 'Translate (W)' },
            { mode: 'rotate' as const, Icon: RotateCcw, label: 'Rotate (E)' },
            { mode: 'scale' as const, Icon: Maximize, label: 'Scale (R)' },
          ]).map(({ mode, Icon, label }) => {
            const active = gizmoMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setGizmoMode(mode)}
                title={label}
                className={`p-1.5 rounded transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-auto">
        <button
          onClick={handleFit}
          className="bg-black/60 backdrop-blur-md text-white/70 hover:text-white px-2 py-1 rounded-md text-[10px] font-medium border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1"
          title="Fit to screen"
        >
          <Maximize2 size={10} />
          Fit
        </button>
        <div className="bg-black/60 backdrop-blur-md text-white/60 text-[10px] px-2 py-1 rounded-md border border-white/5 tabular-nums font-mono">
          {zoomPercent}%
        </div>
      </div>

      {/* Hint overlay */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md text-white/60 text-[10px] px-3 py-1.5 rounded-lg border border-white/5">
          Left drag to move &middot; Right drag to rotate &middot; Ctrl+Scroll to zoom &middot; Scroll to scale
        </div>
      </div>

      {/* Drag-over indicator: inset primary border + centered label */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
          isDraggingFile ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!isDraggingFile}
      >
        <div className="absolute inset-2 border-2 border-dashed border-primary rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/70 backdrop-blur-md text-white text-sm font-medium px-4 py-2 rounded-lg border border-primary/60 shadow-lg">
            Drop image to apply
          </div>
        </div>
      </div>

      {/* Post-drop confirmation flash ring */}
      <div
        className={`absolute inset-2 rounded-lg pointer-events-none transition-opacity duration-300 border-2 border-green-400 ${
          flashTarget ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!flashTarget}
      />

      {/* Toast feedback */}
      {dropFeedback && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none">
          <div
            className={`px-4 py-2 rounded-lg text-xs font-medium backdrop-blur-md border shadow-lg ${
              dropFeedback.type === 'success'
                ? 'bg-green-500/20 border-green-400/40 text-green-100'
                : 'bg-red-500/20 border-red-400/40 text-red-100'
            }`}
          >
            {dropFeedback.message}
          </div>
        </div>
      )}

      {/* Eyedropper fallback overlay: captures the next click for color sampling */}
      {isPickingColor && (
        <>
          <div
            onClick={handlePickerClick}
            onContextMenu={(e) => { e.preventDefault(); setPickingColor(false); }}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40"
            style={{ cursor: 'crosshair' }}
            role="presentation"
          />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
            <div className="bg-black/80 backdrop-blur-md text-white/90 text-[11px] px-3 py-1.5 rounded-lg border border-primary/40 shadow-lg flex items-center gap-2">
              <Pipette size={12} className="text-primary" />
              <span>Click anywhere on the background to pick a color. Press Escape to cancel.</span>
            </div>
          </div>
        </>
      )}

      {/* One-time keyboard / drop hint */}
      {showDropHint && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none animate-in fade-in duration-200">
          <div className="bg-black/70 backdrop-blur-md text-white/90 text-[11px] px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
            Tip: drag a logo image directly onto an object
          </div>
        </div>
      )}
    </div>
  );
}

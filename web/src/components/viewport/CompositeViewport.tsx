import { Suspense, useEffect, useCallback, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { useUIStore } from '../../store/useUIStore';
import { useExportStore } from '../../store/useExportStore';
import { SceneObject } from './SceneObject';
import { BackgroundPlane } from './BackgroundPlane';
import { SceneLights } from './SceneLights';
import { SurfaceDrawingOverlay } from './SurfaceDrawingOverlay';
import { Maximize2 } from 'lucide-react';

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
    </>
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
  const scale = useSceneStore((s) => s.objectScale);
  const setScale = useSceneStore((s) => s.setObjectScale);
  const blendMode = useSceneStore((s) => s.blendMode);
  const backgroundImage = useSceneStore((s) => s.backgroundImage);
  const canvasZoom = useUIStore((s) => s.canvasZoom);
  const canvasPan = useUIStore((s) => s.canvasPan);
  const setCanvasZoom = useUIStore((s) => s.setCanvasZoom);
  const setCanvasPan = useUIStore((s) => s.setCanvasPan);
  const fitToScreen = useUIStore((s) => s.fitToScreen);

  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Load image dimensions when background changes
  useEffect(() => {
    if (!backgroundImage) { setImageSize(null); return; }
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
  }, [backgroundImage]);

  // Wheel: Ctrl/Meta+Scroll = canvas zoom, Alt+Scroll = canvas zoom, plain Scroll = object scale
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Canvas zoom (Adobe-style)
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setCanvasZoom(canvasZoom * zoomFactor);
    } else {
      // Object scale
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setScale(Math.max(0.1, Math.min(5, scale + delta)));
    }
  }, [scale, setScale, canvasZoom, setCanvasZoom]);

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
            <SceneObject />
          </Suspense>
          <Suspense fallback={null}>
            <Environment preset="studio" environmentIntensity={0.3} />
          </Suspense>
        </Canvas>

        {/* Surface drawing overlay */}
        <SurfaceDrawingOverlay />
      </div>

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
    </div>
  );
}

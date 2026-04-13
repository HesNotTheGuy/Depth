import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { SceneObject } from './SceneObject';
import { SurfacePlanes } from './SurfacePlanes';
import { SurfaceDrawingOverlay } from './SurfaceDrawingOverlay';

function SceneLighting() {
  const brightness = useSceneStore((s) => s.brightness);
  const lightAngle = useSceneStore((s) => s.lightAngle);
  const lightElevation = useSceneStore((s) => s.lightElevation);
  const lightColor = useSceneStore((s) => s.lightColor);
  const shadowOpacity = useSceneStore((s) => s.shadowOpacity);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => { invalidate(); });

  const dirRad = (lightAngle * Math.PI) / 180;
  const height = 2 + lightElevation * 6;
  const dist = 4;
  const lightPos: [number, number, number] = [
    Math.cos(dirRad) * dist,
    height,
    Math.sin(dirRad) * dist,
  ];

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
        position={[0, -0.01, 0]}
        opacity={shadowOpacity}
        blur={2}
        far={4}
        resolution={512}
      />
    </>
  );
}

export function CompositeViewport() {
  const backgroundImage = useSceneStore((s) => s.backgroundImage);

  return (
    <div className="flex-1 relative bg-surface">
      {/* Background image layer */}
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      {/* 3D canvas layer */}
      <Canvas
        shadows
        frameloop="demand"
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [2, 1.5, 2], fov: 45, near: 0.1, far: 50 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <SceneLighting />
          <SceneObject />
          <SurfacePlanes />
          <OrbitControls enablePan enableZoom makeDefault minDistance={1} maxDistance={10} />
        </Suspense>
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={0.3} />
        </Suspense>
      </Canvas>

      {/* Surface drawing overlay */}
      <SurfaceDrawingOverlay />

      {/* Hint overlay */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md text-white/60 text-[10px] px-3 py-1.5 rounded-lg border border-white/5">
          Drag to orbit &middot; Scroll to zoom &middot; Middle-click to pan
        </div>
      </div>
    </div>
  );
}

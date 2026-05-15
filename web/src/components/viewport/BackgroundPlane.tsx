import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * Renders the background image as a 3D plane inside the scene,
 * always positioned behind the scene from the camera's perspective.
 *
 * This lets meshPhysicalMaterial's transmission/IOR refract the
 * background through glass objects. The plane always faces the camera
 * and fills the viewport so it looks identical to a CSS background.
 */
export function BackgroundPlane() {
  const backgroundImage = useSceneStore((s) => s.backgroundImage);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Load texture asynchronously. Dispose any previously-loaded texture when
  // the source changes or the component unmounts, otherwise swapping
  // background images leaks the old image's GPU texture.
  useEffect(() => {
    if (!backgroundImage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear + dispose when input becomes null
      setTexture((prev) => { prev?.dispose(); return null; });
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(backgroundImage, (tex) => {
      if (cancelled) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture((prev) => { prev?.dispose(); return tex; });
      invalidate();
    });
    return () => { cancelled = true; };
  }, [backgroundImage, invalidate]);

  // Unmount cleanup — dispose whatever's currently loaded. Sync the ref
  // inside an effect (not during render) so we don't violate the React
  // rules-of-refs lint.
  const textureRef = useRef<THREE.Texture | null>(null);
  useEffect(() => { textureRef.current = texture; }, [texture]);
  useEffect(() => {
    return () => { textureRef.current?.dispose(); };
  }, []);

  // Position the plane to fill the camera frustum, always facing camera
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !texture?.image) return;

    const depth = 20;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const aspect = size.width / size.height;

    // Visible area at the plane's distance from camera
    const vFov = (fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * depth;
    const visibleWidth = visibleHeight * aspect;

    // object-cover: scale to fill without letterboxing
    const img = texture.image as HTMLImageElement;
    const imgAspect = img.width / img.height;
    const planeAspect = visibleWidth / visibleHeight;
    let w = visibleWidth;
    let h = visibleHeight;
    if (imgAspect > planeAspect) {
      w = visibleHeight * imgAspect;
    } else {
      h = visibleWidth / imgAspect;
    }

    // Place plane at 'depth' distance along camera's look direction
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().add(dir.multiplyScalar(depth));

    mesh.position.copy(pos);
    mesh.lookAt(camera.position);
    mesh.scale.set(w, h, 1);

    invalidate();
  }, [texture, camera, size, invalidate]);

  if (!texture) return null;

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

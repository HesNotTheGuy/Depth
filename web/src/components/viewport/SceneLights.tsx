import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * Renders user-positionable point lights in the 3D scene.
 * These are independent of the object — moving a light does not move the object.
 */
export function SceneLights() {
  const sceneLights = useSceneStore((s) => s.sceneLights);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
  }, [sceneLights, invalidate]);

  return (
    <>
      {sceneLights.map((light) => {
        if (!light.visible) return null;
        return (
          <group key={light.id}>
            <pointLight
              position={[light.position.x, light.position.y, light.position.z]}
              color={light.color}
              intensity={light.intensity}
              distance={20}
              decay={2}
              castShadow
              shadow-mapSize-width={512}
              shadow-mapSize-height={512}
            />
            {/* Small visible sphere to show light position */}
            <mesh position={[light.position.x, light.position.y, light.position.z]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color={light.color} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

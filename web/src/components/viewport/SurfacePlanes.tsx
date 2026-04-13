import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

export function SurfacePlanes() {
  const surfaces = useSceneStore((s) => s.surfaces);

  return (
    <>
      {surfaces.map((surface) => {
        if (!surface.visible) return null;
        return (
          <mesh
            key={surface.id}
            position={[surface.position.x, surface.position.y, surface.position.z]}
            rotation={[surface.rotation.x, surface.rotation.y, surface.rotation.z]}
            receiveShadow
          >
            <planeGeometry args={[surface.size.width, surface.size.depth]} />
            <meshStandardMaterial
              color={surface.color}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

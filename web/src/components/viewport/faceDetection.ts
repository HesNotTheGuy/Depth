import * as THREE from 'three';

/**
 * Map a BoxGeometry faceIndex (triangle index) to a named face.
 * BoxGeometry generates 6 faces of 2 triangles each, in order:
 * group 0: +X (right), group 1: -X (left), group 2: +Y (top),
 * group 3: -Y (bottom), group 4: +Z (front), group 5: -Z (back)
 */
export const BOX_FACE_NAMES = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;

export function faceIndexToBoxFace(faceIndex: number): string {
  const groupIndex = Math.floor(faceIndex / 2);
  return BOX_FACE_NAMES[groupIndex] ?? 'front';
}

export function faceIndexToCylindricalPart(faceIndex: number, geometry: THREE.BufferGeometry): string {
  const groups = geometry.groups;
  if (groups.length > 0) {
    for (const group of groups) {
      const startTri = group.start / 3;
      const endTri = startTri + group.count / 3;
      if (faceIndex >= startTri && faceIndex < endTri) {
        return `group_${group.materialIndex}`;
      }
    }
  }
  const index = geometry.index;
  const totalTriangles = index ? index.count / 3 : 0;
  if (totalTriangles > 0 && faceIndex >= totalTriangles - 64) {
    return faceIndex >= totalTriangles - 32 ? 'bottom' : 'top';
  }
  return 'body';
}

export function detectFace(objectType: string, faceIndex: number, geometry: THREE.BufferGeometry): string {
  switch (objectType) {
    case 'box':
    case 'card':
      return faceIndexToBoxFace(faceIndex);
    case 'phone':
      return faceIndex < 2 ? 'front' : faceIndex < 4 ? 'back' : 'sides';
    case 'mug':
    case 'bottle':
    case 'cylinder':
      return faceIndexToCylindricalPart(faceIndex, geometry);
    default:
      return 'all';
  }
}

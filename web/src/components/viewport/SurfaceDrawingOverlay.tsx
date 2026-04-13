import { useCallback, useRef, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSceneStore, type Point2D, type SurfacePlane } from '../../store/useSceneStore';
import { cornersTo3DPlane } from '../../utils/surfaceUtils';

export function SurfaceDrawingOverlay() {
  const isDrawing = useUIStore((s) => s.isDrawing);
  const drawingPoints = useUIStore((s) => s.drawingPoints);
  const addDrawingPoint = useUIStore((s) => s.addDrawingPoint);
  const finishDrawing = useUIStore((s) => s.finishDrawing);
  const cancelDrawing = useUIStore((s) => s.cancelDrawing);
  const addSurface = useSceneStore((s) => s.addSurface);
  const surfaces = useSceneStore((s) => s.surfaces);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<Point2D | null>(null);

  const getNormalized = useCallback(
    (e: React.MouseEvent): Point2D | null => {
      const el = overlayRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      e.stopPropagation();
      const pt = getNormalized(e);
      if (!pt) return;

      const newPoints = [...drawingPoints, pt];
      addDrawingPoint(pt);

      // When we have 4 points, create the surface
      if (newPoints.length === 4) {
        const corners = newPoints as [Point2D, Point2D, Point2D, Point2D];
        const plane3D = cornersTo3DPlane(corners);
        const surface: SurfacePlane = {
          id: crypto.randomUUID(),
          name: `Surface ${surfaces.length + 1}`,
          corners,
          ...plane3D,
          visible: true,
          color: SURFACE_COLORS[surfaces.length % SURFACE_COLORS.length],
        };
        addSurface(surface);
        finishDrawing();
      }
    },
    [isDrawing, drawingPoints, addDrawingPoint, addSurface, finishDrawing, getNormalized, surfaces.length]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      setMousePos(getNormalized(e));
    },
    [isDrawing, getNormalized]
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      cancelDrawing();
    },
    [isDrawing, cancelDrawing]
  );

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: isDrawing ? 'auto' : 'none' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onContextMenu={handleRightClick}
    >
      {/* SVG overlay for drawing */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        {/* Existing surfaces as outlines */}
        {surfaces
          .filter((s) => s.visible)
          .map((surface) => (
            <SurfaceOutline key={surface.id} surface={surface} />
          ))}

        {/* Current drawing in progress */}
        {isDrawing && drawingPoints.length > 0 && (
          <DrawingPreview points={drawingPoints} mousePos={mousePos} />
        )}
      </svg>

      {/* Drawing mode HUD */}
      {isDrawing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-surface-raised/90 backdrop-blur-md border border-primary/20 text-text-primary text-xs px-4 py-2.5 rounded-xl shadow-2xl shadow-black/30 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {drawingPoints.length + 1}
            </div>
            <span className="text-text-secondary">
              Click to place corner <span className="text-primary font-semibold">{drawingPoints.length + 1}</span> of 4
            </span>
            <span className="text-white/10">|</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                cancelDrawing();
              }}
              className="text-text-muted hover:text-danger text-[10px] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Crosshair cursor when drawing */}
      {isDrawing && (
        <style>{`
          .z-10 { cursor: crosshair !important; }
        `}</style>
      )}
    </div>
  );
}

function SurfaceOutline({ surface }: { surface: SurfacePlane }) {
  const c = surface.corners;
  const points = c.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(' ');

  return (
    <g>
      <polygon
        points={points}
        fill={surface.color}
        fillOpacity={0.15}
        stroke={surface.color}
        strokeWidth={2}
        strokeDasharray="6 3"
        vectorEffect="non-scaling-stroke"
      />
      {c.map((p, i) => (
        <circle
          key={i}
          cx={`${p.x * 100}%`}
          cy={`${p.y * 100}%`}
          r={4}
          fill={surface.color}
          stroke="white"
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}

function DrawingPreview({
  points,
  mousePos,
}: {
  points: Point2D[];
  mousePos: Point2D | null;
}) {
  const allPoints = mousePos ? [...points, mousePos] : points;

  return (
    <g>
      {/* Lines between placed points */}
      {allPoints.map((p, i) => {
        if (i === 0) return null;
        const prev = allPoints[i - 1];
        return (
          <line
            key={i}
            x1={`${prev.x * 100}%`}
            y1={`${prev.y * 100}%`}
            x2={`${p.x * 100}%`}
            y2={`${p.y * 100}%`}
            stroke="#6C63FF"
            strokeWidth={2}
            strokeDasharray={i >= points.length ? '4 4' : 'none'}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {/* Close the shape preview when we have 3+ points */}
      {allPoints.length >= 3 && (
        <line
          x1={`${allPoints[allPoints.length - 1].x * 100}%`}
          y1={`${allPoints[allPoints.length - 1].y * 100}%`}
          x2={`${allPoints[0].x * 100}%`}
          y2={`${allPoints[0].y * 100}%`}
          stroke="#6C63FF"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          opacity={0.5}
        />
      )}
      {/* Filled preview */}
      {allPoints.length >= 3 && (
        <polygon
          points={allPoints.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
          fill="#6C63FF"
          fillOpacity={0.1}
        />
      )}
      {/* Corner dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={`${p.x * 100}%`}
          cy={`${p.y * 100}%`}
          r={5}
          fill="#6C63FF"
          stroke="white"
          strokeWidth={2}
        />
      ))}
      {/* Mouse position dot */}
      {mousePos && (
        <circle
          cx={`${mousePos.x * 100}%`}
          cy={`${mousePos.y * 100}%`}
          r={4}
          fill="white"
          stroke="#6C63FF"
          strokeWidth={2}
          opacity={0.8}
        />
      )}
    </g>
  );
}

const SURFACE_COLORS = [
  '#6C63FF',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#A78BFA',
  '#F97316',
];

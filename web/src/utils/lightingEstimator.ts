export interface DetectedLight {
  /** Normalized image position (0-1) of the bright spot center */
  x: number;
  y: number;
  /** Relative intensity of the detected spot (0-1) */
  intensity: number;
  /** Hex color of the bright spot */
  color: string;
  /** Approximate radius in normalized coords */
  radius: number;
}

export interface EstimatedLighting {
  brightness: number;       // 0–2 scale
  colorTemp: string;        // hex color of dominant light
  lightAngle: number;       // degrees, 0–360
  lightElevation: number;   // 0–1, how high the light source is
  ambientColor: string;     // hex, average color for ambient fill
  contrast: number;         // 0–1, shadow hardness hint
  detectedLights: DetectedLight[];  // bright spots found in the image
}

/**
 * Analyze an image to estimate scene lighting.
 * Samples the image in quadrants to guess light direction,
 * and uses overall luminance/color for brightness and temp.
 */
export function estimateLighting(imageDataUrl: string): Promise<EstimatedLighting> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 128; // downsample for speed
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      // Compute per-quadrant average luminance to estimate light direction
      const quadrants = [
        { x0: 0, y0: 0, x1: size / 2, y1: size / 2, label: 'topLeft' },
        { x0: size / 2, y0: 0, x1: size, y1: size / 2, label: 'topRight' },
        { x0: 0, y0: size / 2, x1: size / 2, y1: size, label: 'bottomLeft' },
        { x0: size / 2, y0: size / 2, x1: size, y1: size, label: 'bottomRight' },
      ];

      const quadLum: Record<string, number> = {};
      let totalR = 0, totalG = 0, totalB = 0;
      let totalLum = 0;
      let minLum = 255, maxLum = 0;
      let pixelCount = 0;

      for (const q of quadrants) {
        let lumSum = 0;
        let count = 0;
        for (let y = q.y0; y < q.y1; y++) {
          for (let x = q.x0; x < q.x1; x++) {
            const i = (y * size + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            lumSum += lum;
            count++;

            totalR += r;
            totalG += g;
            totalB += b;
            totalLum += lum;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
            pixelCount++;
          }
        }
        quadLum[q.label] = lumSum / count;
      }

      // Light direction: brightest quadrant indicates where light comes from
      const leftLum = (quadLum.topLeft + quadLum.bottomLeft) / 2;
      const rightLum = (quadLum.topRight + quadLum.bottomRight) / 2;
      const topLum = (quadLum.topLeft + quadLum.topRight) / 2;
      const bottomLum = (quadLum.bottomLeft + quadLum.bottomRight) / 2;

      // Angle: 0=right, 90=top, 180=left, 270=bottom (screen coords)
      const dx = rightLum - leftLum;
      const dy = topLum - bottomLum;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;

      // Elevation: if top is much brighter, light is high
      const elevation = Math.min(1, Math.max(0, (topLum - bottomLum) / 128 + 0.5));

      // Average color
      const avgR = Math.round(totalR / pixelCount);
      const avgG = Math.round(totalG / pixelCount);
      const avgB = Math.round(totalB / pixelCount);
      const ambientColor = rgbToHex(avgR, avgG, avgB);

      // Color temperature: warm/cool bias
      const warmth = (avgR - avgB) / 255;
      const tempR = Math.round(Math.min(255, 200 + warmth * 55));
      const tempG = Math.round(Math.min(255, 190 + warmth * 30));
      const tempB = Math.round(Math.min(255, 180 - warmth * 40));
      const colorTemp = rgbToHex(tempR, tempG, tempB);

      // Brightness: overall luminance mapped to 0–2
      const avgLum = totalLum / pixelCount;
      const brightness = Math.min(2, Math.max(0.2, (avgLum / 128) * 1.0));

      // Contrast: range of luminance
      const contrast = Math.min(1, (maxLum - minLum) / 255);

      // Detect bright spots (potential light sources) via luma threshold
      const detectedLights = detectBrightSpots(data, size);

      resolve({
        brightness,
        colorTemp,
        lightAngle: Math.round(angle),
        lightElevation: elevation,
        ambientColor,
        contrast,
        detectedLights,
      });
    };
    img.src = imageDataUrl;
  });
}

/**
 * Detect bright spots in the image that likely represent light sources.
 * Uses a luma threshold + simple flood-fill clustering to find distinct
 * bright regions and return their center, color, and intensity.
 */
function detectBrightSpots(data: Uint8ClampedArray, size: number): DetectedLight[] {
  // Build luminance map
  const lum = new Float32Array(size * size);
  let maxLum = 0;
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    lum[i] = l;
    if (l > maxLum) maxLum = l;
  }

  // Threshold: pixels above 85% of max luminance are "bright"
  const threshold = maxLum * 0.85;
  if (maxLum < 100) return []; // image is too dark for meaningful detection

  const visited = new Uint8Array(size * size);
  const spots: DetectedLight[] = [];

  // Simple flood-fill to cluster bright pixels
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (visited[idx] || lum[idx] < threshold) continue;

      // BFS flood fill
      const queue = [{ x, y }];
      visited[idx] = 1;
      let sumX = 0, sumY = 0, sumR = 0, sumG = 0, sumB = 0, sumLum = 0;
      let count = 0;
      let minX = x, maxX = x, minY = y, maxY = y;

      while (queue.length > 0) {
        const p = queue.shift()!;
        const pi = p.y * size + p.x;
        const di = pi * 4;

        sumX += p.x;
        sumY += p.y;
        sumR += data[di];
        sumG += data[di + 1];
        sumB += data[di + 2];
        sumLum += lum[pi];
        count++;
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;

        // Check 4-connected neighbors
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = p.x + dx, ny = p.y + dy;
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const ni = ny * size + nx;
          if (visited[ni] || lum[ni] < threshold) continue;
          visited[ni] = 1;
          queue.push({ x: nx, y: ny });
        }
      }

      // Only keep clusters with at least 4 pixels (filter noise)
      if (count < 4) continue;

      const cx = sumX / count / size;
      const cy = sumY / count / size;
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      const avgLum = sumLum / count;
      const radius = Math.max(maxX - minX, maxY - minY) / size / 2;

      spots.push({
        x: cx,
        y: cy,
        intensity: avgLum / 255,
        color: rgbToHex(avgR, avgG, avgB),
        radius: Math.max(0.02, radius),
      });
    }
  }

  // Sort by intensity descending, keep top 4
  spots.sort((a, b) => b.intensity - a.intensity);
  return spots.slice(0, 4);
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

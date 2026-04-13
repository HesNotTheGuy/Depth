import { useCallback, useState } from 'react';
import { Upload, ArrowRight } from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';
import { useUIStore } from '../store/useUIStore';
import { estimateLighting } from '../utils/lightingEstimator';

export function UploadScreen() {
  const setBackgroundImage = useSceneStore((s) => s.setBackgroundImage);
  const setEstimatedLighting = useSceneStore((s) => s.setEstimatedLighting);
  const setStep = useUIStore((s) => s.setStep);
  const isAnalyzing = useUIStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useUIStore((s) => s.setIsAnalyzing);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        setBackgroundImage(dataUrl);
        setIsAnalyzing(true);

        const lighting = await estimateLighting(dataUrl);
        setEstimatedLighting(lighting);
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    },
    [setBackgroundImage, setEstimatedLighting, setIsAnalyzing]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          <span className="text-primary">DEPTH</span>
        </h1>
        <p className="text-text-secondary text-lg">
          Drop in a photo, place a 3D object, match the lighting.
        </p>
      </div>

      {!preview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`w-full max-w-lg aspect-[4/3] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary/50 hover:bg-gray-100'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload size={28} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium text-text-primary">Drop your base image here</p>
            <p className="text-sm text-text-muted mt-1">
              or click to browse — PNG, JPG, WebP
            </p>
          </div>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      ) : (
        <div className="w-full max-w-lg">
          <div className="relative rounded-2xl overflow-hidden border border-panel-border shadow-sm">
            <img
              src={preview}
              alt="Uploaded base image"
              className="w-full aspect-[4/3] object-cover"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="bg-white rounded-xl px-5 py-3 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-text-primary">
                    Analyzing lighting...
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setPreview(null);
                setBackgroundImage(null);
                setEstimatedLighting(null);
              }}
              className="flex-1 py-2.5 border border-panel-border rounded-xl text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Choose different image
            </button>
            <button
              onClick={() => setStep('editor')}
              disabled={isAnalyzing}
              className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted mt-8 max-w-md text-center">
        Your image is analyzed locally in your browser to estimate lighting direction,
        color temperature, and brightness. Nothing is uploaded to any server.
      </p>
    </div>
  );
}

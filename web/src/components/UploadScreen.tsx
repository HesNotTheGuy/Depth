import { useCallback, useState } from 'react';
import { Upload, ArrowRight, Sparkles, Image } from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';
import { useUIStore } from '../store/useUIStore';
import { estimateLighting } from '../utils/lightingEstimator';
import { validateImageWithModal } from '../utils/uploadLimits';

export function UploadScreen() {
  const setBackgroundImage = useSceneStore((s) => s.setBackgroundImage);
  const setEstimatedLighting = useSceneStore((s) => s.setEstimatedLighting);
  const initializePhotoSurfaces = useSceneStore((s) => s.initializePhotoSurfaces);
  const setStep = useUIStore((s) => s.setStep);
  const isAnalyzing = useUIStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useUIStore((s) => s.setIsAnalyzing);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!(await validateImageWithModal(file))) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        setBackgroundImage(dataUrl);
        initializePhotoSurfaces();
        setIsAnalyzing(true);

        const lighting = await estimateLighting(dataUrl);
        setEstimatedLighting(lighting);
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    },
    [setBackgroundImage, setEstimatedLighting, initializePhotoSurfaces, setIsAnalyzing]
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
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background — soft light washes, no decorative clutter */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/3 w-[28rem] h-[28rem] rounded-full blur-[120px] opacity-[0.14]"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-10"
          style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }}
        />
      </div>

      <div className="relative z-10 text-center mb-10 animate-fade-in">
        <h1
          className="text-5xl font-bold tracking-tight mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Depth
        </h1>
        <p className="text-text-primary text-lg max-w-md mx-auto leading-snug">
          Drop in a photo. Place a 3D object. The lighting just matches.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Runs locally in your browser — no uploads, no account.
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
          className={`relative z-10 w-full max-w-lg aspect-[4/3] border border-dashed rounded-2xl flex flex-col items-center justify-center gap-5 transition-all duration-300 cursor-pointer group animate-fade-in ${
            dragOver
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-white/10 hover:border-primary/40 hover:bg-white/[0.02]'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            dragOver
              ? 'bg-primary/20 scale-110'
              : 'bg-white/5 group-hover:bg-primary/10'
          }`}>
            {dragOver ? (
              <Image size={28} className="text-primary" />
            ) : (
              <Upload size={28} className="text-text-muted group-hover:text-primary transition-colors" />
            )}
          </div>
          <div className="text-center">
            <p className="font-medium text-text-primary">
              {dragOver ? 'Drop to upload' : 'Drop your base image here'}
            </p>
            <p className="text-sm text-text-muted mt-1.5">
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
        <div className="relative z-10 w-full max-w-lg animate-fade-in">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/30">
            <img
              src={preview}
              alt="Uploaded base image"
              className="w-full aspect-[4/3] object-cover"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-surface-raised/90 backdrop-blur-md border border-white/10 rounded-xl px-6 py-3.5 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <div>
                    <span className="text-sm font-medium text-text-primary block">
                      Analyzing your photo
                    </span>
                    <span className="text-xs text-text-muted">
                      Matching lighting and assuming a floor surface…
                    </span>
                  </div>
                </div>
              </div>
            )}
            {!isAnalyzing && (
              <div className="absolute top-3 right-3">
                <div className="bg-success/90 text-white text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5">
                  <Sparkles size={12} />
                  Ready — lighting + floor
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
                useSceneStore.setState({ surfaces: [] });
              }}
              className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-medium text-text-secondary hover:bg-white/[0.03] hover:border-white/20 transition-all"
            >
              Choose different
            </button>
            <button
              onClick={() => setStep('editor')}
              disabled={isAnalyzing}
              className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      <p className="relative z-10 text-xs text-text-muted mt-10 max-w-sm text-center leading-relaxed">
        Lighting and a floor surface are estimated on your machine when the photo lands.
      </p>
    </div>
  );
}

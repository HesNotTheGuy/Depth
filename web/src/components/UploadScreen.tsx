import { useCallback, useState } from 'react';
import { Upload, ArrowRight, Sparkles, Image } from 'lucide-react';
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
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-15"
          style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }}
        />

        {/* Floating wireframe shapes */}
        {/* Floating wireframe shapes */}
        {/* Cube wireframe - top left */}
        <svg className="absolute top-[10%] left-[8%] w-28 h-28 animate-drift-1 opacity-[0.12]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.8">
          <path d="M25 35 L50 20 L75 35 L75 65 L50 80 L25 65 Z" className="text-primary" />
          <path d="M25 35 L50 50 L75 35" className="text-primary" />
          <path d="M50 50 L50 80" className="text-primary" />
        </svg>

        {/* Triangle - top right */}
        <svg className="absolute top-[12%] right-[10%] w-24 h-24 animate-drift-2 opacity-[0.10]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
          <polygon points="50,15 85,80 15,80" className="text-accent" />
          <line x1="50" y1="15" x2="50" y2="80" className="text-accent" opacity="0.4" />
        </svg>

        {/* Circle with cross - middle left */}
        <svg className="absolute top-[45%] left-[4%] w-20 h-20 animate-drift-3 opacity-[0.08]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="50" cy="50" r="35" className="text-purple-400" />
          <line x1="50" y1="15" x2="50" y2="85" className="text-purple-400" opacity="0.4" />
          <line x1="15" y1="50" x2="85" y2="50" className="text-purple-400" opacity="0.4" />
        </svg>

        {/* Diamond - bottom right */}
        <svg className="absolute bottom-[18%] right-[7%] w-22 h-22 animate-drift-1 opacity-[0.09]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" style={{ animationDelay: '-7s' }}>
          <polygon points="50,10 90,50 50,90 10,50" className="text-accent" />
          <polygon points="50,25 75,50 50,75 25,50" className="text-accent" opacity="0.4" />
        </svg>

        {/* Torus-ish rings - bottom left */}
        <svg className="absolute bottom-[22%] left-[10%] w-24 h-24 animate-drift-2 opacity-[0.08]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.8" style={{ animationDelay: '-12s' }}>
          <ellipse cx="50" cy="50" rx="40" ry="20" className="text-primary" />
          <ellipse cx="50" cy="50" rx="20" ry="40" className="text-primary" opacity="0.5" />
        </svg>

        {/* Pentagon - far right center */}
        <svg className="absolute top-[55%] right-[3%] w-16 h-16 animate-drift-3 opacity-[0.06]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" style={{ animationDelay: '-15s' }}>
          <polygon points="50,10 95,40 80,90 20,90 5,40" className="text-purple-300" />
        </svg>

        {/* Orbiting dots */}
        <div className="absolute top-[28%] right-[22%] w-44 h-44 animate-orbit opacity-[0.12]">
          <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -ml-0.75 rounded-full bg-primary" />
          <div className="absolute bottom-0 left-1/2 w-1 h-1 -ml-0.5 rounded-full bg-accent" />
          <div className="absolute top-1/2 left-0 w-1 h-1 -mt-0.5 rounded-full bg-purple-400" />
        </div>

        {/* Small floating particles */}
        <div className="absolute top-[60%] right-[30%] w-1.5 h-1.5 rounded-full bg-primary/30 animate-drift-3" style={{ animationDelay: '-5s' }} />
        <div className="absolute top-[20%] left-[40%] w-2 h-2 rounded-full bg-accent/20 animate-drift-1" style={{ animationDelay: '-10s' }} />
        <div className="absolute top-[70%] left-[30%] w-1.5 h-1.5 rounded-full bg-purple-400/20 animate-drift-2" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-[35%] left-[20%] w-1 h-1 rounded-full bg-primary/25 animate-drift-1" style={{ animationDelay: '-18s' }} />
        <div className="absolute top-[80%] right-[40%] w-1 h-1 rounded-full bg-accent/15 animate-drift-2" style={{ animationDelay: '-8s' }} />
      </div>

      <div className="relative z-10 text-center mb-10 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-purple-400 to-accent bg-clip-text text-transparent">
              DEPTH
            </span>
          </h1>
        </div>
        <p className="text-text-secondary text-lg max-w-md">
          Drop in a photo. Place a 3D object. Match the lighting.
          <br />
          <span className="text-text-muted text-sm">Compositing made simple.</span>
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
                      Analyzing lighting
                    </span>
                    <span className="text-xs text-text-muted">
                      Estimating direction, color, intensity...
                    </span>
                  </div>
                </div>
              </div>
            )}
            {!isAnalyzing && (
              <div className="absolute top-3 right-3">
                <div className="bg-success/90 text-white text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5">
                  <Sparkles size={12} />
                  Lighting matched
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
        Everything runs locally in your browser.
        <br />
        No uploads. No servers. Just pixels.
      </p>
    </div>
  );
}

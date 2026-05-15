import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Grid3X3,
  Download,
  Sun,
  Palette,
  Smartphone,
  Image,
  Eclipse,
  FileDown,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

function GithubIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Intersection Observer hook for fade-in-on-scroll                  */
/* ------------------------------------------------------------------ */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landing-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function FadeIn({ children, className = '', delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={`landing-fade ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero 3D-ish visual (pure CSS/SVG - no heavy deps)                 */
/* ------------------------------------------------------------------ */
function HeroVisual() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto aspect-square select-none">
      {/* Glow backdrop */}
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-[100px]" />

      {/* Floating shapes */}
      <div className="absolute inset-0">
        {/* Main "card" */}
        <div
          className="absolute top-[18%] left-[12%] w-[76%] h-[56%] rounded-2xl border border-panel-border bg-surface-raised/80 backdrop-blur-sm shadow-2xl overflow-hidden"
          style={{ transform: 'perspective(800px) rotateY(-4deg) rotateX(2deg)' }}
        >
          {/* Fake image grid */}
          <div className="absolute inset-3 grid grid-cols-3 gap-2 opacity-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-white/5" />
            ))}
          </div>
          {/* Label overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
            <div className="h-2 w-16 rounded-full bg-primary/50" />
            <div className="h-2 w-10 rounded-full bg-accent/40" />
          </div>
        </div>

        {/* Floating mug mockup */}
        <div
          className="absolute bottom-[12%] right-[6%] w-24 h-28 rounded-xl border border-primary/20 bg-surface-overlay/90 backdrop-blur shadow-lg animate-drift-1"
          style={{ animationDuration: '14s' }}
        >
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-12 rounded-md bg-primary/20 border border-primary/30" />
          </div>
        </div>

        {/* Floating phone outline */}
        <div
          className="absolute top-[8%] right-[14%] w-14 h-24 rounded-xl border border-accent/25 bg-surface-overlay/60 backdrop-blur shadow-lg animate-drift-2"
          style={{ animationDuration: '18s' }}
        >
          <div className="mt-2 mx-auto w-6 h-1 rounded-full bg-accent/30" />
        </div>

        {/* Small accent dot */}
        <div className="absolute bottom-[28%] left-[8%] w-4 h-4 rounded-full bg-primary/40 animate-drift-3" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[36%] right-[4%] w-3 h-3 rounded-full bg-accent/30 animate-drift-2" style={{ animationDuration: '12s' }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Steps section                                                     */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    icon: Upload,
    title: 'Upload your background',
    desc: 'Drop any photo. JPEG, PNG, or WebP.',
  },
  {
    icon: Grid3X3,
    title: 'Choose a mockup',
    desc: 'Mug, phone, bottle, bag, card, and more.',
  },
  {
    icon: Download,
    title: 'Export your composite',
    desc: 'PNG with transparency. Ready for Photoshop or Figma.',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Feature grid items                                                */
/* ------------------------------------------------------------------ */
const FEATURES = [
  { icon: Sun, title: 'Smart Lighting', desc: 'Auto-matches lighting from your photo' },
  { icon: Palette, title: 'Material Library', desc: 'Glass, metal, matte, plastic, glossy' },
  { icon: Smartphone, title: 'Mockup Presets', desc: 'Mug, phone, bottle, bag, card' },
  { icon: Image, title: 'Texture Mapping', desc: 'Upload labels and logos' },
  { icon: Eclipse, title: 'Shadow Control', desc: 'Adjustable softness, color, opacity' },
  { icon: FileDown, title: 'One-click Export', desc: 'PNG layers for Photoshop / Figma' },
] as const;

/* ------------------------------------------------------------------ */
/*  SDK code snippet                                                  */
/* ------------------------------------------------------------------ */
/** Escape HTML metacharacters so syntax-highlight regexes can safely produce
 *  HTML wrapping without ever leaking raw markup from the source string. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CODE_SNIPPET = `#include <depth/depth.h>

depth::Scene scene;
scene.set_background(depth::Image::load("photo.jpg"));

auto& obj = scene.add_mesh(depth::Mesh::preset("mug"));
obj.set_material({ .roughness = 0.3f, .metallic = 0.0f });
obj.apply_texture(depth::Image::load("logo.png"));

depth::Renderer renderer;
auto result = renderer.render(scene, { 1920, 1080 });
result.save("output.png");`;

/* ------------------------------------------------------------------ */
/*  Main landing page                                                 */
/* ------------------------------------------------------------------ */
export function LandingPage() {
  const navigate = useNavigate();

  const goToApp = useCallback(() => navigate('/app'), [navigate]);

  const scrollToHow = useCallback(() => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="landing-root">
      {/* ---- Nav ---- */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-6 md:px-12 bg-[#0A0A0F]/80 backdrop-blur-md border-b border-panel-border">
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          Depth
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <GithubIcon size={18} />
          </a>
          <button
            onClick={goToApp}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
          >
            Open App
          </button>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        {/* Background glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/[0.07] rounded-full blur-[120px]" />

        <FadeIn className="text-center max-w-3xl mx-auto z-10">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tighter bg-gradient-to-b from-white to-text-secondary bg-clip-text text-transparent pb-2">
            Depth
          </h1>
          <p className="mt-6 text-xl sm:text-2xl font-medium text-text-primary leading-snug">
            Turn any photo into a 3D product mockup in 30 seconds
          </p>
          <p className="mt-4 text-base sm:text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
            No 3D experience needed. Upload a photo, pick a shape, export.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={goToApp}
              className="group flex items-center gap-2 px-8 py-3 text-base font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              Try it now
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={scrollToHow}
              className="flex items-center gap-1.5 px-6 py-3 text-base font-medium rounded-xl text-text-secondary hover:text-text-primary border border-panel-border hover:border-white/10 transition-colors"
            >
              See how it works
              <ChevronDown size={16} />
            </button>
          </div>
        </FadeIn>

        <FadeIn className="mt-12 z-10 w-full max-w-2xl" delay={200}>
          <HeroVisual />
        </FadeIn>
      </section>

      {/* ---- How it works ---- */}
      <section id="how-it-works" className="py-32 px-6">
        <FadeIn className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">Three steps. That's it.</h2>
        </FadeIn>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 120}>
              <div className="relative group flex flex-col items-center text-center p-8 rounded-2xl border border-panel-border bg-surface-raised/50 hover:border-primary/20 transition-colors">
                <span className="absolute -top-3.5 left-6 text-xs font-bold text-text-muted bg-surface px-2">
                  0{i + 1}
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <step.icon size={22} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="py-32 px-6">
        <FadeIn className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">Everything you need, nothing you don't</h2>
        </FadeIn>

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat, i) => (
            <FadeIn key={feat.title} delay={i * 80}>
              <div className="p-6 rounded-2xl border border-panel-border bg-surface-raised/40 hover:border-primary/15 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <feat.icon size={18} className="text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">{feat.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feat.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ---- For developers ---- */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent mb-3">For developers</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-6">
              Powered by a zero-dependency C++ engine
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              12K lines. Embeds anywhere. WebAssembly ready. The Depth SDK gives you full
              programmatic control over the compositing pipeline — lighting, materials,
              meshes, and rendering — with no external dependencies.
            </p>
            <div className="flex items-center gap-6 text-sm text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                C++ 17
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Zero deps
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" />
                WASM ready
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="rounded-2xl border border-panel-border bg-[#0D0D14] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-panel-border">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-text-muted font-mono">main.cpp</span>
              </div>
              <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto font-mono">
                <code className="text-text-secondary">
                  {CODE_SNIPPET.split('\n').map((line, i) => {
                    // Simple syntax highlighting. Escape first so the regex
                    // replacements operate on safe content; the `<` / `>` in
                    // `#include <…>` become `&lt;` / `&gt;` so we match those.
                    const highlighted = escapeHtml(line)
                      .replace(/(#include\s+&lt;[^&]+&gt;)/g, '<span class="text-accent">$1</span>')
                      .replace(/(depth::\w+)/g, '<span class="text-primary">$1</span>')
                      .replace(/(".*?")/g, '<span class="text-green-400">$1</span>')
                      .replace(/(\/\/.*)/g, '<span class="text-text-muted">$1</span>')
                      .replace(/(\.\w+\s*=)/g, '<span class="text-yellow-300/80">$1</span>')
                      .replace(/(auto|float)/g, '<span class="text-orange-300/80">$1</span>');
                    return (
                      <span key={i}>
                        <span className="inline-block w-8 text-right mr-4 text-text-muted/40 select-none">{i + 1}</span>
                        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
                        {'\n'}
                      </span>
                    );
                  })}
                </code>
              </pre>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="py-32 px-6">
        <FadeIn className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
            Ready to try it?
          </h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            Upload a photo, pick a mockup, and export a production-ready composite. No signup required.
          </p>
          <button
            onClick={goToApp}
            className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            Launch Depth
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </FadeIn>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-panel-border py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-text-muted">
            Built with Depth SDK
          </span>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
            >
              <GithubIcon size={14} />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

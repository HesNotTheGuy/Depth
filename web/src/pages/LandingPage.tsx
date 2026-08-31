import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Sun,
  Box,
  Download,
  Palette,
  Layers,
  Smartphone,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

const GITHUB_URL = 'https://github.com/HesNotTheGuy/Depth';

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
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function FadeIn({
  children,
  className = '',
  delay = 0,
}: {
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

const STEPS = [
  {
    icon: Upload,
    title: 'Drop in a photo',
    desc: 'Any JPEG, PNG, or WebP. Lighting is estimated automatically.',
  },
  {
    icon: Box,
    title: 'Place a 3D object',
    desc: 'Mug, phone, bottle, bag — or a primitive. Drag it into place.',
  },
  {
    icon: Sun,
    title: 'The lighting just matches',
    desc: 'Direction, color, and shadows follow the scene. Tweak if you want.',
  },
] as const;

const FEATURES = [
  { icon: Sun, title: 'Auto lighting', desc: 'Estimates direction, brightness, and color from your plate' },
  { icon: Smartphone, title: 'Mockup library', desc: 'Phone, mug, bottle, bag, card, laptop, and more' },
  { icon: Palette, title: 'Materials', desc: 'Matte, metal, glass, wood, marble, fabric, leather' },
  { icon: Layers, title: 'Surface planes', desc: 'Draw quads so objects sit on desks and floors' },
  { icon: Download, title: 'Clean export', desc: 'PNG at 1× / 2× / 4×, or layered passes for Photoshop' },
] as const;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Matches the real C++ API in sdk/include/depth — keep this honest. */
const CODE_SNIPPET = `#include <depth/depth.h>
using namespace depth;

Scene scene;
auto bg = Image::load("photo.jpg");
scene.set_background(bg);
scene.apply_lighting_estimate(estimate_lighting(bg));

SceneObject obj;
obj.geometry = GeometryType::Box;
obj.transform.position = {0, 0.5f, 0};
obj.material = Material::from_preset(MaterialPreset::Metallic);
scene.add_object(obj);

auto renderer = Renderer::create();
render_composite(*renderer, scene).save("output.png");`;

export function LandingPage() {
  const navigate = useNavigate();

  const goToApp = useCallback(() => navigate('/app'), [navigate]);

  const scrollToHow = useCallback(() => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="landing-root">
      <nav className="landing-nav">
        <span className="landing-brand">Depth</span>
        <div className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors p-2"
            aria-label="GitHub repository"
          >
            <GithubIcon size={18} />
          </a>
          <button type="button" onClick={goToApp} className="landing-nav-cta">
            Open App
          </button>
        </div>
      </nav>

      {/* Hero — one composition: brand, pitch, CTA, dominant product shot */}
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <h1 className="landing-hero-brand">Depth</h1>
          <p className="landing-hero-tagline">
            Drop in a photo. Place a 3D object. The lighting just matches.
          </p>
          <p className="landing-hero-sub">
            Product mockups for designers who don&apos;t need Blender.
          </p>
          <div className="landing-hero-actions">
            <button type="button" onClick={goToApp} className="landing-cta-primary group">
              Try it now
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button type="button" onClick={scrollToHow} className="landing-cta-secondary">
              See how it works
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="landing-hero-visual" aria-hidden={false}>
          <img
            src="/screenshots/editor.png"
            alt="Depth editor with a phone mockup composited onto a studio backdrop"
            className="landing-hero-image"
            width={1440}
            height={900}
          />
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <FadeIn className="landing-section-head">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="landing-h2">Three steps. That&apos;s the whole product.</h2>
        </FadeIn>

        <div className="landing-steps">
          {STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 100}>
              <div className="landing-step">
                <span className="landing-step-num">0{i + 1}</span>
                <step.icon size={22} className="text-primary mb-4" strokeWidth={1.5} />
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-tight">
        <FadeIn className="landing-section-head">
          <p className="landing-eyebrow">In the app</p>
          <h2 className="landing-h2">Lighting, materials, and surfaces — without a 3D degree</h2>
        </FadeIn>

        <div className="landing-shot-grid">
          <FadeIn delay={60}>
            <figure className="landing-shot">
              <img src="/screenshots/lighting.png" alt="Lighting panel matching a scene" />
              <figcaption>Auto-matched lighting you can still fine-tune</figcaption>
            </figure>
          </FadeIn>
          <FadeIn delay={140}>
            <figure className="landing-shot">
              <img src="/screenshots/materials.png" alt="Material presets in the editor" />
              <figcaption>Material presets from matte plastic to glass</figcaption>
            </figure>
          </FadeIn>
          <FadeIn delay={220}>
            <figure className="landing-shot">
              <img src="/screenshots/surfaces.png" alt="Surface planes drawn on a photo" />
              <figcaption>Draw surfaces so objects sit on the desk</figcaption>
            </figure>
          </FadeIn>
        </div>
      </section>

      <section className="landing-section">
        <FadeIn className="landing-section-head">
          <p className="landing-eyebrow">Features</p>
          <h2 className="landing-h2">Everything you need for a believable composite</h2>
        </FadeIn>

        <div className="landing-features">
          {FEATURES.map((feat, i) => (
            <FadeIn key={feat.title} delay={i * 70}>
              <div className="landing-feature">
                <feat.icon size={18} className="text-primary mb-3" strokeWidth={1.5} />
                <h3 className="landing-feature-title">{feat.title}</h3>
                <p className="landing-feature-desc">{feat.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-dev">
          <FadeIn>
            <p className="landing-eyebrow">For developers</p>
            <h2 className="landing-h2 mb-5">
              Same idea as a zero-dependency C++ SDK
            </h2>
            <p className="landing-dev-copy">
              The web app is the fastest way to try the workflow. The Depth SDK is the
              embeddable engine — lighting estimation, surface planes, software
              rasterizer, and compositing — with a flat C API for FFI.
            </p>
            <div className="landing-dev-meta">
              <span>C++20</span>
              <span>Zero runtime deps</span>
              <span>~5K LOC</span>
            </div>
          </FadeIn>

          <FadeIn delay={120}>
            <div className="landing-code">
              <div className="landing-code-bar">
                <span className="landing-code-dot" />
                <span className="landing-code-dot" />
                <span className="landing-code-dot" />
                <span className="landing-code-file">main.cpp</span>
              </div>
              <pre className="landing-code-pre">
                <code>
                  {CODE_SNIPPET.split('\n').map((line, i) => {
                    const highlighted = escapeHtml(line)
                      .replace(/(#include\s+&lt;[^&]+&gt;)/g, '<span class="text-accent">$1</span>')
                      .replace(/(depth::\w+|using namespace depth)/g, '<span class="text-primary">$1</span>')
                      .replace(/(".*?")/g, '<span class="text-green-400">$1</span>')
                      .replace(/(\/\/.*)/g, '<span class="text-text-muted">$1</span>')
                      .replace(/(auto|float|using|namespace)/g, '<span class="text-orange-300/80">$1</span>');
                    return (
                      <span key={i}>
                        <span className="landing-code-ln">{i + 1}</span>
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

      <section className="landing-section landing-cta-block">
        <FadeIn className="text-center">
          <h2 className="landing-h2 mb-4">Ready to match the lighting?</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            Upload a photo, place a mockup, export. Runs locally in your browser — no signup.
          </p>
          <button type="button" onClick={goToApp} className="landing-cta-primary group inline-flex">
            Launch Depth
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </FadeIn>
      </section>

      <footer className="landing-footer">
        <span className="text-sm text-text-muted">Depth — 3D compositing for 2D images</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
        >
          <GithubIcon size={14} />
          GitHub
        </a>
      </footer>
    </div>
  );
}

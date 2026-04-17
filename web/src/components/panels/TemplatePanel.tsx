import { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { useSelectedObject } from '../../hooks/useSelectedObject';
import { sceneTemplates, type SceneTemplate } from '../../data/sceneTemplates';

interface TemplateSnapshot {
  objectType?: string;
  objectMaterial?: string;
  objectColor?: string;
  brightness: number;
  shadowOpacity: number;
}

function isTemplateActive(template: SceneTemplate, store: TemplateSnapshot): boolean {
  const s = template.state;
  return (
    (s.objectType === undefined || s.objectType === store.objectType) &&
    (s.objectMaterial === undefined || s.objectMaterial === store.objectMaterial) &&
    (s.objectColor === undefined || s.objectColor === store.objectColor) &&
    (s.brightness === undefined || Math.abs(s.brightness - store.brightness) < 0.01) &&
    (s.shadowOpacity === undefined || Math.abs(s.shadowOpacity - store.shadowOpacity) < 0.01)
  );
}

export function TemplatePanel() {
  const [filter, setFilter] = useState('');
  const applyTemplate = useSceneStore((s) => s.applyTemplate);
  const selected = useSelectedObject();
  const brightness = useSceneStore((s) => s.brightness);
  const shadowOpacity = useSceneStore((s) => s.shadowOpacity);

  const storeSnapshot: TemplateSnapshot = {
    objectType: selected?.type,
    objectMaterial: selected?.material,
    objectColor: selected?.color,
    brightness,
    shadowOpacity,
  };

  const filtered = useMemo(() => {
    if (!filter.trim()) return sceneTemplates;
    const q = filter.toLowerCase();
    return sceneTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [filter]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[11px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
        Scene Presets
      </label>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((template) => {
          const active = isTemplateActive(template, storeSnapshot);
          return (
            <button
              key={template.id}
              onClick={() => applyTemplate(template.state)}
              className={`relative flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all ${
                active
                  ? 'bg-primary/15 ring-1 ring-primary/30'
                  : 'bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              {active && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-primary" />
                </div>
              )}
              <span className="text-lg leading-none">{template.icon}</span>
              <span
                className={`text-[11px] font-medium leading-tight ${
                  active ? 'text-primary' : 'text-text-secondary'
                }`}
              >
                {template.name}
              </span>
              <span className="text-[10px] text-text-muted leading-snug">
                {template.description}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-[11px] text-text-muted text-center py-6">
          No templates match your search.
        </p>
      )}
    </div>
  );
}

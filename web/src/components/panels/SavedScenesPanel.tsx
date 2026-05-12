import { useState, useCallback, useEffect } from 'react';
import { Save, Trash2, Bookmark } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { useExportStore } from '../../store/useExportStore';
import { MAX_SAVED_SCENES, type SavedSceneMeta } from '../../store/scenePersistence';

const THUMB_W = 256;
const THUMB_H = 144;

/** Capture a thumbnail from the Three.js renderer. Falls back to a placeholder. */
function captureThumbnail(): string {
  const { renderer, scene, camera } = useExportStore.getState();
  if (renderer && scene && camera) {
    try {
      // Render once at current size, then downscale to 256x144 via a 2D canvas.
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const off = document.createElement('canvas');
      off.width = THUMB_W;
      off.height = THUMB_H;
      const ctx = off.getContext('2d');
      if (ctx) {
        ctx.drawImage(src, 0, 0, THUMB_W, THUMB_H);
        return off.toDataURL('image/jpeg', 0.7);
      }
    } catch (err) {
      console.warn('[depth] Thumbnail capture failed; using placeholder.', err);
    }
  }
  return placeholderThumbnail();
}

function placeholderThumbnail(): string {
  const off = document.createElement('canvas');
  off.width = THUMB_W;
  off.height = THUMB_H;
  const ctx = off.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, THUMB_W, THUMB_H);
    grad.addColorStop(0, '#3730a3');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Scene', THUMB_W / 2, THUMB_H / 2);
  }
  return off.toDataURL('image/jpeg', 0.7);
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function SavedScenesPanel() {
  const saveCurrentScene = useSceneStore((s) => s.saveCurrentScene);
  const loadScene = useSceneStore((s) => s.loadScene);
  const deleteScene = useSceneStore((s) => s.deleteScene);
  const listSavedScenes = useSceneStore((s) => s.listSavedScenes);

  const [scenes, setScenes] = useState<SavedSceneMeta[]>(() => listSavedScenes());

  const refresh = useCallback(() => setScenes(listSavedScenes()), [listSavedScenes]);

  // Listen for cross-tab localStorage changes so the list stays in sync
  // when the user saves a scene in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith('depth-scene')) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const atCapacity = scenes.length >= MAX_SAVED_SCENES;

  const handleSave = () => {
    if (atCapacity) {
      window.alert(`You can save at most ${MAX_SAVED_SCENES} scenes. Delete one first.`);
      return;
    }
    const name = window.prompt('Name this scene:');
    if (!name || !name.trim()) return;
    const thumbnail = captureThumbnail();
    try {
      saveCurrentScene(name.trim(), thumbnail);
      refresh();
    } catch (err) {
      console.warn('[depth] Saving scene failed.', err);
      window.alert('Could not save scene. Check the console for details.');
    }
  };

  const handleLoad = (id: string) => {
    const ok = loadScene(id);
    if (!ok) {
      window.alert('Could not load that scene — it may have been removed.');
      refresh();
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved scene?')) return;
    deleteScene(id);
    refresh();
  };

  return (
    <div>
      <button
        onClick={handleSave}
        disabled={atCapacity}
        className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white shadow-lg shadow-primary/15 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
        title={atCapacity ? 'Slots full — delete one first' : 'Save current scene'}
      >
        <Save size={15} />
        Save current scene
      </button>

      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          Saved Scenes
        </label>
        <span className="text-[10px] text-text-muted">
          {scenes.length}/{MAX_SAVED_SCENES}
        </span>
      </div>

      {scenes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-text-muted">
          <Bookmark size={28} className="opacity-40" />
          <p className="text-[11px] text-center leading-relaxed px-4">
            No saved scenes yet. Click Save to keep a copy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => handleLoad(s.id)}
              className="group relative flex flex-col items-stretch gap-1 p-1.5 rounded-lg text-left transition-all bg-white/[0.03] hover:bg-white/[0.06]"
              title={`Load "${s.name}"`}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-black/30">
                <img
                  src={s.thumbnail}
                  alt={s.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/60 text-white/80 hover:bg-red-500/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Delete"
                  aria-label="Delete scene"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="px-1 pb-0.5">
                <div className="text-[11px] font-medium text-text-secondary truncate">{s.name}</div>
                <div className="text-[10px] text-text-muted">{relativeTime(s.savedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

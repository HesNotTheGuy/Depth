import { useEffect } from 'react';
import { useUIStore } from './store/useUIStore';
import { useSceneStore } from './store/useSceneStore';
import { UploadScreen } from './components/UploadScreen';
import { Editor } from './components/Editor';
import { ModalRoot } from './components/ui/Modal';

function App() {
  const step = useUIStore((s) => s.step);
  const setStep = useUIStore((s) => s.setStep);

  // Restore the editor after refresh when a background plate was persisted.
  // `temporal(persist(...))` nesting can leave `hasHydrated()` false and skip
  // `onFinishHydration`, so we also do a short one-shot fallback — kept brief
  // so it can't race a fresh upload on the same page load.
  useEffect(() => {
    let cancelled = false;

    const tryRestore = () => {
      if (cancelled) return;
      const scene = useSceneStore.getState();
      // Legacy saves: background without surfaces — assume the floor on restore.
      if (scene.backgroundImage && scene.surfaces.length === 0) {
        scene.initializePhotoSurfaces();
      }
      if (
        useUIStore.getState().step === 'upload' &&
        scene.backgroundImage
      ) {
        setStep('editor');
      }
    };

    tryRestore();
    const unsubHydrate = useSceneStore.persist.onFinishHydration(tryRestore);
    const t = window.setTimeout(tryRestore, 100);

    return () => {
      cancelled = true;
      unsubHydrate();
      clearTimeout(t);
    };
  }, [setStep]);

  return (
    <div className="h-screen w-screen flex flex-col bg-surface overflow-hidden">
      {step === 'upload' ? <UploadScreen /> : <Editor />}
      <ModalRoot />
    </div>
  );
}

export default App;

import { useEffect } from 'react';
import { useUIStore } from './store/useUIStore';
import { useSceneStore } from './store/useSceneStore';
import { UploadScreen } from './components/UploadScreen';
import { Editor } from './components/Editor';
import { ModalRoot } from './components/ui/Modal';

function App() {
  const step = useUIStore((s) => s.step);
  const setStep = useUIStore((s) => s.setStep);

  // After localStorage rehydration, jump straight into the editor when a
  // background plate is already present — otherwise a refresh dumps users
  // back on an empty upload screen despite a persisted scene.
  useEffect(() => {
    const restore = () => {
      if (useSceneStore.getState().backgroundImage) {
        setStep('editor');
      }
    };
    if (useSceneStore.persist.hasHydrated()) {
      restore();
      return;
    }
    return useSceneStore.persist.onFinishHydration(restore);
  }, [setStep]);

  return (
    <div className="h-screen w-screen flex flex-col bg-surface overflow-hidden">
      {step === 'upload' ? <UploadScreen /> : <Editor />}
      <ModalRoot />
    </div>
  );
}

export default App;

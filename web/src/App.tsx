import { useUIStore } from './store/useUIStore';
import { UploadScreen } from './components/UploadScreen';
import { Editor } from './components/Editor';
import { ExportModal } from './components/export/ExportModal';
import { ModalRoot } from './components/ui/Modal';

function App() {
  const step = useUIStore((s) => s.step);

  return (
    <div className="h-screen w-screen flex flex-col bg-surface overflow-hidden">
      {step === 'upload' ? <UploadScreen /> : <Editor />}
      <ExportModal />
      <ModalRoot />
    </div>
  );
}

export default App;

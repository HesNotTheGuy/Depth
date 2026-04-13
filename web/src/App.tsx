import { useUIStore } from './store/useUIStore';
import { UploadScreen } from './components/UploadScreen';
import { Editor } from './components/Editor';
import { ExportModal } from './components/export/ExportModal';

function App() {
  const step = useUIStore((s) => s.step);

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
      {step === 'upload' ? <UploadScreen /> : <Editor />}
      <ExportModal />
    </div>
  );
}

export default App;

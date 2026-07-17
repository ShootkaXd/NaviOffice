import { StoreProvider } from './store';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import FloorSelector from './components/FloorSelector';

export default function App() {
  return (
    <StoreProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Toolbar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Canvas />
            <FloorSelector />
          </div>
          <PropertiesPanel />
        </div>
      </div>
    </StoreProvider>
  );
}

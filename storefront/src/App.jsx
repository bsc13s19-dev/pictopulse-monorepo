import React, { useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 📦 THE CLICKABLE TOY BOX MANAGER (Your Core Engine)
function DisplayManager({ objects, gizmoMode, selectedId, setSelectedId }) {
  if (!objects || objects.length === 0) return null;
  return objects.map((data) => {
    const isSelected = data.id === selectedId;
    let content = null;
    const handleSelect = (e) => { e.stopPropagation(); setSelectedId(data.id); };

    if (data.type === 'model') {
      const { scene } = useGLTF(data.url);
      content = <primitive object={scene.clone()} scale={2} position={[data.startX, 0, data.startZ]} onClick={handleSelect} />;
    } else if (data.type === 'math') {
      const { shape, width, height, color } = data.params;
      content = (
        <mesh castShadow receiveShadow position={[data.startX, height / 2, data.startZ]} onClick={handleSelect}>
          {shape === 'sphere' && <sphereGeometry args={[width / 2, 32, 32]} />}
          {shape === 'box' && <boxGeometry args={[width, height, width]} />}
          {shape === 'cylinder' && <cylinderGeometry args={[width / 2, width / 2, height, 32]} />}
          {shape === 'cone' && <coneGeometry args={[width / 2, height, 32]} />}
          <meshStandardMaterial color={color} emissive={isSelected ? "#ffffff" : "#000000"} emissiveIntensity={isSelected ? 0.2 : 0} />
        </mesh>
      );
    }
    if (isSelected) return <TransformControls key={data.id} mode={gizmoMode}>{content}</TransformControls>;
    return <group key={data.id}>{content}</group>;
  });
}

function CameraDirector({ isRecording }) {
  useFrame((state) => {
    if (isRecording) {
      const time = state.clock.elapsedTime;
      state.camera.position.x = Math.sin(time * 0.4) * 15;
      state.camera.position.z = Math.cos(time * 0.4) * 15;
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("SYSTEM ONLINE");
  const [sceneObjects, setSceneObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null); 
  const [gizmoMode, setGizmoMode] = useState('translate'); 
  
  // 🎛️ NEW UI STATES
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('3D'); // Tabs: 2D, 3D, Render

  useEffect(() => {
    socket.on('cop_reply', (msg) => setCopReply(msg));
    socket.on('draw_3d_house', (data) => {
      const newObject = { ...data, id: Date.now(), startX: (Math.random() * 8) - 4, startZ: (Math.random() * 8) - 4 };
      setSceneObjects((prev) => [...prev, newObject]);
      setSelectedId(newObject.id); 
    });
    return () => { socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, []);

  const handleBuild = () => { if (prompt) { socket.emit('build_house', prompt); setPrompt(""); } };

  return (
    <div className="studio-container">
      
      {/* ⬅️ LEFT DOCK: AI CHAT & HISTORY */}
      <div className={`left-sidebar ${leftOpen ? '' : 'closed'}`}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: '#00ffcc' }}>AI Chat</h3>
          <button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button>
        </div>
        <div style={{ padding: '20px', flexGrow: 1, overflowY: 'auto', color: '#ccc' }}>
          <p><strong>Cop:</strong> {copReply}</p>
          {/* We will build the full chat history here later! */}
        </div>
      </div>

      {/* 🔲 CENTER WORKSPACE */}
      <div className="main-workspace">
        
        {/* TOP TABS */}
        <div className="top-bar">
          {!leftOpen && <button className="toggle-btn" style={{ position: 'absolute', left: '10px' }} onClick={() => setLeftOpen(true)}>☰ Chat</button>}
          <button className={`tab-btn ${activeTab === '2D' ? 'active' : ''}`} onClick={() => setActiveTab('2D')}>2D Blueprint</button>
          <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => setActiveTab('3D')}>3D Studio</button>
          <button className={`tab-btn ${activeTab === 'Render' ? 'active' : ''}`} onClick={() => setActiveTab('Render')}>Export & Render</button>
          {!rightOpen && <button className="toggle-btn" style={{ position: 'absolute', right: '10px' }} onClick={() => setRightOpen(true)}>⚙️ Tools</button>}
        </div>

        {/* THE VIEWPORT (Only runs when 3D tab is active!) */}
        <div style={{ flexGrow: 1, position: 'relative', display: activeTab === '3D' ? 'block' : 'none' }}>
          <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
            <CameraDirector isRecording={activeTab === 'Render'} />
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
            <Environment preset="city" />
            <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />
            <Suspense fallback={null}>
                <DisplayManager objects={sceneObjects} gizmoMode={gizmoMode} selectedId={selectedId} setSelectedId={setSelectedId} />
            </Suspense>
            {activeTab !== 'Render' && <OrbitControls makeDefault minDistance={5} maxDistance={50} />}
          </Canvas>

          {/* FLOATING COMMAND BAR */}
          <div className="floating-command">
             <input className="magic-input" placeholder="Ask AI to build anything..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
             <button className="build-btn" onClick={handleBuild}>Generate</button>
          </div>
        </div>

        {/* 2D & RENDER PLACEHOLDERS */}
        {activeTab === '2D' && <div style={{ padding: '50px', textAlign: 'center', color: '#777' }}><h2>2D Drafting Mode</h2><p>Floor plan generator coming soon...</p></div>}
        {activeTab === 'Render' && <div style={{ padding: '50px', textAlign: 'center', color: '#777' }}><h2>Director's Bay</h2><p>Cinematic Camera Active. PDF & Video Export tools coming soon...</p></div>}
      </div>

      {/* ➡️ RIGHT DOCK: TOOLS & PROPERTIES */}
      <div className={`right-sidebar ${rightOpen ? '' : 'closed'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button>
          <h3 style={{ margin: 0, color: 'white' }}>Inspector</h3>
        </div>
        
        {/* Gizmo Tools are now neatly tucked away here! */}
        <h4 style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Transform</h4>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
          <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#ff0055' : '#222' }} onClick={() => setGizmoMode('translate')}>Move</button>
          <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#ff0055' : '#222' }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
          <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#ff0055' : '#222' }} onClick={() => setGizmoMode('scale')}>Scale</button>
        </div>

        <h4 style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Scene</h4>
        <button className="toggle-btn" style={{ background: '#bb0000', width: '100%' }} onClick={() => { setSceneObjects([]); setSelectedId(null); }}>Clear Grid</button>
      </div>

    </div>
  );
}
import React, { useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

function DisplayManager({ objects, gizmoMode, selectedId, setSelectedId, explodeScale }) {
  if (!objects || objects.length === 0) return null;
  return objects.map((data) => {
    const isSelected = data.id === selectedId;
    let content = null;
    const handleSelect = (e) => { e.stopPropagation(); setSelectedId(data.id); };

    const posX = data.startX * explodeScale;
    const posZ = data.startZ * explodeScale;
    const posY = data.type === 'math' ? data.params.height / 2 : 0;

    if (data.type === 'model') {
      const { scene } = useGLTF(data.url);
      content = <primitive object={scene.clone()} scale={2} onClick={handleSelect} />;
    } else if (data.type === 'math') {
      const { shape, width, height, color } = data.params;
      content = (
        <mesh castShadow receiveShadow onClick={handleSelect}>
          {shape === 'sphere' && <sphereGeometry args={[width / 2, 32, 32]} />}
          {shape === 'box' && <boxGeometry args={[width, height, width]} />}
          {shape === 'cylinder' && <cylinderGeometry args={[width / 2, width / 2, height, 32]} />}
          {shape === 'cone' && <coneGeometry args={[width / 2, height, 32]} />}
          <meshStandardMaterial color={color} emissive={isSelected ? "#ffffff" : "#000000"} emissiveIntensity={isSelected ? 0.3 : 0} />
        </mesh>
      );
    }

    if (isSelected) return <TransformControls key={data.id} position={[posX, posY, posZ]} mode={gizmoMode}>{content}</TransformControls>;
    return <group key={data.id} position={[posX, posY, posZ]}>{content}</group>;
  });
}

function CameraDirector({ camView }) {
  useFrame((state) => {
    // Only glide camera if a specific button is clicked, but NEVER disable mouse rotation!
    if (camView !== 'Free') {
      const targetPos = new THREE.Vector3();
      if (camView === 'Top') targetPos.set(0, 25, 0);
      if (camView === 'Front') targetPos.set(0, 5, 25);
      if (camView === 'Side') targetPos.set(25, 5, 0);
      state.camera.position.lerp(targetPos, 0.05);
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Welcome to Pictopulse. What are we building today?' }]);
  const [sceneObjects, setSceneObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null); 
  
  const [leftOpen, setLeftOpen] = useState(false); // Start closed for cleaner look
  const [rightOpen, setRightOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Chat'); 
  
  const [gizmoMode, setGizmoMode] = useState('translate'); 
  const [envPreset, setEnvPreset] = useState('studio'); 
  const [floorType, setFloorType] = useState('grid'); 
  const [camView, setCamView] = useState('Free'); 
  const [explodeScale, setExplodeScale] = useState(1); 

  useEffect(() => {
    socket.on('cop_reply', (msg) => {
      setChatLog(prev => [...prev, { sender: 'ai', text: msg }]);
    });
    socket.on('draw_3d_house', (data) => {
      const newObject = { ...data, id: Date.now(), startX: (Math.random() * 6) - 3, startZ: (Math.random() * 6) - 3 };
      setSceneObjects((prev) => [...prev, newObject]);
      setSelectedId(newObject.id); 
      setActiveTab('3D');
      setCamView('Free'); // Reset to free camera when new object spawns
    });
    return () => { socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, []);

  const handleBuild = () => { 
    if (prompt) { 
      setChatLog(prev => [...prev, { sender: 'user', text: prompt }]);
      socket.emit('build_house', prompt); 
      setPrompt(""); 
    } 
  };

  return (
    <div className="studio-container">
      
      {/* 🏷️ TOP BAR (Always on top) */}
      <div className="top-bar">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="toggle-btn" onClick={() => setLeftOpen(!leftOpen)}>☰ Menu</button>
          <strong style={{ fontSize: '18px', letterSpacing: '2px', color: '#00ffcc' }}>PICTOPULSE</strong>
        </div>
        
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`} onClick={() => setActiveTab('Chat')}>1. Chat</button>
          <button className={`tab-btn ${activeTab === '2D' ? 'active' : ''}`} onClick={() => setActiveTab('2D')}>2. 2D Plan</button>
          <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => setActiveTab('3D')}>3. 3D Studio</button>
          <button className={`tab-btn ${activeTab === 'Anim' ? 'active' : ''}`} onClick={() => setActiveTab('Anim')}>4. Animation</button>
          <button className={`tab-btn ${activeTab === 'Render' ? 'active' : ''}`} onClick={() => setActiveTab('Render')}>5. Render</button>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="toggle-btn" onClick={() => setRightOpen(!rightOpen)}>⚙️ Tools</button>
          <div className="user-profile">
            <div className="avatar">G</div>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Guest Architect</span>
          </div>
        </div>
      </div>

      {/* ⬅️ FLOATING LEFT DOCK */}
      <div className={`left-sidebar ${leftOpen ? '' : 'closed'}`}>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px' }}>+ New Project</button>
          <h4 className="sidebar-title">Recent Projects</h4>
          <p style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }}>📁 Cyberpunk City</p>
          <p style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }}>📁 Modern 2BHK</p>
        </div>
        <div className="sidebar-section" style={{ flexGrow: 1 }}>
          <h4 className="sidebar-title">Global Settings</h4>
          <p style={{ fontSize: '12px', color: '#aaa' }}>Voice: <span style={{color: '#00ffcc'}}>Female (Locked)</span></p>
        </div>
      </div>

      {/* ➡️ FLOATING RIGHT DOCK */}
      <div className={`right-sidebar ${rightOpen ? '' : 'closed'}`}>
        <div className="sidebar-section">
          <h4 className="sidebar-title">Scene Hierarchy</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {sceneObjects.map((obj, i) => (
              <div key={obj.id} className={`outliner-item ${selectedId === obj.id ? 'active' : ''}`} onClick={() => setSelectedId(obj.id)}>
                {obj.type === 'model' ? `📦 Model ${i+1}` : `📐 ${obj.params.shape} ${i+1}`}
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-section">
          <h4 className="sidebar-title">Environment</h4>
          <select className="pro-select" value={envPreset} onChange={(e) => setEnvPreset(e.target.value)}>
             <option value="studio">💡 Studio</option>
             <option value="city">🌆 City</option>
          </select>
          <select className="pro-select" value={floorType} onChange={(e) => setFloorType(e.target.value)}>
             <option value="grid">📐 Grid</option>
             <option value="marble">🏛️ Marble</option>
          </select>
        </div>
        <div className="sidebar-section">
          <h4 className="sidebar-title">Assembly & Transform</h4>
          <input type="range" className="pro-slider" min="1" max="4" step="0.1" value={explodeScale} onChange={(e) => setExplodeScale(e.target.value)} />
          <div style={{ display: 'flex', gap: '5px', marginTop: '15px' }}>
            <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('translate')}>Move</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('scale')}>Scale</button>
          </div>
        </div>
      </div>

      {/* 🎮 3D CANVAS (Always running in the absolute background!) */}
      <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, bottom: 0, z-index: 1 }}>
        <div className="camera-controls">
          {['Free', 'Top', 'Front', 'Side'].map(view => (
             <button key={view} className={`cam-btn ${camView === view ? 'active' : ''}`} onClick={() => setCamView(view)}>{view}</button>
          ))}
        </div>
        <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
          <CameraDirector camView={camView} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
          <Environment preset={envPreset} background blur={0.5} />
          {floorType === 'grid' && <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />}
          {floorType === 'marble' && <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#eeeeee" roughness={0.1} /></mesh>}
          <Suspense fallback={null}>
              <DisplayManager objects={sceneObjects} gizmoMode={gizmoMode} selectedId={selectedId} setSelectedId={setSelectedId} explodeScale={explodeScale} />
          </Suspense>
          {/* Mouse rotation is permanently ON! */}
          <OrbitControls makeDefault minDistance={5} maxDistance={50} />
        </Canvas>
      </div>

      {/* 💬 TAB OVERLAYS (These instantly slide over the 3D Canvas) */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay chat-container">
          {chatLog.map((log, i) => (
            <div key={i} className={`chat-bubble ${log.sender}`}>
              {log.sender === 'ai' ? '🤖 Orchestrator: ' : '👤 You: '}
              {log.text}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Render' && (
        <div className="ui-overlay" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{ color: 'white' }}>Director's Bay</h1>
          <p style={{ color: '#00ffcc' }}>🎙️ Rendering spatial audio with the designated female voice narration track...</p>
        </div>
      )}

      {/* THE COMMAND BAR */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command">
           <button className="toggle-btn" title="Upload Attachment">📎</button>
           <input className="magic-input" placeholder="Type prompt to generate..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
           <button className="build-btn" onClick={handleBuild}>Generate</button>
        </div>
      )}

    </div>
  );
}
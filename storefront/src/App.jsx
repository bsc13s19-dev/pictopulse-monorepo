import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 📦 THE CLICKABLE TOY BOX (Now with Explode Logic!)
function DisplayManager({ objects, gizmoMode, selectedId, setSelectedId, explodeScale }) {
  if (!objects || objects.length === 0) return null;
  return objects.map((data) => {
    const isSelected = data.id === selectedId;
    let content = null;
    const handleSelect = (e) => { e.stopPropagation(); setSelectedId(data.id); };

    // 💥 Explode Math: Pushes objects away from the center based on the slider
    const posX = data.startX * explodeScale;
    const posZ = data.startZ * explodeScale;

    if (data.type === 'model') {
      const { scene } = useGLTF(data.url);
      content = <primitive object={scene.clone()} scale={2} position={[posX, 0, posZ]} onClick={handleSelect} />;
    } else if (data.type === 'math') {
      const { shape, width, height, color } = data.params;
      content = (
        <mesh castShadow receiveShadow position={[posX, height / 2, posZ]} onClick={handleSelect}>
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

// 🎥 THE ENGINEER'S CAMERA
function CameraDirector({ camView }) {
  useFrame((state) => {
    // Smoothly glide the camera to the correct engineering view
    const targetPos = new THREE.Vector3();
    if (camView === 'Perspective') targetPos.set(15, 15, 15);
    if (camView === 'Top') targetPos.set(0, 25, 0);
    if (camView === 'Front') targetPos.set(0, 5, 25);
    if (camView === 'Side') targetPos.set(25, 5, 0);
    
    state.camera.position.lerp(targetPos, 0.05);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

// 🌍 THE MAIN APP
export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("SYSTEM ONLINE");
  const [sceneObjects, setSceneObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null); 
  
  // 🎛️ UI & Workspace State
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('3D'); 
  const [inputMode, setInputMode] = useState('Text'); // Text or Image
  
  // 🛠️ Studio Tools State
  const [gizmoMode, setGizmoMode] = useState('translate'); 
  const [envPreset, setEnvPreset] = useState('city'); // city, sunset, studio, forest
  const [floorType, setFloorType] = useState('grid'); // grid, marble, grass
  const [camView, setCamView] = useState('Perspective'); 
  const [explodeScale, setExplodeScale] = useState(1); // 1 is normal, higher spreads things apart

  useEffect(() => {
    socket.on('cop_reply', (msg) => setCopReply(msg));
    socket.on('draw_3d_house', (data) => {
      const newObject = { ...data, id: Date.now(), startX: (Math.random() * 6) - 3, startZ: (Math.random() * 6) - 3 };
      setSceneObjects((prev) => [...prev, newObject]);
      setSelectedId(newObject.id); 
    });
    return () => { socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, []);

  const handleBuild = () => { if (prompt) { socket.emit('build_house', prompt); setPrompt(""); } };

  return (
    <div className="studio-container">
      
      {/* ⬅️ LEFT DOCK: SETTINGS & CHAT */}
      <div className={`left-sidebar ${leftOpen ? '' : 'closed'}`}>
        <div className="sidebar-section" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: 'white' }}>Menu</h3>
          <button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button>
        </div>
        
        <div className="sidebar-section">
          <h4 className="sidebar-title">Global Settings</h4>
          <p style={{ fontSize: '12px', color: '#aaa', margin: '5px 0' }}>Voice Narration: <span style={{color: '#00ffcc'}}>Female (Active)</span></p>
          <p style={{ fontSize: '12px', color: '#aaa', margin: '5px 0' }}>Auto-Save: <span style={{color: '#00ffcc'}}>On</span></p>
        </div>

        <div className="sidebar-section" style={{ flexGrow: 1, overflowY: 'auto' }}>
          <h4 className="sidebar-title">Orchestrator Log</h4>
          <p style={{ color: '#00ffcc', fontSize: '13px' }}>{copReply}</p>
        </div>
      </div>

      {/* 🔲 CENTER WORKSPACE */}
      <div className="main-workspace">
        
        {/* TOP BAR */}
        <div className="top-bar">
          <div style={{ display: 'flex', gap: '10px' }}>
            {!leftOpen && <button className="toggle-btn" onClick={() => setLeftOpen(true)}>☰ Menu</button>}
            <strong style={{ fontSize: '18px', letterSpacing: '2px' }}>PICTOPULSE</strong>
          </div>
          
          <div className="tabs-container">
            <button className={`tab-btn ${activeTab === '2D' ? 'active' : ''}`} onClick={() => setActiveTab('2D')}>2D Plan</button>
            <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => setActiveTab('3D')}>3D Studio</button>
            <button className={`tab-btn ${activeTab === 'Render' ? 'active' : ''}`} onClick={() => setActiveTab('Render')}>Export</button>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div className="user-profile">
              <div className="avatar">CEO</div>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Master Builder</span>
            </div>
            {!rightOpen && <button className="toggle-btn" onClick={() => setRightOpen(true)}>⚙️ Studio</button>}
          </div>
        </div>

        {/* 3D VIEWPORT */}
        <div style={{ flexGrow: 1, position: 'relative', display: activeTab === '3D' ? 'block' : 'none' }}>
          
          {/* Viewport Camera Buttons */}
          <div className="camera-controls">
            {['Perspective', 'Top', 'Front', 'Side'].map(view => (
               <button key={view} className={`cam-btn ${camView === view ? 'active' : ''}`} onClick={() => setCamView(view)}>{view}</button>
            ))}
          </div>

          <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
            <CameraDirector camView={camView} />
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
            
            <Environment preset={envPreset} background blur={0.5} />
            
            {/* The Dynamic Floor */}
            {floorType === 'grid' && <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />}
            {floorType === 'marble' && <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#eeeeee" roughness={0.1} metalness={0.5} /></mesh>}
            {floorType === 'grass' && <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#2d4c1e" roughness={0.9} /></mesh>}

            <Suspense fallback={null}>
                <DisplayManager objects={sceneObjects} gizmoMode={gizmoMode} selectedId={selectedId} setSelectedId={setSelectedId} explodeScale={explodeScale} />
            </Suspense>
            
            {camView === 'Perspective' && <OrbitControls makeDefault minDistance={5} maxDistance={50} />}
          </Canvas>

          {/* MULTI-MODAL COMMAND BAR */}
          <div className="floating-command">
             <button className="attach-btn" title="Upload Image/Blueprint">📎</button>
             <select className="mode-select" value={inputMode} onChange={(e) => setInputMode(e.target.value)}>
                <option value="Text">📝 Text-to-3D</option>
                <option value="Image">🖼️ Image-to-3D</option>
             </select>
             <input className="magic-input" placeholder={`Enter ${inputMode} prompt to generate...`} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
             <button className="build-btn" onClick={handleBuild}>Generate</button>
          </div>
        </div>

        {/* Placeholder Tabs */}
        {activeTab !== '3D' && <div style={{ padding: '50px', textAlign: 'center', color: '#777' }}><h2>{activeTab} Mode Active</h2><p>3D Engine Paused to save memory.</p></div>}
      </div>

      {/* ➡️ RIGHT DOCK: STUDIO TOOLS */}
      <div className={`right-sidebar ${rightOpen ? '' : 'closed'}`}>
        <div className="sidebar-section" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: 'white' }}>Inspector</h3>
          <button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button>
        </div>
        
        <div className="sidebar-section">
          <h4 className="sidebar-title">Environment</h4>
          <label style={{ fontSize: '12px', color: '#888' }}>Sky (HDRI)</label>
          <select className="pro-select" value={envPreset} onChange={(e) => setEnvPreset(e.target.value)}>
             <option value="city">🌆 Cyber City</option>
             <option value="sunset">🌅 Sunset</option>
             <option value="studio">💡 Photo Studio</option>
             <option value="forest">🌲 Forest</option>
          </select>
          
          <label style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>Floor Material</label>
          <select className="pro-select" value={floorType} onChange={(e) => setFloorType(e.target.value)}>
             <option value="grid">📐 Blueprint Grid</option>
             <option value="marble">🏛️ Reflective Marble</option>
             <option value="grass">🌿 Lush Grass</option>
          </select>
        </div>

        <div className="sidebar-section">
          <h4 className="sidebar-title">Assembly Tools</h4>
          <label style={{ fontSize: '12px', color: '#888' }}>Explode View (Disassemble)</label>
          <input type="range" className="pro-slider" min="1" max="5" step="0.1" value={explodeScale} onChange={(e) => setExplodeScale(e.target.value)} />
        </div>

        <div className="sidebar-section">
          <h4 className="sidebar-title">Transform Selected</h4>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
            <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('translate')}>Move</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('scale')}>Scale</button>
          </div>
          <button className="toggle-btn" style={{ background: '#bb0000', width: '100%', border: 'none' }} onClick={() => { setSceneObjects([]); setSelectedId(null); }}>Clear Grid</button>
        </div>
      </div>

    </div>
  );
}
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🧱 THE BULLETPROOF TOY BLOCK
function SceneItem({ data, isSelected, onSelect, gizmoMode, saveHistory, updateTransform }) {
  const meshRef = useRef(null);
  const [isReady, setIsReady] = useState(false); 

  let content = null;
  if (data.type === 'model') {
    const { scene } = useGLTF(data.url);
    content = <primitive object={scene.clone()} />;
  } else if (data.type === 'math') {
    const { shape, width, height, color } = data.params;
    content = (
      <mesh castShadow receiveShadow>
        {shape === 'sphere' && <sphereGeometry args={[width / 2, 32, 32]} />}
        {shape === 'box' && <boxGeometry args={[width, height, width]} />}
        {shape === 'cylinder' && <cylinderGeometry args={[width / 2, width / 2, height, 32]} />}
        {shape === 'cone' && <coneGeometry args={[width / 2, height, 32]} />}
        <meshStandardMaterial color={color} emissive={isSelected ? "#ffffff" : "#000000"} emissiveIntensity={isSelected ? 0.3 : 0} />
      </mesh>
    );
  }

  const handleDragEnd = () => {
    if (meshRef.current) {
      updateTransform(data.id, {
        x: meshRef.current.position.x, y: meshRef.current.position.y, z: meshRef.current.position.z,
        rotX: meshRef.current.rotation.x, rotY: meshRef.current.rotation.y, rotZ: meshRef.current.rotation.z,
        sX: meshRef.current.scale.x, sY: meshRef.current.scale.y, sZ: meshRef.current.scale.z
      });
    }
  };

  return (
    <>
      {isSelected && isReady && meshRef.current && (
        <TransformControls object={meshRef.current} mode={gizmoMode} onMouseUp={handleDragEnd} onMouseDown={saveHistory} />
      )}
      <group 
        ref={(r) => { meshRef.current = r; if (r && !isReady) setIsReady(true); }}
        position={[data.x, data.y, data.z]} 
        rotation={[data.rotX || 0, data.rotY || 0, data.rotZ || 0]} 
        scale={[data.sX || 1, data.sY || 1, data.sZ || 1]}
        onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      >
        {content}
      </group>
    </>
  );
}

// 🎥 CAMERA
function CameraDirector({ camView }) {
  useFrame((state) => {
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

// 🌍 MAIN APP
export default function App() {
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Pro Shortcuts Active: M (Move), R (Rotate), S (Scale), D (Duplicate)' }]);
  
  const [sceneObjects, setSceneObjects] = useState([]);
  const [historyStack, setHistoryStack] = useState([]); 
  const [selectedId, setSelectedId] = useState(null); 
  
  const [leftOpen, setLeftOpen] = useState(false); 
  const [rightOpen, setRightOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('3D'); 
  
  const [gizmoMode, setGizmoMode] = useState('translate'); 
  const [envPreset, setEnvPreset] = useState('studio'); 
  const [floorType, setFloorType] = useState('grid'); 
  const [camView, setCamView] = useState('Free'); 
  
  // 🌍 NEW: Master Building Scale Control
  const [globalScale, setGlobalScale] = useState(1);

  const sceneObjectsRef = useRef(sceneObjects);
  useEffect(() => { sceneObjectsRef.current = sceneObjects; }, [sceneObjects]);

  // 🕰️ TIME MACHINE & TOOLS
  const saveHistory = () => setHistoryStack(prev => [...prev.slice(-10), sceneObjectsRef.current]); 
  const undo = () => { if (historyStack.length > 0) { setSceneObjects(historyStack[historyStack.length - 1]); setHistoryStack(prev => prev.slice(0, -1)); } };
  const deleteSelected = () => { if (selectedId) { saveHistory(); setSceneObjects(prev => prev.filter(obj => obj.id !== selectedId)); setSelectedId(null); } };

  // 👯‍♂️ SMART DUPLICATE FEATURE
  const duplicateSelected = () => {
    if (selectedId) {
      saveHistory();
      const target = sceneObjectsRef.current.find(o => o.id === selectedId);
      if (target) {
        // Shift it slightly on the X and Z axis so the user can see it!
        const newObj = { ...target, id: Date.now(), x: target.x + 2, z: target.z + 2 };
        setSceneObjects(prev => [...prev, newObj]);
        setSelectedId(newObj.id); // Auto-select the clone
      }
    }
  };

  // ⌨️ PRO KEYBOARD SHORTCUTS (M, R, S, D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 🛡️ FOCUS LOCK: Don't trigger tools if the user is typing in an input box!
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 
      
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
      
      if (e.key === 'm' || e.key === 'M') setGizmoMode('translate');
      if (e.key === 'r' || e.key === 'R') setGizmoMode('rotate');
      if (e.key === 's' || e.key === 'S') setGizmoMode('scale');
      if (e.key === 'd' || e.key === 'D') duplicateSelected();
      
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, historyStack]);

  // 🔌 SOCKETS
  useEffect(() => {
    socket.on('cop_reply', (msg) => setChatLog(prev => [...prev, { sender: 'ai', text: msg }]));
    
    socket.on('draw_3d_house', (data) => {
      setHistoryStack(prev => [...prev.slice(-10), sceneObjectsRef.current]); 
      const initialY = data.type === 'math' ? data.params.height / 2 : 0;
      const newObject = { ...data, id: Date.now(), x: (Math.random() * 4) - 2, y: initialY, z: (Math.random() * 4) - 2 };
      
      setSceneObjects((prev) => [...prev, newObject]);
      setSelectedId(newObject.id); 
      setActiveTab('3D');
      setCamView('Free'); 
    });
    
    return () => { socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, []); 

  // 🗣️ BUILD LOGIC
  const handleBuild = () => { 
    if (!prompt) return;
    const p = prompt.toLowerCase();
    if (p.includes('disable gizmo')) { setSelectedId(null); setPrompt(""); return; }
    if (p.includes('enable gizmo')) { if (sceneObjects.length > 0) setSelectedId(sceneObjects[sceneObjects.length - 1].id); setPrompt(""); return; }

    setChatLog(prev => [...prev, { sender: 'user', text: prompt }]);
    socket.emit('build_house', prompt); 
    setPrompt(""); 
  };

  const updateObjectTransform = (id, newTransform) => { 
    setSceneObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...newTransform } : obj)); 
  };

  return (
    <div className="studio-container">
      
      {/* 🏷️ TOP BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="toggle-btn" onClick={() => { setLeftOpen(!leftOpen); setRightOpen(false); }}>☰ Menu</button>
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
          <button className="toggle-btn" onClick={() => { setRightOpen(!rightOpen); setLeftOpen(false); }}>⚙️ Tools</button>
          <div className="user-profile">
            <div className="avatar">G</div>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Guest</span>
          </div>
        </div>
      </div>

      {/* ⬅️ LEFT DOCK */}
      <div className={`left-sidebar ${leftOpen ? '' : 'closed'}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}>
            <h4 className="sidebar-title">Menu</h4>
            <button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button>
        </div>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px' }} onClick={() => { setSceneObjects([]); setSelectedId(null); setLeftOpen(false); }}>+ New Project</button>
          <h4 className="sidebar-title">Recent Projects</h4>
          <p style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }}>📁 Cyberpunk City</p>
        </div>
      </div>

      {/* ➡️ RIGHT DOCK */}
      <div className={`right-sidebar ${rightOpen ? '' : 'closed'}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}>
            <h4 className="sidebar-title">Inspector</h4>
            <button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button>
        </div>
        
        {/* 🌍 MASTER BUILDING SCALE */}
        <div className="sidebar-section">
          <h4 className="sidebar-title" style={{ color: '#00ffcc' }}>Master Scale</h4>
          <label style={{ fontSize: '12px', color: '#aaa' }}>Scale Entire Building</label>
          <input type="range" className="pro-slider" min="0.1" max="5" step="0.1" value={globalScale} onChange={(e) => setGlobalScale(e.target.value)} />
        </div>

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
          <h4 className="sidebar-title">Tools (Shortcuts)</h4>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('translate')}>Move (M)</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('rotate')}>Rotate (R)</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('scale')}>Scale (S)</button>
          </div>
          <button className="toggle-btn" style={{ background: '#222', width: '100%', color: '#00ffcc' }} onClick={duplicateSelected}>Duplicate (D)</button>
        </div>
      </div>

      {/* 🎮 3D CANVAS */}
      <div style={{ position: 'absolute', top: '0', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
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
            {/* 🌍 MASTER GROUP: Applies the global scale to everything inside! */}
            <group scale={[globalScale, globalScale, globalScale]}>
              {sceneObjects.map(obj => (
                <SceneItem 
                  key={obj.id} 
                  data={obj} 
                  isSelected={selectedId === obj.id} 
                  onSelect={setSelectedId} 
                  gizmoMode={gizmoMode} 
                  saveHistory={saveHistory} 
                  updateTransform={updateObjectTransform} 
                />
              ))}
            </group>
          </Suspense>
          
          <OrbitControls makeDefault minDistance={5} maxDistance={50} />
        </Canvas>
      </div>

      {/* 💬 TAB OVERLAYS */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay chat-container">
          {chatLog.map((log, i) => (
            <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🤖 : ' : '👤 : '} {log.text}</div>
          ))}
        </div>
      )}
      {(activeTab === '2D' || activeTab === 'Anim') && (
        <div className="ui-overlay" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ color: 'white' }}>{activeTab} Mode</h2><p style={{ color: '#777' }}>Feature architecture in progress.</p>
        </div>
      )}
      {activeTab === 'Render' && (
        <div className="ui-overlay" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{ color: 'white' }}>Director's Bay</h1>
          <p style={{ color: '#00ffcc' }}>🎙️ Rendering spatial audio with the designated female voice track...</p>
        </div>
      )}

      {/* ⌨️ COMMAND BAR */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command">
           <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' }}>
             <button className="toggle-btn">📎</button>
             <input className="magic-input" placeholder="Type prompt here..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
             <button className="build-btn" onClick={handleBuild}>Generate</button>
           </div>
        </div>
      )}

    </div>
  );
}
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🧱 THE BUG-FREE TOY BLOCK (Saves Scale, Rotation, and Position!)
function SceneItem({ data, isSelected, onSelect, gizmoMode, saveHistory, updateTransform }) {
  const meshRef = useRef();

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

  // 🐛 FIX: Saves all 9 dimensions so the rubber band NEVER snaps back!
  const handleDragEnd = () => {
    if (meshRef.current) {
      updateTransform(data.id, {
        x: meshRef.current.position.x, y: meshRef.current.position.y, z: meshRef.current.position.z,
        rotX: meshRef.current.rotation.x, rotY: meshRef.current.rotation.y, rotZ: meshRef.current.rotation.z,
        sX: meshRef.current.scale.x, sY: meshRef.current.scale.y, sZ: meshRef.current.scale.z
      });
    }
  };

  // Start drag = save history for Ctrl+Z
  const handleDragStart = () => saveHistory();

  return (
    <TransformControls 
      mode={gizmoMode} 
      showX={isSelected} showY={isSelected} showZ={isSelected} // Hide arrows if not selected
      onMouseUp={handleDragEnd} 
      onMouseDown={handleDragStart}
    >
      <group 
        ref={meshRef} 
        position={[data.x, data.y, data.z]} 
        rotation={[data.rotX || 0, data.rotY || 0, data.rotZ || 0]} 
        scale={[data.sX || 1, data.sY || 1, data.sZ || 1]}
        onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      >
        {content}
      </group>
    </TransformControls>
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

// 🌍 THE MAIN ENGINE APP
export default function App() {
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Welcome. Use PC Shortcuts (G, R, S, Delete) or Mobile PUBG controls!' }]);
  
  const [sceneObjects, setSceneObjects] = useState([]);
  const [historyStack, setHistoryStack] = useState([]); // 🕰️ The Ctrl+Z Time Machine Memory!
  
  const [selectedId, setSelectedId] = useState(null); 
  const [leftOpen, setLeftOpen] = useState(false); 
  const [rightOpen, setRightOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Chat'); 
  
  const [gizmoMode, setGizmoMode] = useState('translate'); 
  const [envPreset, setEnvPreset] = useState('studio'); 
  const [floorType, setFloorType] = useState('grid'); 
  const [camView, setCamView] = useState('Free'); 

  // 🕰️ TIME MACHINE LOGIC
  const saveHistory = () => setHistoryStack(prev => [...prev.slice(-10), sceneObjects]); // Keeps last 10 moves
  
  const undo = () => {
    if (historyStack.length > 0) {
      setSceneObjects(historyStack[historyStack.length - 1]);
      setHistoryStack(prev => prev.slice(0, -1));
    }
  };

  const deleteSelected = () => {
    if (selectedId) {
      saveHistory();
      setSceneObjects(prev => prev.filter(obj => obj.id !== selectedId));
      setSelectedId(null);
    }
  };

  // ⌨️ KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if the user is typing in the chat input
      if (e.target.tagName === 'INPUT') return; 
      
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
      if (e.key === 'g' || e.key === 'G') setGizmoMode('translate');
      if (e.key === 'r' || e.key === 'R') setGizmoMode('rotate');
      if (e.key === 's' || e.key === 'S') setGizmoMode('scale');
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, sceneObjects, historyStack]);

  useEffect(() => {
    socket.on('cop_reply', (msg) => setChatLog(prev => [...prev, { sender: 'ai', text: msg }]));
    
    socket.on('draw_3d_house', (data) => {
      saveHistory(); // Save time machine state before building!
      const initialY = data.type === 'math' ? data.params.height / 2 : 0;
      const newObject = { ...data, id: Date.now(), x: 0, y: initialY, z: 0 };
      setSceneObjects((prev) => [...prev, newObject]);
      setSelectedId(newObject.id); 
      setActiveTab('3D');
      setCamView('Free'); 
    });
    return () => { socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, [sceneObjects]); // added dependency so saveHistory gets latest state

  // 🗣️ NLP PROMPT INTERCEPTOR
  const handleBuild = () => { 
    if (!prompt) return;
    const p = prompt.toLowerCase();
    
    // Check if the user is issuing Gizmo Commands!
    if (p.includes('disable gizmo') || p.includes('hide gizmo') || p.includes('stop gizmo')) {
      setSelectedId(null); setPrompt(""); return;
    }
    if (p.includes('enable gizmo') || p.includes('start gizmo')) {
      if (sceneObjects.length > 0) setSelectedId(sceneObjects[sceneObjects.length - 1].id);
      setPrompt(""); return;
    }

    setChatLog(prev => [...prev, { sender: 'user', text: prompt }]);
    socket.emit('build_house', prompt); 
    setPrompt(""); 
  };

  const updateObjectTransform = (id, newTransform) => {
    setSceneObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...newTransform } : obj));
  };

  // 🎮 MANUAL MOVEMENT (For Mobile D-Pad and PC Buttons)
  const manualMove = (dir) => {
    if (!selectedId) return;
    saveHistory();
    const speed = 1;
    setSceneObjects(prev => prev.map(obj => {
      if (obj.id !== selectedId) return obj;
      let nx = obj.x || 0, nz = obj.z || 0;
      if (dir === 'up') nz -= speed;
      if (dir === 'down') nz += speed;
      if (dir === 'left') nx -= speed;
      if (dir === 'right') nx += speed;
      return { ...obj, x: nx, z: nz };
    }));
  };

  return (
    <div className="studio-container">
      
      {/* 🏷️ TOP BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="toggle-btn" onClick={() => setLeftOpen(!leftOpen)}>☰ Menu</button>
          <strong style={{ fontSize: '18px', letterSpacing: '2px', color: '#00ffcc' }}>PICTOPULSE</strong>
        </div>
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`} onClick={() => setActiveTab('Chat')}>1. Chat</button>
          <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => setActiveTab('3D')}>2. Studio</button>
          <button className={`tab-btn ${activeTab === 'Render' ? 'active' : ''}`} onClick={() => setActiveTab('Render')}>3. Render</button>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="toggle-btn" onClick={() => setRightOpen(!rightOpen)}>⚙️ Tools</button>
        </div>
      </div>

      {/* ⬅️ & ➡️ DOCKS OMITTED FOR SPACE, BUT THEY REMAIN THE EXACT SAME AS V3.1 */}
      
      {/* 🎮 3D CANVAS */}
      <div style={{ position: 'absolute', top: '0', left: 0, right: 0, bottom: 0, zIndex: 1, paddingTop: '100px' }}>
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
            {sceneObjects.map(obj => (
              <SceneItem key={obj.id} data={obj} isSelected={selectedId === obj.id} onSelect={setSelectedId} gizmoMode={gizmoMode} saveHistory={saveHistory} updateTransform={updateObjectTransform} />
            ))}
          </Suspense>
          <OrbitControls makeDefault minDistance={5} maxDistance={50} />
        </Canvas>
        
        {/* 🎮 MOBILE PUBG D-PAD OVERLAY */}
        {activeTab === '3D' && selectedId && (
          <div className="mobile-dpad">
            <button className="dpad-btn dpad-up" onClick={() => manualMove('up')}>W</button>
            <button className="dpad-btn dpad-left" onClick={() => manualMove('left')}>A</button>
            <button className="dpad-btn dpad-right" onClick={() => manualMove('right')}>D</button>
            <button className="dpad-btn dpad-down" onClick={() => manualMove('down')}>S</button>
          </div>
        )}
      </div>

      {/* 💬 TAB OVERLAYS */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay chat-container">
          {chatLog.map((log, i) => (
            <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🤖 Orchestrator: ' : '👤 You: '} {log.text}</div>
          ))}
        </div>
      )}

      {/* THE COMMAND BAR WITH MANUAL PC CONTROLS */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command" style={{ flexDirection: 'column' }}>
           <div style={{ display: 'flex', gap: '10px' }}>
             <button className="toggle-btn">📎</button>
             <input className="magic-input" placeholder="E.g. Build a red box, or type 'disable gizmo'" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
             <button className="build-btn" onClick={handleBuild}>Generate</button>
           </div>
           
           {/* PC Manual Buttons (Show only if object is selected) */}
           {activeTab === '3D' && selectedId && (
             <div className="manual-pc-controls">
                <button className="coord-btn" onClick={() => undo()}>↩ Undo</button>
                <button className="coord-btn" onClick={() => deleteSelected()}>🗑️ Delete</button>
             </div>
           )}
        </div>
      )}

    </div>
  );
}
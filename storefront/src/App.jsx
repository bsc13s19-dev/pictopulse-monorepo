import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🧮 THE SHOELACE MATH ROBOT (Calculates Square Footage!)
function calculateArea(nodes) {
  // A room needs at least 3 corners (a triangle) to have an area!
  if (nodes.length < 3) return 0; 
  
  let area = 0;
  for (let i = 0; i < nodes.length; i++) {
    let j = (i + 1) % nodes.length; // This connects the last dot back to the first dot!
    area += nodes[i].x * nodes[j].y;
    area -= nodes[i].y * nodes[j].x;
  }
  
  // We multiply by 15 so the numbers look like a real house size (Square Feet!)
  return Math.abs(area / 2) * 15; 
}

// 🧱 THE BULLETPROOF LEGO WALL BUILDER (Now with Name Tags!)
function Wall({ start, end, wallIndex }) {
  const dx = end.x - start.x; const dz = end.y - start.y;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (start.x + end.x) / 2; const midZ = (start.y + end.y) / 2;

  // 1. If it is NOT the first wall (or if it's too short), build a SOLID block!
  if (wallIndex !== 1 || length < 4) {
    return (
      <mesh position={[midX, 1.5, midZ]} rotation={[0, -angle, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 3, 0.2]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.8} />
      </mesh>
    );
  }

  // 2. If it IS Wall #1, use the LEGO TRICK to build a Doorway!
  const doorWidth = 1.2;
  const sideLength = (length - doorWidth) / 2; 
  const sideOffset = (length / 2) - (sideLength / 2); 

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      {/* Left Wall */}
      <mesh position={[-sideOffset, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[sideLength, 3, 0.2]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.8} />
      </mesh>
      {/* Right Wall */}
      <mesh position={[sideOffset, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[sideLength, 3, 0.2]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.8} />
      </mesh>
      {/* Top Header */}
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[doorWidth, 1, 0.2]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.8} />
      </mesh>
    </group>
  );
}

// 🛋️ 2. THE PROPS BUILDER (Uses the Gizmo)
function SceneItem({ data, isSelected, onSelect, gizmoMode, updateTransform }) {
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
        <TransformControls object={meshRef.current} mode={gizmoMode} onMouseUp={handleDragEnd} />
      )}
      <group 
        ref={(r) => { meshRef.current = r; if (r && !isReady) setIsReady(true); }}
        position={[data.x || 0, data.y || 0, data.z || 0]} 
        rotation={[data.rotX || 0, data.rotY || 0, data.rotZ || 0]} 
        scale={[data.sX || 1, data.sY || 1, data.sZ || 1]}
        onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      >
        {content}
      </group>
    </>
  );
}

// 🌍 MAIN APP PIPELINE
export default function App() {
  const [activeTab, setActiveTab] = useState('Chat'); 
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({ id: null, name: "New Blueprint" });
  
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Pictopulse Gold Master Ready. Chat, draw 2D walls, build 3D props, and save to MongoDB.' }]);
  const [nodes2D, setNodes2D] = useState([]); 
  const [sceneObjects, setSceneObjects] = useState([]); 

  const [selectedId, setSelectedId] = useState(null);
  const [gizmoMode, setGizmoMode] = useState('translate');

  // 🔌 SOCKET & DB LOGIC
  useEffect(() => {
    socket.emit('get_all_projects');
    socket.on('projects_list', (projects) => setSavedProjects(projects));
    socket.on('project_loaded', (projectData) => {
      setCurrentProject({ id: projectData._id, name: projectData.name });
      setNodes2D(projectData.nodes || []);
      setSceneObjects(projectData.objects || []);
      setChatLog([{ sender: 'ai', text: `Loaded project: ${projectData.name}` }]);
      setActiveTab('2D');
    });
    socket.on('cop_reply', (msg) => setChatLog(prev => [...prev, { sender: 'ai', text: msg }]));
    socket.on('draw_3d_house', (data) => {
      const initialY = data.type === 'math' ? (data.params.height || 2) / 2 : 0;
      const newObject = { ...data, id: Date.now(), x: data.x || 0, y: data.y || initialY, z: data.z || 0 };
      setSceneObjects((prev) => [...prev, newObject]);
      setSelectedId(newObject.id); 
      setActiveTab('3D');
    });
    return () => { socket.off('projects_list'); socket.off('project_loaded'); socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, []);

  // ⌨️ SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'DIV' && e.target.isContentEditable) return; 
      if (e.key === 'Delete' || e.key === 'Backspace') setSceneObjects(prev => prev.filter(obj => obj.id !== selectedId));
      if (e.key === 'm' || e.key === 'M') setGizmoMode('translate');
      if (e.key === 'r' || e.key === 'R') setGizmoMode('rotate');
      if (e.key === 's' || e.key === 'S') setGizmoMode('scale');
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  const saveToCloud = () => {
    socket.emit('save_project', { id: currentProject.id, name: currentProject.name, nodes: nodes2D, objects: sceneObjects });
    setChatLog(prev => [...prev, { sender: 'ai', text: `Saving ${currentProject.name} to MongoDB...` }]);
  };

  const handleBuild = () => { 
    if (!prompt) return;
    setChatLog(prev => [...prev, { sender: 'user', text: prompt }]);
    socket.emit('build_house', prompt);
    setPrompt("");
  };

  const handle2DCanvasClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 20 - 10;
    const y = ((e.clientY - rect.top) / rect.height) * 20 - 10;
    setNodes2D(prev => [...prev, { x, y }]);
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
          <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => setActiveTab('3D')}>3. 3D Model</button>
          <button className={`tab-btn ${activeTab === 'Anim' ? 'active' : ''}`} onClick={() => setActiveTab('Anim')}>4. Animation</button>
          <button className={`tab-btn ${activeTab === 'Pres' ? 'active' : ''}`} onClick={() => setActiveTab('Pres')}>5. Presentation</button>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="btn-massive" onClick={saveToCloud}>💾 Save</button>
          <button className="toggle-btn" onClick={() => { setRightOpen(!rightOpen); setLeftOpen(false); }}>⚙️ Tools</button>
        </div>
      </div>

      {/* ⬅️ LEFT DOCK (Fixed CSS classes!) */}
      <div className={`left-sidebar ${leftOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}>
            <h4 className="sidebar-title">Cloud Projects</h4>
            <button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button>
        </div>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px' }} onClick={() => { setNodes2D([]); setSceneObjects([]); setCurrentProject({ id: null, name: "New Blueprint" }); setActiveTab('2D'); }}>+ New Blueprint</button>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {savedProjects.length === 0 ? <p style={{ fontSize: '12px', color: '#555' }}>No projects saved yet.</p> : savedProjects.map(proj => (
                <p key={proj._id} onClick={() => socket.emit('load_project', proj._id)} style={{ fontSize: '13px', color: '#00ffcc', cursor: 'pointer', borderBottom: '1px solid #222', paddingBottom: '5px' }}>📁 {proj.name}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ➡️ RIGHT DOCK (Fixed CSS classes!) */}
      <div className={`right-sidebar ${rightOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}>
            <h4 className="sidebar-title">Inspector</h4>
            <button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button>
        </div>
        <div className="sidebar-section">
          <label style={{ fontSize: '12px', color: '#aaa' }}>Project Name</label>
          <input className="magic-input" style={{ width: '100%', padding: '5px', marginTop: '5px', fontSize: '14px', borderBottom: '1px solid #444' }} value={currentProject.name} onChange={(e) => setCurrentProject({...currentProject, name: e.target.value})} />
        </div>
        
        <div className="sidebar-section">
          <h4 className="sidebar-title">Gizmo Tools (Props)</h4>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('translate')}>Move</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
            <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#ff0055' : '#222', flex: 1 }} onClick={() => setGizmoMode('scale')}>Scale</button>
          </div>
        </div>

        <div className="sidebar-section">
          <h4 className="sidebar-title">Architecture Stats</h4>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Walls: {Math.max(0, nodes2D.length - 1)}</p>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Props: {sceneObjects.length}</p>
          <button className="toggle-btn" style={{ width: '100%', marginTop: '10px' }} onClick={() => setNodes2D([])}>🗑️ Clear Walls</button>
        </div>
      </div>

      {/* 💬 TAB 1: CHAT */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay">
          <div className="chat-container">
            {chatLog.map((log, i) => (
              <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🏗️ : ' : '👤 : '} {log.text}</div>
            ))}
          </div>
        </div>
      )}

      {/* 📐 TAB 2: 2D BLUEPRINT */}
      {activeTab === '2D' && (
        <div className="ui-overlay">
          <h2>Interactive Blueprint: {currentProject.name}</h2>
          <p style={{ color: '#aaa' }}>Click the grid to draw locked concrete walls.</p>
          <div className="blueprint-paper" onClick={handle2DCanvasClick} style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              {nodes2D.map((node, i) => {
                if (i === 0) return null;
                const prev = nodes2D[i - 1];
                const x1 = ((prev.x + 10) / 20) * 800; const y1 = ((prev.y + 10) / 20) * 400;
                const x2 = ((node.x + 10) / 20) * 800; const y2 = ((node.y + 10) / 20) * 400;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00ffcc" strokeWidth="3" />;
              })}
              {nodes2D.map((node, i) => {
                const cx = ((node.x + 10) / 20) * 800; const cy = ((node.y + 10) / 20) * 400;
                return <circle key={`dot-${i}`} cx={cx} cy={cy} r="4" fill="white" />;
              })}
            </svg>
          </div>
        </div>
      )}

      {/* 🎮 TAB 3: 3D EXTRUSION & GIZMO (Now Optimized!) */}
      {/* Notice we added {activeTab === '3D' && ...} so the engine completely turns off when you leave! */}
      {activeTab === '3D' && (
        <div style={{ position: 'absolute', top: '0', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
          <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
            <Environment preset="city" background blur={0.5} />
            <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />
            <OrbitControls makeDefault minDistance={5} maxDistance={50} />
            
            <Suspense fallback={null}>
              {/* Render the Locked Concrete Walls with Name Tags! */}
              {nodes2D.map((node, i) => {
                if (i === 0) return null;
                return <Wall key={`wall-${i}`} start={nodes2D[i-1]} end={node} wallIndex={i} />;
              })}
              
              {/* Render the AI Props */}
              {sceneObjects.map(obj => (
                <SceneItem key={obj.id} data={obj} isSelected={selectedId === obj.id} onSelect={setSelectedId} gizmoMode={gizmoMode} updateTransform={updateObjectTransform} />
              ))}
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* 🎬 TAB 4: ANIMATION */}
      {activeTab === 'Anim' && (
        <div className="ui-overlay">
          <h2>Director's Timeline</h2>
          <p style={{ color: '#888' }}>Set up cinematic camera tracking paths.</p>
          <div style={{ width: '80%', height: '100px', background: '#222', margin: '20px auto', borderRadius: '8px', border: '1px solid #444', display: 'flex', alignItems: 'center', padding: '10px' }}>
             <div style={{ width: '20%', background: '#00ffcc', height: '10px', borderRadius: '5px' }}></div>
             <span style={{ marginLeft: '10px', fontSize: '12px', color: '#aaa' }}>Camera Path A (Kitchen Walkthrough)</span>
          </div>
        </div>
      )}

      {/* 📊 TAB 5: CANVA PRESENTATION RESTORED */}
      {activeTab === 'Pres' && (
        <div className="ui-overlay">
          <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Slide Studio: {currentProject.name}</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
               <button className="build-btn" style={{ background: '#ff0055', color: 'white' }}>🎬 Render Video (Female Voice)</button>
               <button className="build-btn">⬇️ Download PDF</button>
            </div>
          </div>
          <div className="canva-workspace">
            <div className="slide-sidebar">
              <div className="slide-thumbnail active"><strong>Slide 1</strong><span>Cover Page</span></div>
              <div className="slide-thumbnail"><strong>Slide 2</strong><span>2D Blueprint</span></div>
              <div className="slide-thumbnail"><strong>Slide 3</strong><span>Data & Cost</span></div>
            </div>
            <div className="slide-canvas-container">
              <div className="active-slide">
                <div className="editable-text slide-title" contentEditable suppressContentEditableWarning>{currentProject.name} Proposal</div>
                <div className="editable-text slide-subtitle" contentEditable suppressContentEditableWarning>Prepared by Pictopulse Architecture AI</div>
                
                {/* 1. The Typing Box (You can type here, React won't touch it!) */}
                <div className="editable-text" style={{ fontSize: '14px', color: '#333', marginTop: '20px', minHeight: '50px' }} contentEditable suppressContentEditableWarning>
                  This presentation outlines the structural and spatial design. The following slides contain the CAD blueprints, 3D renders, and the bill of materials.
                </div>

                {/* 2. The Math Robot Box (React updates this instantly!) */}
                <div style={{ marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', fontSize: '14px', color: '#111' }}>
                  <strong>📊 Live Project Data:</strong><br/><br/>
                  * Total Walls: {Math.max(0, nodes2D.length - 1)}<br/>
                  * Total 3D Props: {sceneObjects.length}<br/>
                  * 📏 Estimated Area: <strong style={{color: '#ff0055'}}>{Math.round(calculateArea(nodes2D))} Square Feet</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⌨️ COMMAND BAR */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command">
           <input className="magic-input" placeholder="Type a prompt to build props..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
           <button className="build-btn" onClick={handleBuild}>Send</button>
        </div>
      )}
    </div>
  );
}
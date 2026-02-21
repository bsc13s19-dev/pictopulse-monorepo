import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Sky, Stars, useGLTF, TransformControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🧮 MATH ROBOT (Calculates Square Footage)
function calculateArea(rooms, currentRoom) {
  let totalArea = 0;
  const calc = (r) => {
    if (r.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < r.length; i++) {
      let j = (i + 1) % r.length; 
      a += r[i].x * r[j].y; a -= r[i].y * r[j].x;
    }
    return Math.abs(a / 2) * 15;
  };
  rooms.forEach(room => totalArea += calc(room));
  totalArea += calc(currentRoom);
  return totalArea; 
}

// 🧱 WALL ROBOT (Now reacts to Draft vs Render mode!)
function Wall({ start, end, wallIndex, isRenderMode }) {
  const dx = end.x - start.x; const dz = end.y - start.y;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.1) return null; 
  const angle = Math.atan2(dz, dx);
  const midX = (start.x + end.x) / 2; const midZ = (start.y + end.y) / 2;

  // Render vs Draft Materials
  const wallMat = { color: "#f8fafc", roughness: isRenderMode ? 0.3 : 1, metalness: isRenderMode ? 0.1 : 0 };

  if (wallIndex === 1 && length > 4) {
    const doorW = 1.2; const sideL = (length - doorW) / 2; const sideO = (length / 2) - (sideL / 2); 
    return (
      <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
        <mesh position={[-sideO, 1.5, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[sideL, 3, 0.2]} /><meshStandardMaterial {...wallMat} /></mesh>
        <mesh position={[sideO, 1.5, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[sideL, 3, 0.2]} /><meshStandardMaterial {...wallMat} /></mesh>
        <mesh position={[0, 2.5, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[doorW, 1, 0.2]} /><meshStandardMaterial {...wallMat} /></mesh>
      </group>
    );
  }
  return (
    <mesh position={[midX, 1.5, midZ]} rotation={[0, -angle, 0]} castShadow={isRenderMode} receiveShadow>
      <boxGeometry args={[length, 3, 0.2]} />
      <meshStandardMaterial {...wallMat} />
    </mesh>
  );
}

// 🏠 CARDBOARD CUTOUT BUILDER
function FloorAndRoof({ nodes, isRenderMode }) {
  if (nodes.length < 3) return null;
  const shape = React.useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) { if (nodes[i].x !== nodes[i-1].x || nodes[i].y !== nodes[i-1].y) s.lineTo(nodes[i].x, nodes[i].y); }
    return s;
  }, [nodes]);
  return (
    <group>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color="#e2e8f0" roughness={isRenderMode ? 0.4 : 0.9} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={isRenderMode} receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color="#334155" roughness={0.9} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

// 📦 DRACO UNZIPPER 
function UnzippedModel({ url }) {
  const { scene } = useGLTF(url, 'https://www.gstatic.com/draco/v1/decoders/');
  return <primitive object={scene.clone()} />;
}

// 🛋️ GIZMO PROPS BUILDER
function SceneItem({ data, isSelected, onSelect, gizmoMode, updateTransform, isRenderMode }) {
  const meshRef = useRef(null); const [isReady, setIsReady] = useState(false);
  let content = data.type === 'model' ? <UnzippedModel url={data.url} /> : (
    <mesh castShadow={isRenderMode} receiveShadow>
      {data.params.shape === 'box' && <boxGeometry args={[data.params.width, data.params.height, data.params.width]} />}
      {data.params.shape === 'cylinder' && <cylinderGeometry args={[data.params.width / 2, data.params.width / 2, data.params.height, 32]} />}
      {data.params.shape === 'sphere' && <sphereGeometry args={[data.params.width / 2, 32, 32]} />}
      <meshStandardMaterial color={data.params.color} roughness={isRenderMode ? 0.2 : 0.8} emissive={isSelected ? "#3b82f6" : "#000000"} emissiveIntensity={isSelected ? 0.3 : 0} />
    </mesh>
  );

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
      {isSelected && isReady && meshRef.current && <TransformControls object={meshRef.current} mode={gizmoMode} onMouseUp={handleDragEnd} />}
      <group ref={(r) => { meshRef.current = r; if (r && !isReady) setIsReady(true); }} 
             position={[data.x || 0, data.y || 0, data.z || 0]} 
             rotation={[data.rotX || 0, data.rotY || 0, data.rotZ || 0]}
             scale={[data.sX || 1, data.sY || 1, data.sZ || 1]}
             onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}>
        {content}
      </group>
    </>
  );
}

// 🎬 DIRECTOR'S CAMERA
function CinematicCamera({ isAnimating }) {
  useFrame(({ camera, clock }) => {
    if (isAnimating) {
      const t = clock.getElapsedTime() * 0.2; 
      camera.position.x = Math.sin(t) * 20;
      camera.position.z = Math.cos(t) * 20;
      camera.position.y = 15 + Math.sin(t * 2) * 5; 
      camera.lookAt(0, 0, 0); 
    }
  });
  return null;
}

export default function App() {
  // 🔐 AUTH STATE
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState("");

  const [activeTab, setActiveTab] = useState('Chat'); 
  const [leftOpen, setLeftOpen] = useState(false); const [rightOpen, setRightOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({ id: null, name: "New Blueprint" });
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Welcome to Pictopulse Pro. How can I assist your design today?' }]);
  
  const [rooms, setRooms] = useState([]); 
  const [currentRoom, setCurrentRoom] = useState([]); 
  const [sceneObjects, setSceneObjects] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  
  // 🌍 ENGINE STATES
  const [gizmoMode, setGizmoMode] = useState('translate');
  const [envMode, setEnvMode] = useState('day'); 
  const [isRenderMode, setIsRenderMode] = useState(false); // Magic Glasses!
  const [isAnimating, setIsAnimating] = useState(false);

  // 🎮 THE VIDEO GAME CONTROLLER (Keyboard Shortcuts)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in the chat!
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (activeTab !== '3D') return;

      const key = e.key.toLowerCase();
      if (key === 'm') setGizmoMode('translate');
      if (key === 'r') setGizmoMode('rotate');
      if (key === 's') setGizmoMode('scale');
      
      // 🗑️ The Eraser
      if ((key === 'delete' || key === 'backspace') && selectedId) {
        setSceneObjects(prev => prev.filter(obj => obj.id !== selectedId));
        setSelectedId(null);
      }
      
      // 👯‍♂️ The Magic Duplicator
      if (key === 'd' && selectedId) {
        setSceneObjects(prev => {
          const target = prev.find(o => o.id === selectedId);
          if (!target) return prev;
          // Offset by 2 units so it doesn't spawn inside itself!
          const clone = { ...target, id: Date.now(), x: (target.x || 0) + 2, z: (target.z || 0) + 2 };
          setSelectedId(clone.id);
          return [...prev, clone];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedId]);

  const handleUpdateTransform = (id, newTransform) => {
    setSceneObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...newTransform } : obj));
  };

  // 🤖 INVISIBLE AUTO-SAVE
  useEffect(() => {
    if (currentUser && (rooms.length > 0 || sceneObjects.length > 0)) {
      const saveTimer = setTimeout(() => {
        socket.emit('save_project', { id: currentProject.id, name: currentProject.name, nodes: rooms, objects: sceneObjects });
      }, 2000); 
      return () => clearTimeout(saveTimer);
    }
  }, [rooms, sceneObjects, currentProject.name, currentUser]);

  // 🔌 WALKIE-TALKIE
  useEffect(() => {
    if (!currentUser) return;
    socket.emit('get_all_projects');
    socket.on('projects_list', (projects) => setSavedProjects(projects));
    socket.on('project_loaded', (projectData) => {
      setCurrentProject({ id: projectData._id, name: projectData.name });
      setRooms(projectData.nodes || []); setSceneObjects(projectData.objects || []);
    });
    socket.on('cop_reply', (msg) => setChatLog(prev => [...prev, { sender: 'ai', text: msg }]));
    socket.on('draw_3d_house', (data) => {
      const newObject = { ...data, id: Date.now(), x: data.x || 0, y: data.y || 1, z: data.z || 0 };
      setSceneObjects((prev) => [...prev, newObject]); setSelectedId(newObject.id); setActiveTab('3D');
    });
    socket.on('start_blueprint_pipeline', (data) => {
      setCurrentProject(prev => ({ ...prev, name: data.projectName })); 
      if (data.autoNodes && data.autoNodes.length > 0) setRooms(data.autoNodes);
      setActiveTab('2D');
    });
    return () => { 
      socket.off('projects_list'); socket.off('project_loaded'); socket.off('cop_reply'); 
      socket.off('draw_3d_house'); socket.off('start_blueprint_pipeline'); 
    };
  }, [currentUser]);

  const handleBuild = () => { 
    if (!prompt) return; 
    setChatLog(prev => [...prev, { sender: 'user', text: prompt }]); 
    socket.emit('build_house', prompt); setPrompt(""); 
  };

  const handle2DCanvasClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 20 - 10;
    const clickY = ((e.clientY - rect.top) / rect.height) * 20 - 10;
    if (currentRoom.length > 2) {
      const firstDot = currentRoom[0];
      if (Math.sqrt(Math.pow(clickX - firstDot.x, 2) + Math.pow(clickY - firstDot.y, 2)) < 1.5) {
        setRooms(prev => [...prev, [...currentRoom, { x: firstDot.x, y: firstDot.y }]]);
        setCurrentRoom([]); return; 
      }
    }
    setCurrentRoom(prev => [...prev, { x: clickX, y: clickY }]);
  };

  // 🔐 LOGIN SCREEN 
  if (!currentUser) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h2 className="logo-text" style={{fontSize: '28px', marginBottom: '10px'}}>PICTOPULSE STUDIO</h2>
          <p style={{color: '#64748b'}}>Enterprise Architecture AI</p>
          <input className="login-input" placeholder="Enter Architect Name..." value={loginInput} onChange={e => setLoginInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setCurrentUser(loginInput)} />
          <button className="build-btn" style={{width: '100%', padding: '15px', fontSize: '16px'}} onClick={() => loginInput && setCurrentUser(loginInput)}>Enter Studio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-container">
      
      {/* 🏷️ TOP BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="toggle-btn" onClick={() => { setLeftOpen(!leftOpen); setRightOpen(false); }}>☰ Menu</button>
          <span className="logo-text">PICTOPULSE</span>
        </div>
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`} onClick={() => setActiveTab('Chat')}>💬 Chat</button>
          <button className={`tab-btn ${activeTab === '2D' ? 'active' : ''}`} onClick={() => setActiveTab('2D')}>📐 Drafting</button>
          <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => { setActiveTab('3D'); setIsAnimating(false); }}>🧊 3D Engine</button>
          <button className={`tab-btn ${activeTab === 'Anim' ? 'active' : ''}`} onClick={() => setActiveTab('Anim')}>🎬 Director</button>
          <button className={`tab-btn ${activeTab === 'Pres' ? 'active' : ''}`} onClick={() => setActiveTab('Pres')}>📊 Presentation</button>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{color: '#64748b', fontSize: '14px', fontWeight: '600'}}>👤 {currentUser}</span>
          <button className="toggle-btn" onClick={() => { setRightOpen(!rightOpen); setLeftOpen(false); }}>⚙️ Inspector</button>
        </div>
      </div>

      {/* ⬅️ LEFT MENU */}
      <div className={`left-sidebar ${leftOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}><h4 className="sidebar-title">Cloud Projects</h4><button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button></div>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px', background: '#e2e8f0', color: '#1e293b' }} onClick={() => { setRooms([]); setCurrentRoom([]); setSceneObjects([]); setCurrentProject({ id: null, name: "New Blueprint" }); setActiveTab('2D'); }}>+ New Blueprint</button>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {savedProjects.length === 0 ? <p style={{ fontSize: '12px', color: '#94a3b8' }}>No saved projects.</p> : savedProjects.map(proj => (
                <p key={proj._id} onClick={() => { socket.emit('load_project', proj._id); setActiveTab('2D'); setLeftOpen(false); }} style={{ fontSize: '14px', color: '#3b82f6', cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>📁 {proj.name}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ➡️ RIGHT TOOLS */}
      <div className={`right-sidebar ${rightOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}><h4 className="sidebar-title">Inspector</h4><button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button></div>
        
        <div className="sidebar-section">
          <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>PROJECT NAME</label>
          <input className="login-input" style={{ marginTop: '5px', padding: '10px' }} value={currentProject.name} onChange={(e) => setCurrentProject({...currentProject, name: e.target.value})} />
        </div>

        {activeTab === '3D' && (
          <>
            <div className="sidebar-section">
              <h4 className="sidebar-title">Engine Graphics 🕶️</h4>
              <button className="build-btn" style={{ width: '100%', background: isRenderMode ? '#10b981' : '#cbd5e1', color: isRenderMode ? 'white' : 'black' }} onClick={() => setIsRenderMode(!isRenderMode)}>
                {isRenderMode ? '✨ High-Quality Render ON' : '⚡ Fast Draft Mode'}
              </button>
            </div>

            <div className="sidebar-section">
              <h4 className="sidebar-title">Environments 🌍</h4>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                <button className="toggle-btn" style={{ background: envMode === 'day' ? '#3b82f6' : 'white', color: envMode === 'day' ? 'white' : 'black', flex: 1 }} onClick={() => setEnvMode('day')}>☀️ Day</button>
                <button className="toggle-btn" style={{ background: envMode === 'sunset' ? '#f59e0b' : 'white', color: envMode === 'sunset' ? 'white' : 'black', flex: 1 }} onClick={() => setEnvMode('sunset')}>🌅 Sunset</button>
                <button className="toggle-btn" style={{ background: envMode === 'night' ? '#1e293b' : 'white', color: envMode === 'night' ? 'white' : 'black', flex: 1 }} onClick={() => setEnvMode('night')}>🌙 Night</button>
              </div>
            </div>

            <div className="sidebar-section">
              <h4 className="sidebar-title">Gizmo Tools (Shortcuts: M, R, S)</h4>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#e2e8f0' : 'white', flex: 1 }} onClick={() => setGizmoMode('translate')}>Move</button>
                <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#e2e8f0' : 'white', flex: 1 }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
                <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#e2e8f0' : 'white', flex: 1 }} onClick={() => setGizmoMode('scale')}>Scale</button>
              </div>
              <p style={{fontSize: '11px', color: '#94a3b8', marginTop: '10px'}}>Press <b>D</b> to Duplicate. Press <b>Backspace</b> to Delete.</p>
            </div>
          </>
        )}
      </div>

      {/* 💬 TAB 1: CHAT */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay">
          <div className="chat-container">
            {chatLog.map((log, i) => (
              <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🤖 AI: ' : `👤 ${currentUser}: `} {log.text}</div>
            ))}
          </div>
        </div>
      )}

      {/* 📐 TAB 2: 2D DRAFTING TABLE */}
      {activeTab === '2D' && (
        <div className="ui-overlay">
          <h2 style={{color: '#0f172a'}}>Drafting Table: {currentProject.name}</h2>
          <p style={{ color: '#64748b', marginBottom: '30px' }}>Draw walls to see the Magic Tape Measure!</p>
          <div className="blueprint-paper" onClick={handle2DCanvasClick} style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              
              {/* 🧭 VASTU COMPASS OVERLAY */}
              <g transform="translate(730, 330)">
                <circle cx="0" cy="0" r="30" fill="white" stroke="#e2e8f0" strokeWidth="2" />
                <path d="M 0 -20 L 10 0 L 0 20 L -10 0 Z" fill="#ef4444" />
                <text x="0" y="-25" fontSize="14" fontWeight="bold" fill="#0f172a" textAnchor="middle">N</text>
              </g>

              {rooms.map((room, roomIdx) => (
                <g key={`room-${roomIdx}`}>
                  {room.map((node, i) => {
                    if (i === 0) return null;
                    const prev = room[i - 1];
                    const x1 = ((prev.x + 10) / 20) * 800; const y1 = ((prev.y + 10) / 20) * 400;
                    const x2 = ((node.x + 10) / 20) * 800; const y2 = ((node.y + 10) / 20) * 400;
                    const dist = Math.round(Math.sqrt(Math.pow(node.x - prev.x, 2) + Math.pow(node.y - prev.y, 2)) * 3.28); // Convert to rough Feet
                    
                    return (
                      <g key={`line-${i}`}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
                        {/* 📏 THE MAGIC TAPE MEASURE */}
                        <text x={(x1 + x2)/2} y={(y1 + y2)/2 - 10} fill="#64748b" fontSize="12" fontWeight="bold" textAnchor="middle">{dist} ft</text>
                      </g>
                    );
                  })}
                </g>
              ))}
              {currentRoom.map((node, i) => {
                if (i === 0) return <circle key="start" cx={((node.x + 10) / 20) * 800} cy={((node.y + 10) / 20) * 400} r="8" fill="#f59e0b" />;
                const prev = currentRoom[i - 1];
                const x1 = ((prev.x + 10) / 20) * 800; const y1 = ((prev.y + 10) / 20) * 400;
                const x2 = ((node.x + 10) / 20) * 800; const y2 = ((node.y + 10) / 20) * 400;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="3" strokeDasharray="6,6" />;
              })}
              {currentRoom.map((node, i) => <circle key={`dot-${i}`} cx={((node.x + 10) / 20) * 800} cy={((node.y + 10) / 20) * 400} r="5" fill="#1e293b" />)}
            </svg>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', marginTop: '30px', width: '800px' }}>
            <button className="toggle-btn" style={{ color: '#ef4444' }} onClick={() => { setRooms([]); setCurrentRoom([]); }}>🗑️ Clear Canvas</button>
            <button className="build-btn" style={{ flex: 1, fontSize: '16px' }} onClick={() => {
              setActiveTab('3D');
              setChatLog(prev => [...prev, { sender: 'ai', text: 'Blueprint Approved! 3D Engine engaged. Ready to furnish.' }]);
            }}>
              ✅ Approve Blueprint & Switch to 3D
            </button>
          </div>
        </div>
      )}

      {/* 🎮 TAB 3 & 4: 3D MODEL & DIRECTOR ENGINE */}
      {(activeTab === '3D' || activeTab === 'Anim') && (
        <div style={{ position: 'absolute', top: '70px', left: 0, right: 0, bottom: 0, zIndex: 1, background: envMode === 'night' ? '#0f172a' : '#e0e7ff' }}>
          
          {/* DIRECTOR OVERLAY */}
          {activeTab === 'Anim' && (
             <div style={{position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center'}}>
                <h3 style={{margin: '0 0 10px 0', color: '#0f172a'}}>Director's Camera</h3>
                <button className="build-btn" style={{background: isAnimating ? '#ef4444' : '#10b981'}} onClick={() => setIsAnimating(!isAnimating)}>
                  {isAnimating ? '⏹️ Stop Recording' : '▶️ Play Cinematic Fly-Through'}
                </button>
             </div>
          )}

          <Canvas shadows={isRenderMode ? "soft" : false} camera={{ position: [15, 15, 15], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
            <ambientLight intensity={envMode === 'night' ? 0.1 : 0.6} />
            {isRenderMode && <spotLight position={[10, 20, 10]} angle={0.4} penumbra={1} intensity={envMode === 'sunset' ? 1.5 : 2} color={envMode === 'sunset' ? '#fcd34d' : 'white'} castShadow />}
            {!isRenderMode && <directionalLight position={[10, 20, 10]} intensity={1} />}
            
            {/* 🌍 ENVIRONMENT ENGINE */}
            {isRenderMode && envMode === 'day' && <Sky sunPosition={[100, 20, 100]} />}
            {isRenderMode && envMode === 'sunset' && <Sky sunPosition={[100, 2, 100]} turbidity={10} rayleigh={3} />}
            {envMode === 'night' && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
            {isRenderMode && <Environment preset={envMode === 'night' ? 'night' : 'city'} blur={0.8} />}
            
            <Grid infiniteGrid sectionColor={envMode === 'night' ? '#334155' : '#cbd5e1'} cellColor={envMode === 'night' ? '#1e293b' : '#e2e8f0'} fadeDistance={50} />
            
            {/* 🧭 3D VASTU COMPASS GIZMO */}
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={['#ef4444', '#10b981', '#3b82f6']} labelColor="white" />
            </GizmoHelper>

            {/* 🎬 DIRECTOR CAMERA */}
            <CinematicCamera isAnimating={isAnimating} />
            {!isAnimating && <OrbitControls makeDefault minDistance={5} maxDistance={50} />}
            
            <Suspense fallback={null}>
              {rooms.map((room, roomIdx) => (
                <group key={`build-${roomIdx}`}>
                  <FloorAndRoof nodes={room} isRenderMode={isRenderMode} />
                  {room.map((node, i) => {
                    if (i === 0) return null;
                    return <Wall key={`wall-${i}`} start={room[i-1]} end={node} wallIndex={i} isRenderMode={isRenderMode} />;
                  })}
                </group>
              ))}
              {sceneObjects.map(obj => <SceneItem key={obj.id} data={obj} isSelected={selectedId === obj.id} onSelect={setSelectedId} gizmoMode={gizmoMode} updateTransform={handleUpdateTransform} isRenderMode={isRenderMode} />)}
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* 📊 TAB 5: PRESENTATION (PDF LAYOUT) */}
      {activeTab === 'Pres' && (
        <div className="ui-overlay" style={{ background: '#cbd5e1' }}>
          <div style={{display: 'flex', justifyContent: 'space-between', width: '800px', marginBottom: '20px'}}>
             <h2 style={{margin: 0, color: '#0f172a'}}>Project Proposal Document</h2>
             <button className="build-btn" onClick={() => window.print()}>🖨️ Export PDF</button>
          </div>
          
          <div className="presentation-slide">
             <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '40px', color: '#0f172a', margin: '0 0 10px 0' }}>{currentProject.name}</h1>
                <p style={{ color: '#64748b', fontSize: '18px', margin: 0 }}>Prepared by Lead Architect: {currentUser}</p>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <div>
                   <h3 style={{color: '#3b82f6'}}>Project Overview</h3>
                   <p style={{color: '#334155', lineHeight: 1.6}}>This document outlines the structural blueprint and automated bill of materials generated by the Pictopulse Enterprise AI Engine.</p>
                   
                   <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', marginTop: '30px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{margin: '0 0 15px 0'}}>Live Telemetry Data</h4>
                      <ul style={{ color: '#334155', lineHeight: 2, paddingLeft: '20px' }}>
                         <li>Total Rooms: <strong>{rooms.length}</strong></li>
                         <li>Total Furniture Items: <strong>{sceneObjects.length}</strong></li>
                         <li>Estimated Floor Area: <strong style={{color: '#3b82f6'}}>{Math.round(calculateArea(rooms, currentRoom))} Sq Ft</strong></li>
                      </ul>
                   </div>
                </div>
                
                <div>
                   <h3 style={{color: '#3b82f6'}}>Bill of Materials (3D Props)</h3>
                   <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                      {sceneObjects.length === 0 ? <p style={{padding: '20px', color: '#94a3b8', margin: 0}}>No props installed yet.</p> : 
                        sceneObjects.map((obj, i) => (
                          <div key={i} style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <strong>Item {i+1}:</strong> {obj.type === 'model' ? 'High-Fidelity 3D Model' : `Custom ${obj.params.color} ${obj.params.shape}`}
                          </div>
                        ))
                      }
                   </div>
                </div>
             </div>
             
             <div style={{ marginTop: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Generated securely via Pictopulse Cloud • {new Date().toLocaleDateString()}
             </div>
          </div>
        </div>
      )}

      {/* ⌨️ COMMAND BAR */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command">
           <input className="magic-input" placeholder="Type: 'Build a 2BHK' or 'Build a red box'..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
           <button className="build-btn" onClick={handleBuild}>✨ Send</button>
        </div>
      )}
    </div>
  );
}
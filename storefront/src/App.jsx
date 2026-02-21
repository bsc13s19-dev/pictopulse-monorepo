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
    if (!r || r.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < r.length; i++) {
      let j = (i + 1) % r.length; 
      a += r[i].x * r[j].y; a -= r[i].y * r[j].x;
    }
    return Math.abs(a / 2) * 15;
  };
  rooms.forEach(roomObj => totalArea += calc(roomObj.nodes));
  totalArea += calc(currentRoom);
  return totalArea; 
}

// 🧱 WALL ROBOT (Now stacks on different floors!)
function Wall({ start, end, wallIndex, isRenderMode, floorLevel }) {
  const dx = end.x - start.x; const dz = end.y - start.y;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.1) return null; 
  const angle = Math.atan2(dz, dx);
  const midX = (start.x + end.x) / 2; const midZ = (start.y + end.y) / 2;
  const yOffset = floorLevel * 3; // 10-foot ceilings per floor!

  const wallMat = { color: "#f8fafc", roughness: isRenderMode ? 0.3 : 1, metalness: isRenderMode ? 0.1 : 0 };

  if (wallIndex === 1 && length > 4) {
    const doorW = 1.2; const sideL = (length - doorW) / 2; const sideO = (length / 2) - (sideL / 2); 
    return (
      <group position={[midX, yOffset, midZ]} rotation={[0, -angle, 0]}>
        <mesh position={[-sideO, 1.5, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[sideL, 3, 0.2]} /><meshStandardMaterial {...wallMat} /></mesh>
        <mesh position={[sideO, 1.5, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[sideL, 3, 0.2]} /><meshStandardMaterial {...wallMat} /></mesh>
        {/* Glass Window Above Door */}
        <mesh position={[0, 2.5, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[doorW, 1, 0.2]} /><meshStandardMaterial color="#e0f2fe" transparent opacity={0.5} roughness={0.1} /></mesh>
      </group>
    );
  }
  return (
    <mesh position={[midX, yOffset + 1.5, midZ]} rotation={[0, -angle, 0]} castShadow={isRenderMode} receiveShadow>
      <boxGeometry args={[length, 3, 0.2]} />
      <meshStandardMaterial {...wallMat} />
    </mesh>
  );
}

// 🏠 CARDBOARD CUTOUT BUILDER
function FloorAndRoof({ nodes, isRenderMode, floorLevel }) {
  if (nodes.length < 3) return null;
  const shape = React.useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) { if (nodes[i].x !== nodes[i-1].x || nodes[i].y !== nodes[i-1].y) s.lineTo(nodes[i].x, nodes[i].y); }
    return s;
  }, [nodes]);
  const yOffset = floorLevel * 3;
  return (
    <group position={[0, yOffset, 0]}>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color={floorLevel === 0 ? "#8B5A2B" : "#cbd5e1"} roughness={isRenderMode ? 0.4 : 0.9} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={isRenderMode} receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color="#334155" roughness={0.9} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

// 🛋️ GIZMO PROPS & INTERACTIVE KINEMATICS
function SceneItem({ data, isSelected, onSelect, gizmoMode, updateTransform, isRenderMode }) {
  const meshRef = useRef(null); 
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Magic Finger!

  let content;
  if (data.type === 'light') {
    // 💡 THE ELECTRICIAN: Real lightbulbs!
    content = (
      <mesh castShadow={isRenderMode}>
        <cylinderGeometry args={[0.2, 0.2, 2, 16]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
        {isRenderMode && <pointLight position={[0, 1.5, 0]} intensity={2} distance={10} color="#fcd34d" castShadow />}
        <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color="#fcd34d" emissive="#fcd34d" emissiveIntensity={2} /></mesh>
      </mesh>
    );
  } else if (data.type === 'cabinet') {
    // 🚪 INTERACTIVE CABINET: Click to swing open!
    content = (
      <group>
        <mesh position={[0, 1, 0]} castShadow={isRenderMode} receiveShadow><boxGeometry args={[1.5, 2, 1]} /><meshStandardMaterial color="#8B5A2B" roughness={0.6} /></mesh>
        {/* The swinging door */}
        <mesh position={[-0.75, 1, 0.5]} rotation={[0, isOpen ? Math.PI / 2 : 0, 0]} castShadow={isRenderMode}>
          <boxGeometry args={[1.5, 2, 0.1]} />
          <meshStandardMaterial color="#A0522D" roughness={0.7} />
          <mesh position={[0.6, 0, 0.1]}><sphereGeometry args={[0.05]} /><meshStandardMaterial color="#cbd5e1" metalness={1} /></mesh>
        </mesh>
      </group>
    );
  } else {
    // Standard Math Box
    content = (
      <mesh castShadow={isRenderMode} receiveShadow>
        {data.params.shape === 'box' && <boxGeometry args={[data.params.width, data.params.height, data.params.width]} />}
        {data.params.shape === 'cylinder' && <cylinderGeometry args={[data.params.width / 2, data.params.width / 2, data.params.height, 32]} />}
        {data.params.shape === 'sphere' && <sphereGeometry args={[data.params.width / 2, 32, 32]} />}
        <meshStandardMaterial color={data.params.color} roughness={isRenderMode ? 0.2 : 0.8} emissive={isSelected ? "#3b82f6" : "#000000"} emissiveIntensity={isSelected ? 0.3 : 0} />
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
      {isSelected && isReady && meshRef.current && <TransformControls object={meshRef.current} mode={gizmoMode} onMouseUp={handleDragEnd} />}
      <group ref={(r) => { meshRef.current = r; if (r && !isReady) setIsReady(true); }} 
             position={[data.x || 0, (data.floor || 0) * 3, data.z || 0]} 
             rotation={[data.rotX || 0, data.rotY || 0, data.rotZ || 0]}
             scale={[data.sX || 1, data.sY || 1, data.sZ || 1]}
             onClick={(e) => { 
               e.stopPropagation(); 
               onSelect(data.id);
               if (data.type === 'cabinet') setIsOpen(!isOpen); // Swing door!
             }}>
        {content}
      </group>
    </>
  );
}

// 🎬 DIRECTOR CAMERA
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
  // 🔐 APP STATES
  const [showLanding, setShowLanding] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState("");

  const [activeTab, setActiveTab] = useState('Chat'); 
  const [leftOpen, setLeftOpen] = useState(false); const [rightOpen, setRightOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({ id: null, name: "New Blueprint" });
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Welcome to Pictopulse Enterprise. How can I assist your design today?' }]);
  
  // 🏗️ BUILDING STATES
  const [currentFloor, setCurrentFloor] = useState(0); // The Elevator!
  const [rooms, setRooms] = useState([]); // Now an array of objects: { floor: 0, nodes: [] }
  const [currentRoom, setCurrentRoom] = useState([]); 
  const [sceneObjects, setSceneObjects] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  
  // 🌍 ENGINE STATES
  const [gizmoMode, setGizmoMode] = useState('translate');
  const [envMode, setEnvMode] = useState('day'); 
  const [isRenderMode, setIsRenderMode] = useState(false); 
  const [isAnimating, setIsAnimating] = useState(false);

  // 🎮 THE VIDEO GAME CONTROLLER
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (activeTab !== '3D') return;

      const key = e.key.toLowerCase();
      if (key === 'm') setGizmoMode('translate');
      if (key === 'r') setGizmoMode('rotate');
      if (key === 's') setGizmoMode('scale');
      if ((key === 'delete' || key === 'backspace') && selectedId) {
        setSceneObjects(prev => prev.filter(obj => obj.id !== selectedId)); setSelectedId(null);
      }
      if (key === 'd' && selectedId) {
        setSceneObjects(prev => {
          const target = prev.find(o => o.id === selectedId);
          if (!target) return prev;
          const clone = { ...target, id: Date.now(), x: (target.x || 0) + 2, z: (target.z || 0) + 2 };
          setSelectedId(clone.id); return [...prev, clone];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedId]);

  const handleUpdateTransform = (id, newTransform) => { setSceneObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...newTransform } : obj)); };

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
      const newObject = { ...data, id: Date.now(), x: data.x || 0, y: data.y || 1, z: data.z || 0, floor: currentFloor };
      setSceneObjects((prev) => [...prev, newObject]); setSelectedId(newObject.id); setActiveTab('3D');
    });

    socket.on('start_blueprint_pipeline', (data) => {
      setCurrentProject(prev => ({ ...prev, name: data.projectName })); 
      // Wrap the AI's math arrays into Floor 0 objects so they stack!
      if (data.autoNodes && data.autoNodes.length > 0) {
        const autoFloors = data.autoNodes.map(nodeArr => ({ floor: 0, nodes: nodeArr }));
        setRooms(autoFloors);
      }
      setActiveTab('2D');
    });

    return () => { 
      socket.off('projects_list'); socket.off('project_loaded'); socket.off('cop_reply'); 
      socket.off('draw_3d_house'); socket.off('start_blueprint_pipeline'); 
    };
  }, [currentUser, currentFloor]);

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
        // Save to specific floor!
        setRooms(prev => [...prev, { floor: currentFloor, nodes: [...currentRoom, { x: firstDot.x, y: firstDot.y }] }]);
        setCurrentRoom([]); return; 
      }
    }
    setCurrentRoom(prev => [...prev, { x: clickX, y: clickY }]);
  };

  // 🚀 EXPORT CAD FILE
  const downloadCAD = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ project: currentProject.name, rooms, sceneObjects }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", currentProject.name + "_CAD.json");
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
  };

  // 🚪 1. THE FRONT DOOR (Landing Page)
  if (showLanding) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: '60px', margin: '0 0 20px 0', background: 'linear-gradient(90deg, #3b82f6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PICTOPULSE ENTERPRISE
        </h1>
        <p style={{ fontSize: '24px', color: '#94a3b8', maxWidth: '600px', marginBottom: '40px' }}>The Universal AI Architectural Engine. Turn text into mathematically perfect blueprints, 3D renders, and real estate proposals in seconds.</p>
        <button onClick={() => setShowLanding(false)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '20px 40px', fontSize: '20px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)' }}>
          Launch Studio Workspace
        </button>
      </div>
    );
  }

  // 🔐 LOGIN SCREEN 
  if (!currentUser) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h2 className="logo-text" style={{fontSize: '28px', marginBottom: '10px'}}>STUDIO LOGIN</h2>
          <p style={{color: '#64748b'}}>Secure Cloud Entry</p>
          <input className="login-input" placeholder="Enter Architect Name..." value={loginInput} onChange={e => setLoginInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setCurrentUser(loginInput)} />
          <button className="build-btn" style={{width: '100%', padding: '15px', fontSize: '16px'}} onClick={() => loginInput && setCurrentUser(loginInput)}>Enter Workspace</button>
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

      {/* ⬅️ LEFT MENU (Cloud) */}
      <div className={`left-sidebar ${leftOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}><h4 className="sidebar-title">Cloud Projects</h4><button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button></div>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px', background: '#e2e8f0', color: '#1e293b' }} onClick={() => { setRooms([]); setCurrentRoom([]); setSceneObjects([]); setCurrentProject({ id: null, name: "New Blueprint" }); setActiveTab('2D'); }}>+ New Blueprint</button>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {savedProjects.map(proj => (
                <p key={proj._id} onClick={() => { socket.emit('load_project', proj._id); setActiveTab('2D'); setLeftOpen(false); }} style={{ fontSize: '14px', color: '#3b82f6', cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>📁 {proj.name}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ➡️ RIGHT TOOLS (The Inspector & Toy Chest) */}
      <div className={`right-sidebar ${rightOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}><h4 className="sidebar-title">Inspector</h4><button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button></div>
        
        {/* THE ELEVATOR */}
        <div className="sidebar-section">
          <h4 className="sidebar-title">The Elevator (Z-Axis) 🏢</h4>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="toggle-btn" style={{ background: currentFloor === 0 ? '#3b82f6' : 'white', color: currentFloor === 0 ? 'white' : 'black', flex: 1 }} onClick={() => setCurrentFloor(0)}>Ground</button>
            <button className="toggle-btn" style={{ background: currentFloor === 1 ? '#3b82f6' : 'white', color: currentFloor === 1 ? 'white' : 'black', flex: 1 }} onClick={() => setCurrentFloor(1)}>Floor 1</button>
            <button className="toggle-btn" style={{ background: currentFloor === 2 ? '#3b82f6' : 'white', color: currentFloor === 2 ? 'white' : 'black', flex: 1 }} onClick={() => setCurrentFloor(2)}>Floor 2</button>
          </div>
        </div>

        {activeTab === '3D' && (
          <>
            <div className="sidebar-section">
              <button className="build-btn" style={{ width: '100%', background: isRenderMode ? '#10b981' : '#cbd5e1', color: isRenderMode ? 'white' : 'black' }} onClick={() => setIsRenderMode(!isRenderMode)}>
                {isRenderMode ? '✨ High-Quality Render ON' : '⚡ Fast Draft Mode'}
              </button>
            </div>

            {/* THE TOY CHEST (Asset Library) */}
            <div className="sidebar-section">
              <h4 className="sidebar-title">Asset Library (Click to Add) 📚</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="toggle-btn" onClick={() => setSceneObjects([...sceneObjects, { id: Date.now(), type: 'math', floor: currentFloor, params: { shape: 'box', width: 2, height: 1, color: '#3b82f6' } }])}>🛋️ Sofa</button>
                <button className="toggle-btn" onClick={() => setSceneObjects([...sceneObjects, { id: Date.now(), type: 'cabinet', floor: currentFloor }])}>🚪 Cabinet</button>
                <button className="toggle-btn" onClick={() => setSceneObjects([...sceneObjects, { id: Date.now(), type: 'math', floor: currentFloor, params: { shape: 'cylinder', width: 1, height: 2, color: '#10b981' } }])}>🪴 Plant</button>
                <button className="toggle-btn" onClick={() => setSceneObjects([...sceneObjects, { id: Date.now(), type: 'light', floor: currentFloor }])}>💡 Lamp</button>
              </div>
            </div>

            <div className="sidebar-section">
              <h4 className="sidebar-title">Gizmo Tools (Shortcuts: M, R, S)</h4>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button className="toggle-btn" style={{ background: gizmoMode === 'translate' ? '#e2e8f0' : 'white', flex: 1 }} onClick={() => setGizmoMode('translate')}>Move</button>
                <button className="toggle-btn" style={{ background: gizmoMode === 'rotate' ? '#e2e8f0' : 'white', flex: 1 }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
                <button className="toggle-btn" style={{ background: gizmoMode === 'scale' ? '#e2e8f0' : 'white', flex: 1 }} onClick={() => setGizmoMode('scale')}>Scale</button>
              </div>
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
          <div style={{display: 'flex', justifyContent: 'space-between', width: '800px'}}>
             <h2 style={{color: '#0f172a', margin: 0}}>Drafting: {currentProject.name} (Floor {currentFloor})</h2>
             <span style={{background: '#e2e8f0', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold'}}>Current Floor: {currentFloor}</span>
          </div>
          
          <div className="blueprint-paper" onClick={handle2DCanvasClick} style={{ position: 'relative', marginTop: '20px' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              
              <g transform="translate(730, 330)">
                <circle cx="0" cy="0" r="30" fill="white" stroke="#e2e8f0" strokeWidth="2" />
                <path d="M 0 -20 L 10 0 L 0 20 L -10 0 Z" fill="#ef4444" />
                <text x="0" y="-25" fontSize="14" fontWeight="bold" fill="#0f172a" textAnchor="middle">N</text>
              </g>

              {rooms.filter(r => r.floor === currentFloor).map((roomObj, roomIdx) => (
                <g key={`room-${roomIdx}`}>
                  {roomObj.nodes.map((node, i) => {
                    if (i === 0) return null;
                    const prev = roomObj.nodes[i - 1];
                    const x1 = ((prev.x + 10) / 20) * 800; const y1 = ((prev.y + 10) / 20) * 400;
                    const x2 = ((node.x + 10) / 20) * 800; const y2 = ((node.y + 10) / 20) * 400;
                    const dist = Math.round(Math.sqrt(Math.pow(node.x - prev.x, 2) + Math.pow(node.y - prev.y, 2)) * 3.28); 
                    return (
                      <g key={`line-${i}`}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
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
            <button className="toggle-btn" style={{ color: '#ef4444' }} onClick={() => { setRooms(rooms.filter(r => r.floor !== currentFloor)); setCurrentRoom([]); }}>🗑️ Clear This Floor</button>
            <button className="build-btn" style={{ flex: 1, fontSize: '16px' }} onClick={() => { setActiveTab('3D'); }}>✅ View in 3D</button>
          </div>
        </div>
      )}

      {/* 🎮 TAB 3 & 4: 3D MODEL & DIRECTOR */}
      {(activeTab === '3D' || activeTab === 'Anim') && (
        <div style={{ position: 'absolute', top: '70px', left: 0, right: 0, bottom: 0, zIndex: 1, background: envMode === 'night' ? '#0f172a' : '#e0e7ff' }}>
          
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
            
            {isRenderMode && envMode === 'day' && <Sky sunPosition={[100, 20, 100]} />}
            {isRenderMode && envMode === 'sunset' && <Sky sunPosition={[100, 2, 100]} turbidity={10} rayleigh={3} />}
            {envMode === 'night' && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
            {isRenderMode && <Environment preset={envMode === 'night' ? 'night' : 'city'} blur={0.8} />}
            
            <Grid infiniteGrid sectionColor={envMode === 'night' ? '#334155' : '#cbd5e1'} cellColor={envMode === 'night' ? '#1e293b' : '#e2e8f0'} fadeDistance={50} />
            
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={['#ef4444', '#10b981', '#3b82f6']} labelColor="white" />
            </GizmoHelper>

            <CinematicCamera isAnimating={isAnimating} />
            {!isAnimating && <OrbitControls makeDefault minDistance={5} maxDistance={50} />}
            
            <Suspense fallback={null}>
              {rooms.map((roomObj, roomIdx) => (
                <group key={`build-${roomIdx}`}>
                  <FloorAndRoof nodes={roomObj.nodes} isRenderMode={isRenderMode} floorLevel={roomObj.floor} />
                  {roomObj.nodes.map((node, i) => {
                    if (i === 0) return null;
                    return <Wall key={`wall-${i}`} start={roomObj.nodes[i-1]} end={node} wallIndex={i} isRenderMode={isRenderMode} floorLevel={roomObj.floor} />;
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
             <div style={{display: 'flex', gap: '10px'}}>
                <button className="toggle-btn" onClick={downloadCAD}>💾 Export CAD (.json)</button>
                <button className="build-btn" onClick={() => window.print()}>🖨️ Print PDF</button>
             </div>
          </div>
          
          <div className="presentation-slide">
             <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '40px', color: '#0f172a', margin: '0 0 10px 0' }}>{currentProject.name}</h1>
                <p style={{ color: '#64748b', fontSize: '18px', margin: 0 }}>Prepared by Lead Architect: {currentUser}</p>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <div>
                   <h3 style={{color: '#3b82f6'}}>Project Overview</h3>
                   <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', marginTop: '30px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{margin: '0 0 15px 0'}}>Live Telemetry Data</h4>
                      <ul style={{ color: '#334155', lineHeight: 2, paddingLeft: '20px' }}>
                         <li>Total Floors: <strong>{Math.max(0, ...rooms.map(r => r.floor)) + 1}</strong></li>
                         <li>Total Rooms: <strong>{rooms.length}</strong></li>
                         <li>Estimated Area: <strong style={{color: '#3b82f6'}}>{Math.round(calculateArea(rooms, currentRoom))} Sq Ft</strong></li>
                      </ul>
                   </div>
                </div>
                <div>
                   <h3 style={{color: '#3b82f6'}}>Bill of Materials (3D Props)</h3>
                   <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                      {sceneObjects.length === 0 ? <p style={{padding: '20px', color: '#94a3b8', margin: 0}}>No props installed yet.</p> : 
                        sceneObjects.map((obj, i) => (
                          <div key={i} style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <strong>Item {i+1}:</strong> {obj.type === 'cabinet' ? 'Wooden Cabinet' : obj.type === 'light' ? 'Electrical Fixture' : `Custom Shape`}
                          </div>
                        ))
                      }
                   </div>
                </div>
             </div>
             <div style={{ marginTop: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Generated securely via Pictopulse Enterprise Cloud</div>
          </div>
        </div>
      )}

      {/* ⌨️ COMMAND BAR */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command">
           <input className="magic-input" placeholder="Type: 'Build a 2BHK'..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
           <button className="build-btn" onClick={handleBuild}>✨ Send</button>
        </div>
      )}
    </div>
  );
}
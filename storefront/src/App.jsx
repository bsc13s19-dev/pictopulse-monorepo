import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🧮 THE MATH ROBOT
function calculateArea(rooms, currentRoom) {
  let totalArea = 0;
  rooms.forEach(room => {
    if (room.length < 3) return;
    let area = 0;
    for (let i = 0; i < room.length; i++) {
      let j = (i + 1) % room.length; 
      area += room[i].x * room[j].y;
      area -= room[i].y * room[j].x;
    }
    totalArea += Math.abs(area / 2) * 15; 
  });
  if (currentRoom.length >= 3) {
    let area = 0;
    for (let i = 0; i < currentRoom.length; i++) {
      let j = (i + 1) % currentRoom.length; 
      area += currentRoom[i].x * currentRoom[j].y;
      area -= currentRoom[i].y * currentRoom[j].x;
    }
    totalArea += Math.abs(area / 2) * 15;
  }
  return totalArea; 
}

// 🧱 THE WALL ROBOT
function Wall({ start, end, wallIndex }) {
  const dx = end.x - start.x; const dz = end.y - start.y;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.1) return null; 
  const angle = Math.atan2(dz, dx);
  const midX = (start.x + end.x) / 2; const midZ = (start.y + end.y) / 2;

  if (wallIndex === 1 && length > 4) {
    const doorWidth = 1.2; const sideLength = (length - doorWidth) / 2; const sideOffset = (length / 2) - (sideLength / 2); 
    return (
      <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
        <mesh position={[-sideOffset, 1.5, 0]} castShadow receiveShadow><boxGeometry args={[sideLength, 3, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
        <mesh position={[sideOffset, 1.5, 0]} castShadow receiveShadow><boxGeometry args={[sideLength, 3, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow><boxGeometry args={[doorWidth, 1, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
      </group>
    );
  }
  if (wallIndex === 2 && length > 4) {
    const winWidth = 1.5; const winHeight = 1; const sillHeight = 1; const sideLength = (length - winWidth) / 2; const sideOffset = (length / 2) - (sideLength / 2);
    return (
      <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
        <mesh position={[-sideOffset, 1.5, 0]} castShadow receiveShadow><boxGeometry args={[sideLength, 3, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
        <mesh position={[sideOffset, 1.5, 0]} castShadow receiveShadow><boxGeometry args={[sideLength, 3, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
        <mesh position={[0, sillHeight / 2, 0]} castShadow receiveShadow><boxGeometry args={[winWidth, sillHeight, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
        <mesh position={[0, 3 - (1 / 2), 0]} castShadow receiveShadow><boxGeometry args={[winWidth, 1, 0.2]} /><meshStandardMaterial color="#eeeeee" roughness={0.8} /></mesh>
        <mesh position={[0, sillHeight + (winHeight / 2), 0]}><boxGeometry args={[winWidth, winHeight, 0.05]} /><meshStandardMaterial color="#88ccff" transparent={true} opacity={0.4} roughness={0.1} metalness={0.8} /></mesh>
      </group>
    );
  }
  
  // 🧱 Normal Wall (Fixed! No roof code here!)
  return (
    <mesh position={[midX, 1.5, midZ]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, 3, 0.2]} />
      <meshStandardMaterial color="#eeeeee" roughness={0.8} />
    </mesh>
  );
}

// 🏠 CARDBOARD CUTOUT BUILDER
function FloorAndRoof({ nodes }) {
  if (nodes.length < 3) return null;
  const shape = React.useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i].x !== nodes[i-1].x || nodes[i].y !== nodes[i-1].y) {
        s.lineTo(nodes[i].x, nodes[i].y);
      }
    }
    return s;
  }, [nodes]);

  return (
    <group>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color="#8B5A2B" roughness={1} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color="#222222" roughness={0.9} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

// 🛋️ GIZMO PROPS BUILDER
function SceneItem({ data, isSelected, onSelect, gizmoMode, updateTransform }) {
  const meshRef = useRef(null); const [isReady, setIsReady] = useState(false);
  let content = null;
  if (data.type === 'model') { const { scene } = useGLTF(data.url); content = <primitive object={scene.clone()} />; } 
  else if (data.type === 'math') {
    const { shape, width, height, color } = data.params;
    content = (
      <mesh castShadow receiveShadow>
        {shape === 'box' && <boxGeometry args={[width, height, width]} />}
        <meshStandardMaterial color={color} emissive={isSelected ? "#ffffff" : "#000000"} emissiveIntensity={isSelected ? 0.3 : 0} />
      </mesh>
    );
  }
  const handleDragEnd = () => {
    if (meshRef.current) { updateTransform(data.id, { x: meshRef.current.position.x, y: meshRef.current.position.y, z: meshRef.current.position.z }); }
  };
  return (
    <>
      {isSelected && isReady && meshRef.current && <TransformControls object={meshRef.current} mode={gizmoMode} onMouseUp={handleDragEnd} />}
      <group ref={(r) => { meshRef.current = r; if (r && !isReady) setIsReady(true); }} position={[data.x || 0, data.y || 0, data.z || 0]} onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}>{content}</group>
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Chat'); 
  const [leftOpen, setLeftOpen] = useState(false); const [rightOpen, setRightOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({ id: null, name: "New Blueprint" });
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Factory fully restored and perfect! Chat, draw, and build!' }]);
  
  const [rooms, setRooms] = useState([]); 
  const [currentRoom, setCurrentRoom] = useState([]); 
  const [sceneObjects, setSceneObjects] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  const [gizmoMode, setGizmoMode] = useState('translate');

  useEffect(() => {
    // 🤖 THE AUTO-SAVE ROBOT
  // Every time you draw a room or add a prop, this waits 3 seconds and saves it to the cloud silently!
  useEffect(() => {
    if (currentProject.id && (rooms.length > 0 || sceneObjects.length > 0)) {
      const saveTimer = setTimeout(() => {
        socket.emit('save_project', { id: currentProject.id, name: currentProject.name, nodes: rooms, objects: sceneObjects });
        // We don't spam the chat log here, it just happens invisibly like Google Docs!
      }, 3000); 
      return () => clearTimeout(saveTimer);
    }
  }, [rooms, sceneObjects, currentProject.id]);
    socket.emit('get_all_projects');
    socket.on('projects_list', (projects) => setSavedProjects(projects));
    socket.on('project_loaded', (projectData) => {
      setCurrentProject({ id: projectData._id, name: projectData.name });
      setRooms(projectData.nodes || []); 
      setSceneObjects(projectData.objects || []);
      setActiveTab('2D');
    });
    socket.on('cop_reply', (msg) => setChatLog(prev => [...prev, { sender: 'ai', text: msg }]));
    socket.on('draw_3d_house', (data) => {
      const newObject = { ...data, id: Date.now(), x: data.x || 0, y: data.y || 1, z: data.z || 0 };
      setSceneObjects((prev) => [...prev, newObject]); setSelectedId(newObject.id); setActiveTab('3D');
    });
    return () => { socket.off('projects_list'); socket.off('project_loaded'); socket.off('cop_reply'); socket.off('draw_3d_house'); };
  }, []);

  const saveToCloud = () => { socket.emit('save_project', { id: currentProject.id, name: currentProject.name, nodes: rooms, objects: sceneObjects }); };
  const handleBuild = () => { if (!prompt) return; setChatLog(prev => [...prev, { sender: 'user', text: prompt }]); socket.emit('build_house', prompt); setPrompt(""); };

  const handle2DCanvasClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 20 - 10;
    const clickY = ((e.clientY - rect.top) / rect.height) * 20 - 10;

    if (currentRoom.length > 2) {
      const firstDot = currentRoom[0];
      const distance = Math.sqrt(Math.pow(clickX - firstDot.x, 2) + Math.pow(clickY - firstDot.y, 2));
      
      if (distance < 1.5) {
        setRooms(prev => [...prev, [...currentRoom, { x: firstDot.x, y: firstDot.y }]]);
        setCurrentRoom([]); 
        return; 
      }
    }
    setCurrentRoom(prev => [...prev, { x: clickX, y: clickY }]);
  };

  return (
    <div className="studio-container">
      
      {/* 🏷️ TOP BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}><button className="toggle-btn" onClick={() => { setLeftOpen(!leftOpen); setRightOpen(false); }}>☰ Menu</button><strong style={{ color: '#00ffcc' }}>PICTOPULSE</strong></div>
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`} onClick={() => setActiveTab('Chat')}>1. Chat</button>
          <button className={`tab-btn ${activeTab === '2D' ? 'active' : ''}`} onClick={() => setActiveTab('2D')}>2. 2D Plan</button>
          <button className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} onClick={() => setActiveTab('3D')}>3. 3D Model</button>
          <button className={`tab-btn ${activeTab === 'Anim' ? 'active' : ''}`} onClick={() => setActiveTab('Anim')}>4. Animation</button>
          <button className={`tab-btn ${activeTab === 'Pres' ? 'active' : ''}`} onClick={() => setActiveTab('Pres')}>5. Presentation</button>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}><button className="btn-massive" onClick={saveToCloud}>💾 Save</button><button className="toggle-btn" onClick={() => { setRightOpen(!rightOpen); setLeftOpen(false); }}>⚙️ Tools</button></div>
      </div>

      {/* ⬅️ LEFT MENU RESTORED */}
      <div className={`left-sidebar ${leftOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}><h4 className="sidebar-title">Cloud Projects</h4><button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button></div>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px' }} onClick={() => { setRooms([]); setCurrentRoom([]); setSceneObjects([]); setCurrentProject({ id: null, name: "New Blueprint" }); setActiveTab('2D'); }}>+ New Blueprint</button>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {savedProjects.length === 0 ? <p style={{ fontSize: '12px', color: '#555' }}>No projects saved yet.</p> : savedProjects.map(proj => (
                <p key={proj._id} onClick={() => socket.emit('load_project', proj._id)} style={{ fontSize: '13px', color: '#00ffcc', cursor: 'pointer', borderBottom: '1px solid #222', paddingBottom: '5px' }}>📁 {proj.name}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ➡️ RIGHT TOOLS RESTORED */}
      <div className={`right-sidebar ${rightOpen ? 'open' : ''}`}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}><h4 className="sidebar-title">Inspector</h4><button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button></div>
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
      </div>

      {/* 💬 TAB 1: CHAT RESTORED */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay">
          <div className="chat-container">
            {chatLog.map((log, i) => (
              <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🏗️ : ' : '👤 : '} {log.text}</div>
            ))}
          </div>
        </div>
      )}

      {/* 📐 TAB 2: 2D PLAN (Now with Approval Pipeline!) */}
      {activeTab === '2D' && (
        <div className="ui-overlay">
          <h2>Mansion Blueprint</h2>
          <p style={{ color: '#aaa' }}>Draw a room, SNAP it closed. Then click somewhere else to start a new room!</p>
          <div className="blueprint-paper" onClick={handle2DCanvasClick} style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              {rooms.map((room, roomIdx) => (
                <g key={`room-${roomIdx}`}>
                  {room.map((node, i) => {
                    if (i === 0) return null;
                    const prev = room[i - 1];
                    return <line key={i} x1={((prev.x + 10) / 20) * 800} y1={((prev.y + 10) / 20) * 400} x2={((node.x + 10) / 20) * 800} y2={((node.y + 10) / 20) * 400} stroke="#00ffcc" strokeWidth="3" />;
                  })}
                </g>
              ))}
              {currentRoom.map((node, i) => {
                if (i === 0) return <circle key="start" cx={((node.x + 10) / 20) * 800} cy={((node.y + 10) / 20) * 400} r="6" fill="#ff0055" />;
                const prev = currentRoom[i - 1];
                return <line key={i} x1={((prev.x + 10) / 20) * 800} y1={((prev.y + 10) / 20) * 400} x2={((node.x + 10) / 20) * 800} y2={((node.y + 10) / 20) * 400} stroke="#ff0055" strokeWidth="3" strokeDasharray="5,5" />;
              })}
              {currentRoom.map((node, i) => <circle key={`dot-${i}`} cx={((node.x + 10) / 20) * 800} cy={((node.y + 10) / 20) * 400} r="4" fill="white" />)}
            </svg>
          </div>
          
          {/* 🚦 THE PIPELINE BUTTONS */}
          <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
            <button className="build-btn" style={{ background: '#222', color: 'white' }} onClick={() => { setRooms([]); setCurrentRoom([]); }}>🗑️ Clear</button>
            
            {/* The giant green APPROVAL button! */}
            <button className="build-btn" style={{ background: '#00ffcc', color: '#000', flex: 1, fontSize: '16px', fontWeight: 'bold' }} onClick={() => {
              setActiveTab('3D');
              setChatLog(prev => [...prev, { sender: 'ai', text: 'Blueprint Approved! Generating 3D structure and waiting for prop instructions...' }]);
            }}>
              ✅ Approve Blueprint & Build 3D
            </button>
          </div>
        </div>
      )}

      {/* 🎮 TAB 3: 3D MODEL */}
      {activeTab === '3D' && (
        <div style={{ position: 'absolute', top: '0', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
          <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }} onPointerMissed={() => setSelectedId(null)}>
            <ambientLight intensity={0.5} /><spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
            <Environment preset="city" background blur={0.5} /><OrbitControls makeDefault minDistance={5} maxDistance={50} />
            <Suspense fallback={null}>
              {rooms.map((room, roomIdx) => (
                <group key={`build-${roomIdx}`}>
                  <FloorAndRoof nodes={room} />
                  {room.map((node, i) => {
                    if (i === 0) return null;
                    return <Wall key={`wall-${i}`} start={room[i-1]} end={node} wallIndex={i} />;
                  })}
                </group>
              ))}
              {sceneObjects.map(obj => <SceneItem key={obj.id} data={obj} isSelected={selectedId === obj.id} onSelect={setSelectedId} gizmoMode={gizmoMode} updateTransform={sceneObjects} />)}
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
      
      {/* 📊 TAB 5: PRESENTATION */}
      {activeTab === 'Pres' && (
        <div className="ui-overlay">
          <div className="active-slide" style={{ width: '800px', background: 'white', padding: '40px', color: 'black' }}>
             <h2>Project Proposal</h2>
             <div style={{ marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
                <strong>📊 Live Multi-Room Data:</strong><br/><br/>
                * Total Rooms Built: {rooms.length}<br/>
                * 📏 Estimated Mansion Area: <strong style={{color: '#ff0055'}}>{Math.round(calculateArea(rooms, currentRoom))} Sq Ft</strong>
             </div>
          </div>
        </div>
      )}

      {/* ⌨️ COMMAND BAR RESTORED */}
      {(activeTab === 'Chat' || activeTab === '3D') && (
        <div className="floating-command">
           <input className="magic-input" placeholder="Type a prompt to build props..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
           <button className="build-btn" onClick={handleBuild}>Send</button>
        </div>
      )}
    </div>
  );
}
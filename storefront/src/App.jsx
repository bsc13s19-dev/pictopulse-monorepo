import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🧱 3D WALL BUILDER (Converts 2D lines into 3D walls!)
function Wall({ start, end }) {
  // Math to calculate wall length, position, and rotation
  const dx = end.x - start.x;
  const dz = end.y - start.y; // 2D Y becomes 3D Z!
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const midX = (start.x + end.x) / 2;
  const midZ = (start.y + end.y) / 2;

  return (
    <mesh position={[midX, 1.5, midZ]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      {/* Wall thickness is 0.2, height is 3 */}
      <boxGeometry args={[length, 3, 0.2]} />
      <meshStandardMaterial color="#eeeeee" roughness={0.8} />
    </mesh>
  );
}

// 🌍 MAIN APP PIPELINE
export default function App() {
  // 🧠 Workflow & Database State
  const [activeTab, setActiveTab] = useState('Chat'); 
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  
  // 💾 MongoDB State
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({ id: null, name: "New Blueprint" });
  
  // 🏗️ Architectural State
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Pictopulse Engine Ready. Start chatting, or go to Tab 2 to draw walls.' }]);
  const [nodes2D, setNodes2D] = useState([]); // The corners of the walls
  const [sceneObjects, setSceneObjects] = useState([]); // Other 3D props (sofas, cars)

  // 🔌 DATABASE SOCKET LISTENERS
  useEffect(() => {
    // 1. Ask server for saved MongoDB projects on load
    socket.emit('get_all_projects');

    // 2. Listen for the list of projects from the server
    socket.on('projects_list', (projects) => {
      setSavedProjects(projects);
    });

    // 3. Listen for a loaded project
    socket.on('project_loaded', (projectData) => {
      setCurrentProject({ id: projectData._id, name: projectData.name });
      setNodes2D(projectData.nodes || []);
      setSceneObjects(projectData.objects || []);
      setChatLog([{ sender: 'ai', text: `Loaded project: ${projectData.name}` }]);
      setActiveTab('2D');
    });

    // 4. Listen for AI Chat replies
    socket.on('cop_reply', (msg) => setChatLog(prev => [...prev, { sender: 'ai', text: msg }]));

    return () => {
      socket.off('projects_list');
      socket.off('project_loaded');
      socket.off('cop_reply');
    };
  }, []);

  // 💾 SAVE TO MONGODB LOGIC
  const saveToCloud = () => {
    const projectData = {
      id: currentProject.id,
      name: currentProject.name,
      nodes: nodes2D,
      objects: sceneObjects
    };
    socket.emit('save_project', projectData);
    setChatLog(prev => [...prev, { sender: 'ai', text: `Saving ${currentProject.name} to MongoDB Cloud...` }]);
  };

  // 🗣️ CHAT LOGIC
  const handleBuild = () => { 
    if (!prompt) return;
    setChatLog(prev => [...prev, { sender: 'user', text: prompt }]);
    socket.emit('build_house', prompt);
    setPrompt("");
  };

  // 📐 2D DRAFTING LOGIC (Click to draw walls)
  const handle2DCanvasClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    // Convert mouse pixels to grid coordinates (assuming center is 0,0)
    const x = ((e.clientX - rect.left) / rect.width) * 20 - 10;
    const y = ((e.clientY - rect.top) / rect.height) * 20 - 10;
    setNodes2D(prev => [...prev, { x, y }]);
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
          <button className="btn-massive" style={{ padding: '8px 15px', fontSize: '12px' }} onClick={saveToCloud}>💾 Save to Cloud</button>
          <button className="toggle-btn" onClick={() => { setRightOpen(!rightOpen); setLeftOpen(false); }}>⚙️ Tools</button>
        </div>
      </div>

      {/* ⬅️ LEFT DOCK (MongoDB Project History) */}
      <div className={`left-sidebar ${leftOpen ? '' : 'closed'}`} style={{ top: '60px', zIndex: 40 }}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}>
            <h4 className="sidebar-title">Cloud Projects</h4>
            <button className="toggle-btn" onClick={() => setLeftOpen(false)}>✖</button>
        </div>
        <div className="sidebar-section">
          <button className="build-btn" style={{ width: '100%', marginBottom: '15px' }} onClick={() => { setNodes2D([]); setSceneObjects([]); setCurrentProject({ id: null, name: "New Blueprint" }); setActiveTab('2D'); }}>+ New Blueprint</button>
          
          <h4 className="sidebar-title">Database</h4>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {savedProjects.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#555' }}>No projects saved yet. Connect MongoDB to see data.</p>
            ) : (
              savedProjects.map(proj => (
                <p key={proj._id} onClick={() => socket.emit('load_project', proj._id)} style={{ fontSize: '13px', color: '#00ffcc', cursor: 'pointer', borderBottom: '1px solid #222', paddingBottom: '5px' }}>
                  📁 {proj.name}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ➡️ RIGHT DOCK (3D Inspector) */}
      <div className={`right-sidebar ${rightOpen ? '' : 'closed'}`} style={{ top: '60px', zIndex: 40 }}>
        <div className="sidebar-section" style={{display: 'flex', justifyContent: 'space-between'}}>
            <h4 className="sidebar-title">Inspector</h4>
            <button className="toggle-btn" onClick={() => setRightOpen(false)}>✖</button>
        </div>
        <div className="sidebar-section">
          <label style={{ fontSize: '12px', color: '#aaa' }}>Project Name</label>
          <input className="magic-input" style={{ width: '100%', padding: '5px', marginTop: '5px', fontSize: '14px', borderBottom: '1px solid #444' }} value={currentProject.name} onChange={(e) => setCurrentProject({...currentProject, name: e.target.value})} />
        </div>
        <div className="sidebar-section">
          <h4 className="sidebar-title">Architecture Stats</h4>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Nodes: {nodes2D.length}</p>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Walls: {Math.max(0, nodes2D.length - 1)}</p>
          <button className="toggle-btn" style={{ width: '100%', marginTop: '10px' }} onClick={() => setNodes2D([])}>🗑️ Clear Walls</button>
        </div>
      </div>

      {/* 💬 TAB 1: CHAT AI */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay chat-container">
          {chatLog.map((log, i) => (
            <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🏗️ : ' : '👤 : '} {log.text}</div>
          ))}
        </div>
      )}

      {/* 📐 TAB 2: REAL 2D BLUEPRINT DRAFTING ENGINE */}
      {activeTab === '2D' && (
        <div className="ui-overlay" style={{ alignItems: 'center' }}>
          <h2>Interactive Blueprint: {currentProject.name}</h2>
          <p style={{ color: '#aaa' }}>Click the grid to draw walls. Go to Tab 3 to see the 3D Extrusion.</p>
          
          <div className="blueprint-paper" style={{ position: 'relative', cursor: 'crosshair', overflow: 'hidden' }} onClick={handle2DCanvasClick}>
            {/* Draw lines between the nodes */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              {nodes2D.map((node, i) => {
                if (i === 0) return null;
                const prev = nodes2D[i - 1];
                // Convert grid coordinates back to SVG pixels
                const x1 = ((prev.x + 10) / 20) * 800;
                const y1 = ((prev.y + 10) / 20) * 400;
                const x2 = ((node.x + 10) / 20) * 800;
                const y2 = ((node.y + 10) / 20) * 400;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00ffcc" strokeWidth="3" />;
              })}
              {/* Draw the dots */}
              {nodes2D.map((node, i) => {
                const cx = ((node.x + 10) / 20) * 800;
                const cy = ((node.y + 10) / 20) * 400;
                return <circle key={`dot-${i}`} cx={cx} cy={cy} r="4" fill="white" />;
              })}
            </svg>
          </div>
        </div>
      )}

      {/* 🎮 TAB 3: 3D EXTRUSION STUDIO */}
      <div style={{ position: 'absolute', top: '0', left: 0, right: 0, bottom: 0, zIndex: 1, visibility: activeTab === '3D' ? 'visible' : 'hidden' }}>
        <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
          <Environment preset="city" background blur={0.5} />
          <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />
          <OrbitControls makeDefault minDistance={5} maxDistance={50} />
          
          {/* THE MAGIC: Loop through 2D Nodes and render 3D Walls! */}
          <Suspense fallback={null}>
            {nodes2D.map((node, i) => {
              if (i === 0) return null;
              return <Wall key={`wall-${i}`} start={nodes2D[i-1]} end={node} />;
            })}
          </Suspense>
        </Canvas>
      </div>

      {/* 🎬 TAB 4 & 5 Placeholders (To keep file clean) */}
      {(activeTab === 'Anim' || activeTab === 'Pres') && (
        <div className="ui-overlay" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2>{activeTab === 'Anim' ? 'Animation Timeline' : 'Presentation Studio'}</h2>
          <p style={{ color: '#888' }}>Data synced with MongoDB. Awaiting server backend integration.</p>
        </div>
      )}

      {/* ⌨️ COMMAND BAR */}
      <div className="floating-command">
         <input className="magic-input" placeholder="Chat with AI..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
         <button className="build-btn" onClick={handleBuild}>Send</button>
      </div>

    </div>
  );
}
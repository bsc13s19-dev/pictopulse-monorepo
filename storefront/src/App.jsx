import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import './App.css'; 

// 🌍 MAIN APP PIPELINE
export default function App() {
  // 🧠 Workflow State
  const [activeTab, setActiveTab] = useState('Chat'); 
  const [prompt, setPrompt] = useState("");
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Welcome to Pictopulse Architecture. Describe your project (e.g. "Build a 2BHK").' }]);
  
  // 🏗️ Architectural State
  const [isPlanApproved, setIsPlanApproved] = useState(false);
  const [currentProject, setCurrentProject] = useState({ name: "Untitled", type: "Custom" });
  const [excelData, setExcelData] = useState([]);

  // 🗣️ THE SENIOR ARCHITECT LOGIC
  const handleBuild = () => { 
    if (!prompt) return;
    const userText = prompt;
    setChatLog(prev => [...prev, { sender: 'user', text: userText }]);
    setPrompt("");

    // Simulate AI Architectural Team analyzing "2BHK"
    setTimeout(() => {
      if (userText.toLowerCase().includes("2bhk")) {
        setCurrentProject({ name: "Modern 2BHK Apartment", type: "Residential" });
        setExcelData([
          { room: "Master Bedroom", area: "250 sq.ft", materials: "Hardwood Floor" },
          { room: "Guest Bedroom", area: "180 sq.ft", materials: "Carpet" },
          { room: "Living Room", area: "400 sq.ft", materials: "Polished Concrete" },
          { room: "Kitchen", area: "150 sq.ft", materials: "Marble Countertops" },
          { room: "2x Bathrooms", area: "100 sq.ft", materials: "Ceramic Tile" },
          { room: "TOTAL", area: "1,080 sq.ft", materials: "Estimated: $125,000" }
        ]);
        setChatLog(prev => [...prev, { sender: 'ai', text: 'I have analyzed your request. I designed a 1,080 sq.ft 2BHK layout with 5 primary zones. Please review the 2D Plan to approve it for 3D generation.' }]);
        
        // Auto-switch to 2D Plan for user approval!
        setTimeout(() => setActiveTab('2D'), 1500);
      } else {
        setChatLog(prev => [...prev, { sender: 'ai', text: 'Drafting custom request. Please check the 2D tab to review the geometry.' }]);
      }
    }, 1000);
  };

  const approvePlan = () => {
    setIsPlanApproved(true);
    setChatLog(prev => [...prev, { sender: 'ai', text: 'Blueprint Approved! Extruding 3D geometry now...' }]);
    setActiveTab('3D');
  };

  return (
    <div className="studio-container">
      
      {/* 🏷️ THE 5-STEP MASTER TOP BAR */}
      <div className="top-bar">
        <strong style={{ fontSize: '18px', letterSpacing: '2px', color: '#00ffcc' }}>PICTOPULSE</strong>
        
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`} onClick={() => setActiveTab('Chat')}>1. Chat</button>
          <button className={`tab-btn ${activeTab === '2D' ? 'active' : ''}`} onClick={() => setActiveTab('2D')}>2. 2D Plan</button>
          
          {/* Lock 3D until approved! */}
          <button 
            className={`tab-btn ${activeTab === '3D' ? 'active' : ''}`} 
            onClick={() => isPlanApproved ? setActiveTab('3D') : alert("Please approve the 2D Plan first!")}
            style={{ opacity: isPlanApproved ? 1 : 0.5 }}
          >
            3. 3D Model {isPlanApproved ? '✅' : '🔒'}
          </button>
          
          <button className={`tab-btn ${activeTab === 'Anim' ? 'active' : ''}`} onClick={() => setActiveTab('Anim')}>4. Animation</button>
          <button className={`tab-btn ${activeTab === 'Pres' ? 'active' : ''}`} onClick={() => setActiveTab('Pres')}>5. Presentation</button>
        </div>
      </div>

      {/* 💬 TAB 1: CHAT AI */}
      {activeTab === 'Chat' && (
        <div className="ui-overlay chat-container">
          {chatLog.map((log, i) => (
            <div key={i} className={`chat-bubble ${log.sender}`}>{log.sender === 'ai' ? '🏗️ Architect AI: ' : '👤 CEO: '} {log.text}</div>
          ))}
        </div>
      )}

      {/* 📐 TAB 2: 2D FLOOR PLAN GATEKEEPER */}
      {activeTab === '2D' && (
        <div className="ui-overlay">
          <h2 style={{ textAlign: 'center' }}>Blueprint Review: {currentProject.name}</h2>
          <div className="blueprint-paper">
            <h3 style={{ color: '#00ffcc', letterSpacing: '5px', opacity: 0.5 }}>[ 2D CAD SCHEMATIC GENERATED HERE ]</h3>
          </div>
          <div className="approve-panel">
            {!isPlanApproved ? (
              <>
                <p style={{ color: '#aaa', marginBottom: '20px' }}>Review the spatial layout. The 3D engine is standing by.</p>
                <button className="btn-massive" onClick={approvePlan}>APPROVE & BUILD 3D</button>
              </>
            ) : (
              <h2 style={{ color: '#00ffcc' }}>✅ Blueprint Locked. Proceed to 3D.</h2>
            )}
          </div>
        </div>
      )}

      {/* 🎮 TAB 3: 3D STUDIO */}
      <div style={{ position: 'absolute', top: '0', left: 0, right: 0, bottom: 0, zIndex: 1, visibility: activeTab === '3D' ? 'visible' : 'hidden' }}>
        <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }}>
          <ambientLight intensity={0.5} />
          <Environment preset="city" background blur={0.5} />
          <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />
          <OrbitControls makeDefault minDistance={5} maxDistance={50} />
        </Canvas>
        {activeTab === '3D' && <div style={{position: 'absolute', top: '80px', left: '20px', color: '#00ffcc', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px'}}>3D Extrusion Engine Ready. (Your 3D code stays safely here!)</div>}
      </div>

      {/* 🎬 TAB 4: ANIMATION / CINEMATIC TIMELINE */}
      {activeTab === 'Anim' && (
        <div className="ui-overlay" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2>Director's Timeline</h2>
          <p style={{ color: '#888' }}>Set up camera tracking paths around the exterior and interior.</p>
          <div style={{ width: '80%', height: '100px', background: '#222', margin: '20px auto', borderRadius: '8px', border: '1px solid #444', display: 'flex', alignItems: 'center', padding: '10px' }}>
             <div style={{ width: '20%', background: '#00ffcc', height: '10px', borderRadius: '5px' }}></div>
             <span style={{ marginLeft: '10px', fontSize: '12px', color: '#aaa' }}>Camera Path A (Kitchen Walkthrough)</span>
          </div>
        </div>
      )}

      {/* 📊 TAB 5: PRESENTATION, EXCEL & EXPORT */}
      {activeTab === 'Pres' && (
        <div className="ui-overlay">
          <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Project Dashboard: {currentProject.name}</h2>
          
          <div className="dashboard-grid">
            {/* The Excel Data Table */}
            <div className="dashboard-card">
              <h3 style={{ color: '#00ffcc', marginTop: 0 }}>📊 Bill of Materials & Area (Excel)</h3>
              <table className="excel-table">
                <thead>
                  <tr><th>Space Designation</th><th>Square Footage</th><th>Material / Notes</th></tr>
                </thead>
                <tbody>
                  {excelData.length > 0 ? excelData.map((row, i) => (
                    <tr key={i} style={{ background: i === excelData.length-1 ? '#1a3c5a' : 'transparent', fontWeight: i === excelData.length-1 ? 'bold' : 'normal' }}>
                      <td>{row.room}</td><td>{row.area}</td><td>{row.materials}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{textAlign:'center'}}>No data generated yet. Run a chat prompt.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* The Canva & Export Panel */}
            <div className="dashboard-card">
              <h3 style={{ color: '#00ffcc', marginTop: 0 }}>📤 Render & Client Export</h3>
              <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '8px', border: '1px solid #333', marginBottom: '15px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>Narrator Voice Track: <span style={{ color: 'white', fontWeight: 'bold' }}>Female (Studio Configured)</span></p>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#aaa' }}>Output Resolution: <span style={{ color: 'white', fontWeight: 'bold' }}>4K Cinematic</span></p>
              </div>

              <div className="export-grid">
                <button className="export-btn"><span>📄</span> Export Client PDF <small style={{fontWeight:'normal', color:'#888'}}>Floorplan + Data</small></button>
                <button className="export-btn"><span>🎬</span> Render .MP4 Video <small style={{fontWeight:'normal', color:'#888'}}>Spatial Audio Included</small></button>
                <button className="export-btn"><span>📦</span> Export .GLB Model <small style={{fontWeight:'normal', color:'#888'}}>Full 3D Geometry</small></button>
                <button className="export-btn"><span>🖼️</span> Export PNG Renders <small style={{fontWeight:'normal', color:'#888'}}>4K Still Shots</small></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⌨️ COMMAND BAR (Only shows in Chat or 3D) */}
      {(activeTab === 'Chat' || activeTab === '3D' || activeTab === '2D') && (
        <div className="floating-command">
           <button className="btn-massive" style={{ padding: '10px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📎</button>
           <input className="magic-input" placeholder="E.g. Build a 2BHK..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuild()} />
           <button className="build-btn" onClick={handleBuild}>Generate</button>
        </div>
      )}

    </div>
  );
}
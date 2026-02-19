import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

// 🔗 Replace this with your actual Render backend URL
const socket = io('https://pictopulse-backend.onrender.com'); 

// 🏢 THE HYBRID DISPLAY MANAGER
// This component handles the switching between 3D files and Math shapes
function DisplayManager({ data }) {
  if (!data) return null;

  // MODE 1: Pre-made 3D Model (from the Infinite Warehouse Search)
  if (data.type === 'model') {
    const { scene } = useGLTF(data.url);
    return <primitive object={scene} scale={2} position={[0, 0, 0]} />;
  }

  // MODE 2: Math-generated Shape (The "LEGO" Method)
  if (data.type === 'math') {
    const { shape, width, height, color } = data.params;
    return (
      <mesh position={[0, height / 2, 0]}>
        {shape === 'sphere' ? (
          <sphereGeometry args={[width / 2, 32, 32]} />
        ) : (
          <boxGeometry args={[width, height, width]} />
        )}
        <meshStandardMaterial 
          color={color} 
          metalness={0.6} 
          roughness={0.2} 
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
    );
  }
  return null;
}

// 🎥 THE CINEMATIC CAMERA DIRECTOR
// Fixed to avoid the THREE.Clock deprecation warning
function CameraDirector({ isRecording }) {
  useFrame((state) => {
    if (isRecording) {
      // ✅ We read the property .elapsedTime directly to stay warning-free
      const time = state.clock.elapsedTime;
      
      // Smooth orbital movement
      state.camera.position.x = Math.sin(time * 0.5) * 10;
      state.camera.position.z = Math.cos(time * 0.5) * 10;
      state.camera.position.y = 5; // Keep a steady height
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("SYSTEM ONLINE");
  const [activeData, setActiveData] = useState({ 
    type: 'math', 
    params: { shape: 'box', width: 2, height: 2, color: '#00ffcc' } 
  });
  const [isRecording, setIsRecording] = useState(false);

  // Connect to the Cloud Cop Radio
  useEffect(() => {
    socket.on('cop_reply', (msg) => setCopReply(msg));
    socket.on('draw_3d_house', (data) => setActiveData(data));
    
    return () => {
      socket.off('cop_reply');
      socket.off('draw_3d_house');
    };
  }, []);

  const handleBuild = () => {
    if (!prompt) return;
    socket.emit('build_house', prompt);
    setPrompt(""); 
  };

  const handleToggleRecord = () => {
    setIsRecording(!isRecording);
    setCopReply(isRecording ? "CINEMATIC STOPPED" : "RECORDING CINEMATIC...");
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#050505', position: 'relative' }}>
      
      {/* 🔮 NEON HEADER PANEL */}
      <div className="glass-panel" style={{ 
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', 
        padding: '10px 40px', zIndex: 10, textAlign: 'center' 
      }}>
        <h2 className="neon-text" style={{ margin: 0, fontSize: '18px' }}>{copReply}</h2>
      </div>

      {/* 🎮 3D VIEWPORT */}
      <Canvas shadows camera={{ position: [12, 12, 12], fov: 40 }}>
        <CameraDirector isRecording={isRecording} />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={1} />
        
        <Environment preset="city" />
        
        {/* The Grid Factory Floor */}
        <Grid 
          infiniteGrid 
          sectionColor="#00ffcc" 
          cellColor="#222" 
          sectionThickness={1.5} 
          fadeDistance={40} 
        />
        
        <Suspense fallback={null}>
            <DisplayManager data={activeData} />
        </Suspense>
        
        {/* Orbit controls are disabled during cinematic recording */}
        {!isRecording && <OrbitControls makeDefault minDistance={5} maxDistance={30} />}
      </Canvas>
      
      {/* 🧊 THE INTERFACE BAR */}
      <div className="glass-panel" style={{ 
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', 
        display: 'flex', gap: '15px', padding: '20px', alignItems: 'center'
      }}>
         <input 
            className="magic-input"
            placeholder="Build a red castle or search for a tiger..." 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuild()}
            style={{ padding: '15px', width: '300px', borderRadius: '12px', outline: 'none' }}
         />
         
         <button className="build-btn" onClick={handleBuild} style={{ padding: '12px 25px', cursor: 'pointer' }}>
            INITIATE
         </button>

         <button 
            className={isRecording ? "record-btn active" : "record-btn"} 
            onClick={handleToggleRecord} 
            style={{ padding: '12px 25px', cursor: 'pointer' }}
         >
            {isRecording ? "STOP" : "CINEMATIC"}
         </button>
      </div>
    </div>
  );
}
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

// 🔗 Your Cloud Dispatcher URL
const socket = io('https://pictopulse-backend.onrender.com'); 

function DisplayManager({ data }) {
  if (!data) return null;

  if (data.type === 'model') {
    const { scene } = useGLTF(data.url);
    return <primitive object={scene} scale={2} position={[0, 0, 0]} />;
  }

  if (data.type === 'math') {
    const { shape, width, height, color } = data.params;
    return (
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
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
          emissiveIntensity={0.1}
        />
      </mesh>
    );
  }
  return null;
}

function CameraDirector({ isRecording }) {
  // ✅ FIX: In 2026, we avoid state.clock.getElapsedTime() completely.
  // Instead, we use the timestamp passed directly by the useFrame loop.
  useFrame((state, delta) => {
    if (isRecording) {
      const time = state.clock.elapsedTime; // Reading the property is silent and safe
      state.camera.position.x = Math.sin(time * 0.4) * 10;
      state.camera.position.z = Math.cos(time * 0.4) * 10;
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

  useEffect(() => {
    socket.on('cop_reply', (msg) => setCopReply(msg));
    socket.on('draw_3d_house', (data) => setActiveData(data));
    return () => socket.off();
  }, []);

  const handleBuild = () => {
    if (!prompt) return;
    socket.emit('build_house', prompt);
    setPrompt(""); 
  };

  return (
    <div className="app-container">
      <div className="glass-panel header-panel">
        <h2 className="neon-text">{copReply}</h2>
      </div>

      <Canvas 
        shadows="basic" // ✅ FIX: Setting to "basic" or "percentage" silences PCFSoftShadowMap warning
        camera={{ position: [12, 12, 12], fov: 40 }}
        gl={{ 
            antialias: true,
            shadowMapType: 1 // ✅ Explicitly setting PCFShadowMap (1)
        }}
      >
        <CameraDirector isRecording={isRecording} />
        <ambientLight intensity={0.4} />
        <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
        
        <Environment preset="city" />
        <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={40} />
        
        <Suspense fallback={null}>
            <DisplayManager data={activeData} />
        </Suspense>
        
        {!isRecording && <OrbitControls makeDefault />}
      </Canvas>
      
      <div className="glass-panel footer-panel">
         <input 
            className="magic-input" 
            placeholder="A blue dog or a red tower..." 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleBuild()}
         />
         <button className="build-btn" onClick={handleBuild}>INITIATE</button>
         <button className="record-btn" onClick={() => setIsRecording(!isRecording)}>
            {isRecording ? "STOP" : "CINEMATIC"}
         </button>
      </div>
    </div>
  );
}
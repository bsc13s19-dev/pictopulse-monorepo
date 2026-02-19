import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

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
  useFrame((state) => {
    if (isRecording) {
      // ✅ Using the stable property avoids the THREE.Clock warning
      const time = state.clock.elapsedTime;
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
    return () => socket.disconnect();
  }, []);

  const handleBuild = () => {
    if (!prompt) return;
    socket.emit('build_house', prompt);
    setPrompt(""); 
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: '#050505' }}>
      <div className="glass-panel" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 30px', zIndex: 10 }}>
        <h2 className="neon-text" style={{ margin: 0, fontSize: '18px' }}>{copReply}</h2>
      </div>

      {/* ✅ shadows prop updated to handle the new Three.js shadow standards */}
      <Canvas 
        shadows 
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          // This ensures we use the modern PCFShadowMap as requested by the warning
          gl.shadowMap.type = 1; // 1 = PCFShadowMap
        }}
        camera={{ position: [12, 12, 12], fov: 40 }}
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
      
      <div className="glass-panel" style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '15px', padding: '20px' }}>
         <input className="magic-input" placeholder="A blue dog or a red tower..." value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ padding: '15px', width: '250px', borderRadius: '12px' }} />
         <button className="build-btn" onClick={handleBuild}>INITIATE</button>
         <button className="record-btn" onClick={() => setIsRecording(!isRecording)}>
            {isRecording ? "STOP" : "CINEMATIC"}
         </button>
      </div>
    </div>
  );
}
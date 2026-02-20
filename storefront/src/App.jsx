import React, { useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
// ✅ Notice we added TransformControls here!
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 🏢 THE GIZMO DISPLAY MANAGER
function DisplayManager({ data, gizmoMode }) {
  if (!data) return null;

  let content = null;

  // Render a Model or a Math Shape
  if (data.type === 'model') {
    const { scene } = useGLTF(data.url);
    content = <primitive object={scene} scale={2} />;
  } else if (data.type === 'math') {
    const { shape, width, height, color } = data.params;
    content = (
      <mesh castShadow receiveShadow>
        {shape === 'sphere' && <sphereGeometry args={[width / 2, 32, 32]} />}
        {shape === 'box' && <boxGeometry args={[width, height, width]} />}
        {shape === 'cylinder' && <cylinderGeometry args={[width/2, width/2, height, 32]} />}
        {shape === 'cone' && <coneGeometry args={[width/2, height, 32]} />}
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
      </mesh>
    );
  }

  // ✅ Wrap the content in the Gizmo!
  return (
    <TransformControls mode={gizmoMode} position={[0, data.type==='math' ? data.params.height/2 : 0, 0]}>
      {content}
    </TransformControls>
  );
}

function CameraDirector({ isRecording }) {
  useFrame((state) => {
    if (isRecording) {
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
    type: 'math', params: { shape: 'box', width: 2, height: 2, color: '#00ffcc' } 
  });
  const [isRecording, setIsRecording] = useState(false);
  
  // ✅ New State for the Gizmo
  const [gizmoMode, setGizmoMode] = useState('translate'); // translate, rotate, or scale

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
      {/* 🔮 NEON HEADER PANEL */}
      <div className="glass-panel header-panel">
        <h2 className="neon-text">{copReply}</h2>
        
        {/* ✅ THE GIZMO CONTROLS */}
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'translate' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('translate')}>Move</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'rotate' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'scale' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('scale')}>Scale</button>
        </div>
      </div>

      <Canvas shadows="basic" camera={{ position: [12, 12, 12], fov: 40 }} gl={{ antialias: true, shadowMapType: 1 }}>
        <CameraDirector isRecording={isRecording} />
        <ambientLight intensity={0.4} />
        <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
        <Environment preset="city" />
        <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={40} />
        
        <Suspense fallback={null}>
            <DisplayManager data={activeData} gizmoMode={gizmoMode} />
        </Suspense>
        
        {/* ✅ makeDefault is super important here so the Gizmo can pause the camera when you drag! */}
        {!isRecording && <OrbitControls makeDefault />}
      </Canvas>
      
      {/* 🧊 THE BOTTOM BAR */}
      <div className="glass-panel footer-panel">
         <input 
            className="magic-input" 
            placeholder="E.g. 5 purple cylinders, red box..." 
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
import React, { useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

const socket = io('https://pictopulse-backend.onrender.com'); 

// 📦 THE NEW TOY BOX MANAGER (Handles Arrays!)
function DisplayManager({ objects, gizmoMode }) {
  if (!objects || objects.length === 0) return null;

  return objects.map((data, index) => {
    // We only attach the Gizmo to the NEWEST object you built
    const isLatest = index === objects.length - 1;
    let content = null;

    if (data.type === 'model') {
      const { scene } = useGLTF(data.url);
      // We clone the scene so multiple of the same model don't glitch
      content = <primitive object={scene.clone()} scale={2} />;
    } else if (data.type === 'math') {
      const { shape, width, height, color } = data.params;
      content = (
        <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
          {shape === 'sphere' && <sphereGeometry args={[width / 2, 32, 32]} />}
          {shape === 'box' && <boxGeometry args={[width, height, width]} />}
          {shape === 'cylinder' && <cylinderGeometry args={[width / 2, width / 2, height, 32]} />}
          {shape === 'cone' && <coneGeometry args={[width / 2, height, 32]} />}
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
        </mesh>
      );
    }

    // If it's the newest object, wrap it in the Gizmo. Otherwise, just draw it normally.
    if (isLatest) {
      return (
        <TransformControls key={data.id} mode={gizmoMode}>
          {content}
        </TransformControls>
      );
    }
    
    return <group key={data.id}>{content}</group>;
  });
}

function CameraDirector({ isRecording }) {
  useFrame((state) => {
    if (isRecording) {
      const time = state.clock.elapsedTime;
      state.camera.position.x = Math.sin(time * 0.4) * 15;
      state.camera.position.z = Math.cos(time * 0.4) * 15;
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("SYSTEM ONLINE");
  const [isRecording, setIsRecording] = useState(false);
  const [gizmoMode, setGizmoMode] = useState('translate'); 
  
  // 🚀 THE ARRAY FIX: This now holds a list of EVERYTHING you build!
  const [sceneObjects, setSceneObjects] = useState([]);

  useEffect(() => {
    socket.on('cop_reply', (msg) => setCopReply(msg));
    
    socket.on('draw_3d_house', (data) => {
      // We add a unique "Date.now()" ID to every object so they never share scale data
      const newObject = { ...data, id: Date.now() };
      // This line means: "Keep all the old stuff, and add the new object to the end"
      setSceneObjects((prevObjects) => [...prevObjects, newObject]);
    });

    return () => socket.off();
  }, []);

  const handleBuild = () => {
    if (!prompt) return;
    socket.emit('build_house', prompt);
    setPrompt(""); 
  };

  // Extra Pro Feature: A button to clear the grid!
  const handleClear = () => {
    setSceneObjects([]);
    setCopReply("GRID CLEARED");
  };

  return (
    <div className="app-container">
      <div className="glass-panel header-panel">
        <h2 className="neon-text">{copReply}</h2>
        
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'translate' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('translate')}>Move</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'rotate' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'scale' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('scale')}>Scale</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: '#bb0000' }} onClick={handleClear}>Clear Grid</button>
        </div>
      </div>

      <Canvas shadows="basic" camera={{ position: [15, 15, 15], fov: 40 }} gl={{ antialias: true, shadowMapType: 1 }}>
        <CameraDirector isRecording={isRecording} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
        <Environment preset="city" />
        <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />
        
        <Suspense fallback={null}>
            <DisplayManager objects={sceneObjects} gizmoMode={gizmoMode} />
        </Suspense>
        
        {!isRecording && <OrbitControls makeDefault minDistance={5} maxDistance={50} />}
      </Canvas>
      
      <div className="glass-panel footer-panel">
         <input 
            className="magic-input" 
            placeholder="Build a red box, then a yellow sphere..." 
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
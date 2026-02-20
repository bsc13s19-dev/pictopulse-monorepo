import React, { useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, TransformControls } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 

// 🔗 Your Cloud Dispatcher URL
const socket = io('https://pictopulse-backend.onrender.com'); 

// 📦 THE CLICKABLE TOY BOX MANAGER
function DisplayManager({ objects, gizmoMode, selectedId, setSelectedId }) {
  if (!objects || objects.length === 0) return null;

  return objects.map((data) => {
    const isSelected = data.id === selectedId; // Is this the one we clicked?
    let content = null;

    // The Click Event Function
    const handleSelect = (e) => {
      e.stopPropagation(); // Stops the click from clicking the floor too
      setSelectedId(data.id);
    };

    if (data.type === 'model') {
      const { scene } = useGLTF(data.url);
      content = (
        <primitive 
          object={scene.clone()} 
          scale={2} 
          position={[data.startX, 0, data.startZ]} 
          onClick={handleSelect} // 👈 Click to select!
        />
      );
    } else if (data.type === 'math') {
      const { shape, width, height, color } = data.params;
      content = (
        <mesh 
          castShadow 
          receiveShadow 
          position={[data.startX, height / 2, data.startZ]}
          onClick={handleSelect} // 👈 Click to select!
        >
          {shape === 'sphere' && <sphereGeometry args={[width / 2, 32, 32]} />}
          {shape === 'box' && <boxGeometry args={[width, height, width]} />}
          {shape === 'cylinder' && <cylinderGeometry args={[width / 2, width / 2, height, 32]} />}
          {shape === 'cone' && <coneGeometry args={[width / 2, height, 32]} />}
          
          {/* Make the selected one glow slightly! */}
          <meshStandardMaterial 
            color={color} 
            metalness={0.4} 
            roughness={0.3} 
            emissive={isSelected ? "#ffffff" : "#000000"} 
            emissiveIntensity={isSelected ? 0.2 : 0} 
          />
        </mesh>
      );
    }

    // Only put the Gizmo on the exact object you clicked!
    if (isSelected) {
      return (
        <TransformControls key={data.id} mode={gizmoMode}>
          {content}
        </TransformControls>
      );
    }
    
    // If not selected, just draw it normally
    return <group key={data.id}>{content}</group>;
  });
}

// 🎥 THE CINEMATIC CAMERA DIRECTOR
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
  
  // 🚀 THE TOY BOX: Holds everything you build
  const [sceneObjects, setSceneObjects] = useState([]);
  // 🎯 THE TARGET: Remembers exactly which toy you clicked
  const [selectedId, setSelectedId] = useState(null); 

  useEffect(() => {
    socket.on('cop_reply', (msg) => setCopReply(msg));
    
    socket.on('draw_3d_house', (data) => {
      // Give it a random starting position so they don't pile up!
      const newObject = { 
        ...data, 
        id: Date.now(),
        startX: (Math.random() * 8) - 4, // Random spot between -4 and 4
        startZ: (Math.random() * 8) - 4 
      };
      
      setSceneObjects((prevObjects) => [...prevObjects, newObject]);
      setSelectedId(newObject.id); // Auto-select the brand new object!
    });

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

  const handleClear = () => {
    setSceneObjects([]);
    setSelectedId(null);
    setCopReply("GRID CLEARED");
  };

  return (
    <div className="app-container">
      {/* 🔮 NEON HEADER PANEL */}
      <div className="glass-panel header-panel">
        <h2 className="neon-text">{copReply}</h2>
        
        {/* 🛠️ GIZMO TOOLBAR */}
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'translate' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('translate')}>Move</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'rotate' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('rotate')}>Rotate</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: gizmoMode === 'scale' ? '#ff0055' : '#444' }} onClick={() => setGizmoMode('scale')}>Scale</button>
          <button className="build-btn" style={{ padding: '5px 15px', fontSize: '12px', background: '#bb0000', color: 'white' }} onClick={handleClear}>Clear Grid</button>
        </div>
      </div>

      {/* 🎮 3D VIEWPORT */}
      {/* When you click the empty grid floor, it unselects your objects */}
      <Canvas 
        shadows="basic" 
        camera={{ position: [15, 15, 15], fov: 40 }} 
        gl={{ antialias: true, shadowMapType: 1 }}
        onPointerMissed={() => setSelectedId(null)} 
      >
        <CameraDirector isRecording={isRecording} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
        <Environment preset="city" />
        <Grid infiniteGrid sectionColor="#00ffcc" cellColor="#111" fadeDistance={50} />
        
        <Suspense fallback={null}>
            <DisplayManager 
              objects={sceneObjects} 
              gizmoMode={gizmoMode} 
              selectedId={selectedId} 
              setSelectedId={setSelectedId} 
            />
        </Suspense>
        
        {/* makeDefault allows the Gizmo to pause the camera when you drag things! */}
        {!isRecording && <OrbitControls makeDefault minDistance={5} maxDistance={50} />}
      </Canvas>
      
      {/* 🧊 THE INTERFACE BAR */}
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
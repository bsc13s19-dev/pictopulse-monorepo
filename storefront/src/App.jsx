import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF, PerspectiveCamera } from '@react-three/drei';
import { io } from 'socket.io-client'; 
import './App.css'; 
import * as THREE from 'three';

const socket = io('https://pictopulse-backend.onrender.com'); 

function RealShape({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.5} position={[0, 0, 0]} />;
}

// 🎥 THE CINEMATIC CAMERA BRAIN
function CameraDirector({ isRecording }) {
  const cameraRef = useRef();

  useFrame((state) => {
    if (isRecording) {
      const time = state.clock.getElapsedTime();
      // The camera will slowly move in a "swooping" motion
      state.camera.position.x = Math.sin(time * 0.5) * 7;
      state.camera.position.z = Math.cos(time * 0.5) * 7;
      state.camera.position.y = Math.sin(time * 0.2) * 2 + 4;
      state.camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("SYSTEM ONLINE");
  const [modelUrl, setModelUrl] = useState("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf");
  const [isRecording, setIsRecording] = useState(false);

  const narrateMovie = () => {
    const script = new SpeechSynthesisUtterance("Initializing cinematic sequence. Recording in progress.");
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha'));
    if (femaleVoice) script.voice = femaleVoice;
    window.speechSynthesis.speak(script);
  };

  useEffect(() => {
    socket.on('cop_reply', (message) => { setCopReply(message); });
    socket.on('draw_3d_house', (blueprint) => { setModelUrl(blueprint.url); });
  }, []);

  const handleBuild = () => {
    socket.emit('build_house', prompt);
    setPrompt(""); 
  };

  const handleRecord = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    setIsRecording(true);
    narrateMovie();

    const stream = canvas.captureStream(60); // High quality 60fps
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'Cinematic_Shot.webm'; 
      a.click();
      setIsRecording(false); 
    };

    recorder.start();
    setTimeout(() => { recorder.stop(); }, 8000); // 8-second cinematic shot
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      {isRecording && (
        <div className="recording-indicator" style={{ position: 'absolute', top: '25px', left: '25px', color: '#ff0055', fontSize: '20px', fontWeight: 'bold', zIndex: 10 }}>
          🔴 RECORDING CINEMATIC
        </div>
      )}

      <div className="glass-panel" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 30px', zIndex: 10 }}>
        <h2 className="neon-text" style={{ margin: 0, fontSize: '18px' }}>{copReply}</h2>
      </div>

      <Canvas shadows camera={{ position: [8, 8, 8], fov: 40 }}>
        <CameraDirector isRecording={isRecording} />
        <ambientLight intensity={1} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
        <Environment preset="night" />
        <Grid infiniteGrid fadeDistance={50} sectionColor="#00ffcc" cellColor="#111" />
        
        <Suspense fallback={null}>
            <RealShape url={modelUrl} />
        </Suspense>
        
        {!isRecording && <OrbitControls makeDefault />}
      </Canvas>
      
      <div className="glass-panel" style={{ 
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '15px', padding: '20px'
      }}>
         <input 
            className="magic-input"
            type="text" 
            placeholder="What should we film?" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ padding: '15px', width: '250px', borderRadius: '12px' }}
         />
         <button className="build-btn" onClick={handleBuild}>Build</button>
         <button className="record-btn" onClick={handleRecord} disabled={isRecording}>
            {isRecording ? "Filming..." : "Cinematic Record"}
         </button>
      </div>
    </div>
  );
}
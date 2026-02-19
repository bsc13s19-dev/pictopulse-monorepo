import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client'; 
// We are bringing in the paint!
import './App.css'; 

const socket = io('https://pictopulse-monorepo.vercel.app'); // Keep your real Vercel URL!

function RealShape({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.5} position={[0, 0, 0]} />;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("SYSTEM ONLINE");
  const [modelUrl, setModelUrl] = useState("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf");
  const [isRecording, setIsRecording] = useState(false);

  const narrateMovie = () => {
    const script = new SpeechSynthesisUtterance("Action! Welcome to your cinematic 3D tour!");
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google UK English Female'));
    if (femaleVoice) script.voice = femaleVoice;
    script.rate = 0.9; 
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

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'My_3D_Masterpiece.webm'; 
      a.click();
      setIsRecording(false); 
    };

    recorder.start();
    setTimeout(() => { recorder.stop(); }, 8000);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* 🔴 RECORDING LIGHT */}
      {isRecording && (
        <div className="recording-indicator" style={{ position: 'absolute', top: '25px', left: '25px', color: '#ff0055', fontSize: '20px', fontWeight: 'bold', zIndex: 10 }}>
          🔴 REC
        </div>
      )}

      {/* 🔮 NEON COP MESSAGE */}
      <div className="glass-panel" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 30px', zIndex: 10 }}>
        <h2 className="neon-text" style={{ margin: 0, fontSize: '18px' }}>{copReply}</h2>
      </div>

      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 20, 10]} intensity={2} castShadow />
        <Environment preset="city" />
        <Grid infiniteGrid fadeDistance={50} sectionColor="#00ffcc" cellColor="#111" />
        
        <Suspense fallback={null}>
            <RealShape url={modelUrl} />
        </Suspense>
        
        <OrbitControls makeDefault autoRotate autoRotateSpeed={2.5} />
      </Canvas>
      
      {/* 🧊 THE GLASSMORPHISM MAGIC BAR 🧊 */}
      <div className="glass-panel" style={{ 
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '15px', padding: '20px', width: 'auto'
      }}>
         <input 
            className="magic-input"
            type="text" 
            placeholder="Initialize 3D generation..." 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ padding: '15px', width: '300px', borderRadius: '12px', outline: 'none', fontSize: '16px' }}
         />
         <button className="build-btn" onClick={handleBuild} style={{ padding: '0 25px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', textTransform: 'uppercase' }}>
            Initialize
         </button>
         
         <button className="record-btn" onClick={handleRecord} disabled={isRecording} style={{ padding: '0 25px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: isRecording ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}>
            {isRecording ? "Capturing..." : "Record"}
         </button>
      </div>
    </div>
  );
}
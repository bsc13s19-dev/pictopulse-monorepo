import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client'; 

const socket = io('http://localhost:3000');

function RealShape({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.5} position={[0, 0, 0]} />;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [copReply, setCopReply] = useState("Waiting for a message...");
  const [modelUrl, setModelUrl] = useState("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf");
  
  // 🔴 NEW: The memory for our red recording light!
  const [isRecording, setIsRecording] = useState(false);

  // Your locked-in professional narrator
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

  // 📼 THE VIDEO EXPORTER MAGIC 📼
  const handleRecord = () => {
    // 1. Find the 3D window
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // 2. Turn on the Red Light and start the Voiceover!
    setIsRecording(true);
    narrateMovie();

    // 3. Grab the video stream from the canvas
    const stream = canvas.captureStream(30); // 30 Frames Per Second!
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    // 4. When the director yells "Cut!", save the file
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'My_3D_Masterpiece.webm'; // The name of your saved video!
      a.click();
      setIsRecording(false); // Turn off the Red Light
    };

    // 5. Roll Camera!
    recorder.start();

    // 6. Record for exactly 8 seconds, then stop automatically!
    setTimeout(() => {
      recorder.stop();
    }, 8000);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#111', position: 'relative' }}>
      
      {/* 🔴 RECORDING LIGHT 🔴 */}
      {isRecording && (
        <div style={{ position: 'absolute', top: '20px', left: '20px', color: 'red', fontSize: '24px', fontWeight: 'bold', zIndex: 10, animation: 'blink 1s infinite' }}>
          🔴 RECORDING...
        </div>
      )}

      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', color: '#ff00ff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'sans-serif', zIndex: 10 }}>
        Cop says: {copReply}
      </div>

      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 20, 10]} intensity={2} castShadow />
        <Environment preset="city" />
        <Grid infiniteGrid fadeDistance={50} sectionColor="#444" cellColor="#222" />
        
        <Suspense fallback={null}>
            <RealShape url={modelUrl} />
        </Suspense>
        
        <OrbitControls makeDefault autoRotate autoRotateSpeed={3} />
      </Canvas>
      
      {/* THE UPDATED MAGIC BAR */}
      <div style={{ 
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.7)',
        padding: '15px', borderRadius: '20px', border: '1px solid #00ffcc'
      }}>
         <input 
            type="text" 
            placeholder="Type 'fox' or 'lantern'..." 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ padding: '10px', width: '200px', borderRadius: '10px', border: 'none', outline: 'none', fontSize: '16px' }}
         />
         <button onClick={handleBuild} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#00ffcc', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
            BUILD!
         </button>
         
         {/* 🔴 THE RECORD BUTTON 🔴 */}
         <button onClick={handleRecord} disabled={isRecording} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: isRecording ? '#555' : '#ff0044', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: isRecording ? 'not-allowed' : 'pointer' }}>
            {isRecording ? "FILMING..." : "🎥 RECORD"}
         </button>
      </div>
      
      {/* A tiny style trick to make the recording light blink! */}
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
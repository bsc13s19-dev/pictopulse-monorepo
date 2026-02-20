require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling']
});

// 🌐 1. SETUP GEMINI WITH GOOGLE SEARCH
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const brain = ai.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  // This tiny line gives your AI the power to read the whole internet!
  tools: [{ googleSearch: {} }] 
});

// 🧠 THE SUPER BRAIN (Math + Local Datasets)
function askSuperBrain(message) {
  const msg = message.toLowerCase();
  
  // ---------------------------------------------------------
  // 1. THE MATH ENGINE (Shapes & Colors)
  // ---------------------------------------------------------
  const knownShapes = ['box', 'cube', 'sphere', 'ball', 'cylinder', 'cone'];
  const knownColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'grey', 'gold'];
  
  let foundShape = null;
  let foundColor = '#00ffcc'; // Default neon
  let size = 2;

  for (let s of knownShapes) {
    if (msg.includes(s)) { foundShape = (s === 'cube') ? 'box' : (s === 'ball') ? 'sphere' : s; break; }
  }
  
  if (foundShape) {
    for (let c of knownColors) { if (msg.includes(c)) { foundColor = c; break; } }
    const numberMatch = msg.match(/\d+/);
    if (numberMatch) { size = parseInt(numberMatch[0]); if (size > 20) size = 20; }
    
    return { mode: "GENERATE", mathParams: { shape: foundShape, width: size, height: size, color: foundColor } };
  }

  // ---------------------------------------------------------
  // 2. THE LOCAL DATASET (The 3D Dictionary)
  // ---------------------------------------------------------
  // We teach the brain common words so it DOES NOT need to ask Gemini!
  const localDictionary = {
    "car": "car", "ferrari": "car", "bugatti": "car", "truck": "truck",
    "dog": "dog", "cat": "cat", "bird": "bird", "lion": "lion", "tiger": "tiger",
    "tree": "tree", "plant": "plant", "flower": "flower", "grass": "grass",
    "house": "house", "building": "building", "castle": "castle", "tower": "tower",
    "sword": "sword", "gun": "gun", "shield": "shield", "chair": "chair", "table": "table",
    "computer": "computer", "phone": "phone", "robot": "robot", "airplane": "airplane"
  };

  // Search the user's message to see if it matches our offline dictionary
  for (let key in localDictionary) {
    if (msg.includes(key)) {
      return { mode: "SEARCH", searchKeyword: localDictionary[key] }; // Instantly go to Poly Pizza!
    }
  }

  // ---------------------------------------------------------
  // 3. I DON'T KNOW (Fallback to Gemini)
  // ---------------------------------------------------------
  return null; 
}

// 🔌 3. THE DISPATCHER LOGIC
io.on('connection', (socket) => {
  console.log('👷 Master Builder connected!', socket.id);

  socket.on('build_house', async (theMessage) => {
    try {
      // Step A: Ask the SUPER BRAIN first!
      let decision = askSuperBrain(theMessage);

      if (decision !== null) {
        if (decision.mode === "GENERATE") {
          socket.emit('cop_reply', 'Math Engine built this instantly!');
          socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
          return; // Stop here!
        } 
        else if (decision.mode === "SEARCH") {
          socket.emit('cop_reply', `Local Dataset found keyword: ${decision.searchKeyword}...`);
          // Go straight to Poly Pizza without using Gemini!
          const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
          }
          return; // Stop here!
        }
      }

      // Step B: Ask Gemini ONLY IF the Super Brain failed
      socket.emit('cop_reply', 'Super Brain confused. Waking up Cloud LLM...');
      // ... (Keep your existing Gemini code right here) ...
      
      const prompt = `The user wants to build: "${theMessage}". 
      Use your Google Search tool if you need to look up facts (e.g., "fastest car", "tallest building").
      Then decide if we should "SEARCH" a 3D warehouse for a complex object, or "GENERATE" a basic math shape.
      Reply ONLY in raw JSON. Do not use markdown backticks.
      {"mode": "SEARCH" or "GENERATE", "searchKeyword": "single word", "mathParams": {"shape":"box", "width":2, "height":2, "color":"#ffffff"}}`;

      const result = await brain.generateContent(prompt);
      let aiText = result.response.text();
      
      // ✂️ THE BOX CUTTER: Remove Markdown so it doesn't crash
      let cleanText = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      decision = JSON.parse(cleanText);

      // Step C: Execute the decision!
      if (decision.mode === "SEARCH") {
        socket.emit('cop_reply', `Fetching 3D model of: ${decision.searchKeyword}...`);
        const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
          socket.emit('cop_reply', `Model Loaded: ${decision.searchKeyword}!`);
        } else {
          socket.emit('cop_reply', 'Not found in 3D warehouse. Building default shape.');
          socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
        }
      } else {
        socket.emit('cop_reply', 'Generating custom AI architecture...');
        socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
      }

    } catch (error) {
      console.error("System Error:", error);
      socket.emit('cop_reply', 'Brain freeze! Give me a second.');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚓 Cop active on Port ${PORT}`));
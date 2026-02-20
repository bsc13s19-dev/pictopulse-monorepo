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

// 🌐 1. SETUP CLOUD LLM (The Universal Net)
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const brain = ai.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  tools: [{ googleSearch: {} }] 
});

// 🧮 2. THE TYPO FIXER MATH
function fixTypo(userMessage, dictionary) {
  const words = userMessage.toLowerCase().split(/[ ,]+/); // Splits by space or comma
  
  for (let userWord of words) {
    if (userWord.length < 2) continue; // Ignore tiny words like "a"

    for (let safeWord in dictionary) {
      if (userWord === safeWord) return dictionary[safeWord];
      
      let matches = 0;
      for (let char of userWord) {
        if (safeWord.includes(char)) matches++;
      }
      
      let matchPercentage = matches / Math.max(userWord.length, safeWord.length);
      // If 75% of letters match, we assume it's a typo and fix it!
      if (matchPercentage >= 0.75 && Math.abs(userWord.length - safeWord.length) <= 2) {
        console.log(`🤖 Typo Fixed: "${userWord}" ➔ "${safeWord}"`);
        return dictionary[safeWord]; 
      }
    }
  }
  return null; 
}

// 🧠 3. THE LOCAL SUPER BRAIN (Greetings + Commands)
function askSuperBrain(message) {
  const msg = message.toLowerCase().trim();

  // --- PHASE A: THE GREETING GATEKEEPER ---
  const greetings = ["hi", "hello", "hey", "wishes", "morning", "evening", "thanks", "thank you", "sup", "yo"];
  for (let g of greetings) {
    if (msg === g || msg.startsWith(g + " ")) {
      return { mode: "CHAT", text: "Hello Boss! I am the Pictopulse Engine. What are we building today?" };
    }
  }

  // --- PHASE B: THE MATH ENGINE (Shapes & Colors) ---
  const knownShapes = { 'box':'box', 'cube':'box', 'square':'box', 'sphere':'sphere', 'ball':'sphere', 'cylinder':'cylinder', 'cone':'cone', 'pyramid':'cone' };
  const knownColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'grey', 'gold', 'neon'];
  
  const safeShape = fixTypo(msg, knownShapes);
  
  if (safeShape) {
    let foundColor = '#00ffcc'; // Default Pictopulse Neon
    for (let c of knownColors) { if (msg.includes(c)) { foundColor = c; break; } }
    
    let size = 2;
    const numberMatch = msg.match(/\d+/);
    if (numberMatch) { size = parseInt(numberMatch[0]); if (size > 20) size = 20; }
    
    return { mode: "GENERATE", mathParams: { shape: safeShape, width: size, height: size, color: foundColor } };
  }

  // --- PHASE C: THE FAST-LANE 3D DICTIONARY ---
  const localModels = {
    "car": "car", "ferrari": "car", "truck": "truck", "bike": "bike",
    "dog": "dog", "cat": "cat", "bird": "bird", "lion": "lion",
    "tree": "tree", "plant": "plant", "flower": "flower", 
    "house": "house", "building": "building", "castle": "castle",
    "chair": "chair", "table": "table", "sofa": "sofa", "bed": "bed", "desk": "desk"
  };

  const safeModel = fixTypo(msg, localModels);
  if (safeModel) {
    return { mode: "SEARCH", searchKeyword: safeModel }; 
  }

  // --- PHASE D: UNIVERSAL FALLBACK ---
  // If it's not a greeting, not a shape, and not in the fast-lane list... let Gemini handle it!
  return null; 
}

// 🔌 4. THE DISPATCHER LOGIC (Now Crash-Proof!)
io.on('connection', (socket) => {
  console.log('👷 Master Builder connected!', socket.id);

  socket.on('build_house', async (theMessage) => {
    try {
      let decision = askSuperBrain(theMessage);

      if (decision !== null) {
        if (decision.mode === "CHAT") {
          socket.emit('cop_reply', decision.text);
          return; 
        }
        
        if (decision.mode === "GENERATE") {
          socket.emit('cop_reply', `Local Math Engine building a ${decision.mathParams.color} ${decision.mathParams.shape}!`);
          socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
          return; 
        } 
        
        if (decision.mode === "SEARCH") {
          socket.emit('cop_reply', `Local Brain fetching 3D model of: ${decision.searchKeyword}...`);
          
          // 🛡️ THE SAFETY NET: Check if Poly Pizza blocked us!
          try {
            const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
            const textResponse = await response.text(); // Read as raw text first
            
            // If it starts with a <, it's an HTML error page!
            if (textResponse.trim().startsWith('<')) {
              console.log("Poly Pizza blocked the request!");
              socket.emit('cop_reply', `3D Warehouse blocked the request. Generating math shape instead.`);
              socket.emit('draw_3d_house', { type: 'math', params: { shape: 'box', width: 2, height: 2, color: '#ff0055' } });
              return;
            }

            const data = JSON.parse(textResponse);
            if (data.results && data.results.length > 0) {
              socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
            } else {
               socket.emit('cop_reply', `Model not found in database.`);
            }
          } catch (e) {
            socket.emit('cop_reply', `Warehouse connection failed. Building box.`);
            socket.emit('draw_3d_house', { type: 'math', params: { shape: 'box', width: 2, height: 2, color: '#333333' } });
          }
          return; 
        }
      }

      // Step B: UNIVERSAL NET (Gemini handles complex spelling and logic!)
      socket.emit('cop_reply', 'Routing complex request to Cloud AI...');
      
      const prompt = `The user typed: "${theMessage}". 
      If it's a casual conversation, set mode to "CHAT" with a friendly reply.
      If they want to build something, decide if we should "SEARCH" a 3D warehouse for a complex object, or "GENERATE" a basic math shape.
      Reply ONLY in raw JSON.
      {"mode": "CHAT" or "SEARCH" or "GENERATE", "chatReply": "hello!", "searchKeyword": "single word", "mathParams": {"shape":"box", "width":2, "height":2, "color":"#ffffff"}}`;

      const result = await brain.generateContent(prompt);
      let aiText = result.response.text();
      let cleanText = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      decision = JSON.parse(cleanText);

      if (decision.mode === "CHAT") {
        socket.emit('cop_reply', decision.chatReply);
      } 
      else if (decision.mode === "SEARCH") {
        socket.emit('cop_reply', `Cloud AI fetching 3D model of: ${decision.searchKeyword}...`);
        
        // 🛡️ THE SAFETY NET 2: Protect Gemini's search too!
        try {
          const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
          const textResponse = await response.text();
          
          if (textResponse.trim().startsWith('<')) {
             socket.emit('cop_reply', `3D Warehouse locked. Gemini is building a math fallback.`);
             socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
             return;
          }

          const data = JSON.parse(textResponse);
          if (data.results && data.results.length > 0) {
            socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
            socket.emit('cop_reply', `Model Loaded: ${decision.searchKeyword}!`);
          } else {
            socket.emit('cop_reply', `Cloud AI could not find a 3D model. Building default shape.`);
            socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
          }
        } catch (e) {
            socket.emit('cop_reply', `Warehouse connection failed. Building box.`);
            socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
        }
      } 
      else {
        socket.emit('cop_reply', 'Cloud AI generating custom architecture...');
        socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
      }

    } catch (error) {
      console.error("System Error:", error);
      socket.emit('cop_reply', 'Brain freeze! Even the Cloud AI needs a second.');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚓 Cop active on Port ${PORT}`));
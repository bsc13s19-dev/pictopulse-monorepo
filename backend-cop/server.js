require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling']
});

// 💾 1. MONGODB SETUP & SCHEMA
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('🟢 MongoDB Cloud Connected!'))
  .catch(err => console.error('🔴 MongoDB Connection Error:', err));

// This is the blueprint for how a Project is saved in the database
const projectSchema = new mongoose.Schema({
  name: { type: String, default: 'Untitled Blueprint' },
  nodes: { type: Array, default: [] },    // Saves the 2D wall coordinates
  objects: { type: Array, default: [] },  // Saves 3D models and shapes
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model('Project', projectSchema);

// 🌐 2. SETUP CLOUD LLM
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const brain = ai.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  tools: [{ googleSearch: {} }] 
});

// 🧮 3. THE TYPO FIXER MATH
function fixTypo(userMessage, dictionary) {
  const words = userMessage.toLowerCase().split(/[ ,]+/);
  for (let userWord of words) {
    if (userWord.length < 2) continue;
    for (let safeWord in dictionary) {
      if (userWord === safeWord) return dictionary[safeWord];
      let matches = 0;
      for (let char of userWord) { if (safeWord.includes(char)) matches++; }
      let matchPercentage = matches / Math.max(userWord.length, safeWord.length);
      if (matchPercentage >= 0.75 && Math.abs(userWord.length - safeWord.length) <= 2) {
        console.log(`🤖 Typo Fixed: "${userWord}" ➔ "${safeWord}"`);
        return dictionary[safeWord]; 
      }
    }
  }
  return null; 
}

// 🧠 4. THE LOCAL SUPER BRAIN
function askSuperBrain(message) {
  const msg = message.toLowerCase().trim();

  // Greetings
  const greetings = ["hi", "hello", "hey", "sup", "yo"];
  for (let g of greetings) {
    if (msg === g || msg.startsWith(g + " ")) {
      return { mode: "CHAT", text: "Hello Boss! The MongoDB Vault is active. What are we building?" };
    }
  }

  // Math Shapes
  const knownShapes = { 'box':'box', 'cube':'box', 'sphere':'sphere', 'cylinder':'cylinder', 'cone':'cone', 'house':'house' };
  const safeShape = fixTypo(msg, knownShapes);
  if (safeShape) {
    const knownColors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'grey'];
    let foundColor = '#00ffcc';
    for (let c of knownColors) { if (msg.includes(c)) { foundColor = c; break; } }
    let size = 2;
    const numberMatch = msg.match(/\d+/);
    if (numberMatch) { size = parseInt(numberMatch[0]); if (size > 20) size = 20; }
    return { mode: "GENERATE", mathParams: { shape: safeShape, width: size, height: size, color: foundColor } };
  }

  // 3D Models
  const localModels = { "car": "car", "dog": "dog", "tree": "tree", "chair": "chair", "table": "table", "sofa": "sofa" };
  const safeModel = fixTypo(msg, localModels);
  if (safeModel) { return { mode: "SEARCH", searchKeyword: safeModel }; }

  return null; 
}

// 🔌 5. THE DISPATCHER LOGIC
io.on('connection', (socket) => {
  console.log('👷 Master Builder connected!', socket.id);

  // ==========================================
  // 💾 DATABASE SOCKETS
  // ==========================================
  
  // A. Fetch all projects to show in the Left Dock
  socket.on('get_all_projects', async () => {
    try {
      const projects = await Project.find({}, 'name').sort({ createdAt: -1 });
      socket.emit('projects_list', projects);
    } catch (e) {
      console.error("Fetch DB Error:", e);
    }
  });

  // B. Load a specific project when clicked
  socket.on('load_project', async (projectId) => {
    try {
      const project = await Project.findById(projectId);
      if (project) {
        socket.emit('project_loaded', project);
      }
    } catch (e) {
      socket.emit('cop_reply', 'Error loading project from Cloud.');
    }
  });

  // C. Save or Update a project
  socket.on('save_project', async (data) => {
    try {
      let savedProject;
      if (data.id) {
        // Update existing
        savedProject = await Project.findByIdAndUpdate(data.id, { name: data.name, nodes: data.nodes, objects: data.objects }, { new: true });
      } else {
        // Create new
        savedProject = await Project.create({ name: data.name, nodes: data.nodes, objects: data.objects });
      }
      
      // Update the frontend with the official database ID
      socket.emit('project_loaded', savedProject);
      socket.emit('cop_reply', `✅ Successfully saved "${savedProject.name}" to MongoDB!`);
      
      // Refresh the list in the Left Dock for everyone
      const projects = await Project.find({}, 'name').sort({ createdAt: -1 });
      io.emit('projects_list', projects);
    } catch (e) {
      console.error("Save DB Error:", e);
      socket.emit('cop_reply', '❌ Database Error: Could not save project.');
    }
  });

  // ==========================================
  // 🤖 AI BUILDER SOCKETS
  // ==========================================
  socket.on('build_house', async (theMessage) => {
    try {
      let decision = askSuperBrain(theMessage);

      if (decision !== null) {
        if (decision.mode === "CHAT") { socket.emit('cop_reply', decision.text); return; }
        if (decision.mode === "GENERATE") {
          socket.emit('cop_reply', `Local Math Engine building a ${decision.mathParams.shape}!`);
          socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
          return; 
        } 
        if (decision.mode === "SEARCH") {
          socket.emit('cop_reply', `Local Brain fetching 3D model of: ${decision.searchKeyword}...`);
          try {
            const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
            const textResponse = await response.text();
            if (textResponse.trim().startsWith('<')) {
              socket.emit('cop_reply', `3D Warehouse locked. Generating math box.`);
              socket.emit('draw_3d_house', { type: 'math', params: { shape: 'box', width: 2, height: 2, color: '#00ffcc' } });
              return;
            }
            const data = JSON.parse(textResponse);
            if (data.results && data.results.length > 0) socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
          } catch (e) {
            socket.emit('draw_3d_house', { type: 'math', params: { shape: 'box', width: 2, height: 2, color: '#333' } });
          }
          return; 
        }
      }

      socket.emit('cop_reply', 'Routing complex request to Cloud AI...');
      const prompt = `The user typed: "${theMessage}". 
      If it's a casual conversation, set mode to "CHAT" with a friendly reply.
      If they want to build something, decide if we should "SEARCH" a 3D warehouse or "GENERATE" a basic math shape.
      Reply ONLY in raw JSON:
      {"mode": "CHAT" or "SEARCH" or "GENERATE", "chatReply": "hello!", "searchKeyword": "single word", "mathParams": {"shape":"box", "width":2, "height":2, "color":"#ffffff"}}`;

      const result = await brain.generateContent(prompt);
      let aiText = result.response.text();
      let cleanText = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      decision = JSON.parse(cleanText);

      if (decision.mode === "CHAT") { socket.emit('cop_reply', decision.chatReply); } 
      else if (decision.mode === "SEARCH") {
        socket.emit('cop_reply', `Cloud AI fetching 3D model: ${decision.searchKeyword}...`);
        try {
          const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
          const textResponse = await response.text();
          if (textResponse.trim().startsWith('<')) {
             socket.emit('cop_reply', `Warehouse locked. Gemini building a math fallback.`);
             socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
             return;
          }
          const data = JSON.parse(textResponse);
          if (data.results && data.results.length > 0) socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
        } catch (e) {
            socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
        }
      } else {
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
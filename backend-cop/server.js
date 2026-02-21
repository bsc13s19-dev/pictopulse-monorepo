// 🏦 THE MAGIC MATH VAULT V2 (server.js)
// 100% Math. 0% Poly Pizza. 0% Crashes.

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true }
});

// 💾 1. MONGODB CLOUD DATABASE
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('🟢 MongoDB Cloud Connected!'))
  .catch(err => console.error('🔴 MongoDB Connection Error:', err));

const projectSchema = new mongoose.Schema({
  name: { type: String, default: 'Untitled Blueprint' },
  nodes: { type: Array, default: [] },    
  objects: { type: Array, default: [] },  
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model('Project', projectSchema);

// 🌐 2. SETUP GOOGLE GEMINI (The Smart Brain)
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const brain = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

// 🔌 3. THE MASTER DISPATCHER
io.on('connection', (socket) => {
  console.log('👷 Master Builder connected!', socket.id);

  socket.on('get_all_projects', async () => {
    try { const projects = await Project.find({}, 'name').sort({ createdAt: -1 }); socket.emit('projects_list', projects); } 
    catch (e) { console.error("Fetch DB Error:", e); }
  });

  socket.on('load_project', async (projectId) => {
    try { const project = await Project.findById(projectId); if (project) socket.emit('project_loaded', project); } 
    catch (e) { socket.emit('cop_reply', 'Error loading project from Cloud.'); }
  });

  socket.on('save_project', async (data) => {
    try {
      let savedProject = data.id 
        ? await Project.findByIdAndUpdate(data.id, { name: data.name, nodes: data.nodes, objects: data.objects }, { new: true })
        : await Project.create({ name: data.name, nodes: data.nodes, objects: data.objects });
      
      socket.emit('project_loaded', savedProject);
      const projects = await Project.find({}, 'name').sort({ createdAt: -1 });
      io.emit('projects_list', projects);
    } catch (e) { console.error("Save DB Error:", e); }
  });

  // --- 🤖 THE UNIVERSAL MATH BRAIN ---
  socket.on('build_house', async (theMessage) => {
    try {
      socket.emit('cop_reply', 'Thinking really hard... 🧠');
      
      // We ask Gemini to figure out what the user wants!
      const prompt = `You are a Master Builder Robot. The user typed: "${theMessage}". 
      Decide what they want and reply ONLY in hidden JSON format. No extra talking. Do not write the word "json".
      Choose one of these 3 modes:
      1. "CHAT": Just saying hello.
      2. "PROP": They want a piece of furniture (like a chair, table, or car). Provide the searchKeyword.
      3. "BLUEPRINT": They want to build a house, 2BHK, or big building. Provide the projectName.

      Example JSON:
      {"mode": "BLUEPRINT", "projectName": "2BHK Apartment"}`;

      const result = await brain.generateContent(prompt);
      let aiText = result.response.text();
      
      // 🧽 THE MAGIC ERASER: This deletes any weird robot code so it never leaks on the screen!
      let cleanText = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
      let decision = JSON.parse(cleanText);

      // 🚦 THE FACTORY PIPELINE
      if (decision.mode === "CHAT") { 
        socket.emit('cop_reply', "Hello Boss! I am ready to build. Ask me to make a 2BHK!"); 
      } 
      
      else if (decision.mode === "BLUEPRINT") {
        socket.emit('cop_reply', `📐 Math Brain Activated! Slicing the graph paper for your ${decision.projectName}...`);
        
        let autoRooms = [];
        
        // 🍰 THE CAKE SLICER (Procedural Math Generation)
        if (decision.projectName.toLowerCase().includes("2bhk") || theMessage.toLowerCase().includes("2bhk")) {
            // We mathematically slice a 16x16 square into 5 perfect rooms!
            autoRooms = [
                [ {x: 0, y: -8}, {x: 8, y: -8}, {x: 8, y: 0}, {x: 0, y: 0}, {x: 0, y: -8} ],     // Living Room (Bottom Right)
                [ {x: 0, y: 0}, {x: 8, y: 0}, {x: 8, y: 8}, {x: 0, y: 8}, {x: 0, y: 0} ],       // Kitchen (Top Right)
                [ {x: -8, y: -8}, {x: 0, y: -8}, {x: 0, y: 0}, {x: -8, y: 0}, {x: -8, y: -8} ], // Master Bedroom (Bottom Left)
                [ {x: -8, y: 0}, {x: -3, y: 0}, {x: -3, y: 8}, {x: -8, y: 8}, {x: -8, y: 0} ],  // Kids Bedroom (Top Left)
                [ {x: -3, y: 0}, {x: 0, y: 0}, {x: 0, y: 8}, {x: -3, y: 8}, {x: -3, y: 0} ]     // Bathroom (Middle Top)
            ];
            socket.emit('cop_reply', '✨ Done! I just used pure math to draw a 5-room 2BHK. No clicking required!');
        } else {
            // If it's not a 2BHK, just draw a giant square for now!
            autoRooms = [
                [ {x: -5, y: -5}, {x: 5, y: -5}, {x: 5, y: 5}, {x: -5, y: 5}, {x: -5, y: -5} ]
            ];
            socket.emit('cop_reply', `✨ I drew a giant room for your ${decision.projectName}!`);
        }

        // 📡 Shoot the invisible math dots to the Antenna!
        socket.emit('start_blueprint_pipeline', { projectName: decision.projectName, autoNodes: autoRooms });
      }

      else if (decision.mode === "PROP") {
        // 🧱 PARAMETRIC PROPS (No more Poly Pizza!)
        socket.emit('cop_reply', `🛋️ Building a ${decision.searchKeyword} using pure math!`);
        
        let propShape = 'box'; let color = '#3b82f6';
        if (decision.searchKeyword.includes('table') || decision.searchKeyword.includes('desk')) { propShape = 'box'; color = '#8B5A2B'; }
        if (decision.searchKeyword.includes('ball') || decision.searchKeyword.includes('apple')) { propShape = 'sphere'; color = '#ef4444'; }
        if (decision.searchKeyword.includes('tree') || decision.searchKeyword.includes('plant')) { propShape = 'cylinder'; color = '#10b981'; }
        
        socket.emit('draw_3d_house', { type: 'math', params: { shape: propShape, width: 2, height: 2, color: color } });
      } 

    } catch (error) {
      console.error("System Error:", error);
      socket.emit('cop_reply', '🤖 Beep boop! My brain tangled up. Try typing that again!');
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🏦 Magic Math Vault active on Port ${PORT}`));
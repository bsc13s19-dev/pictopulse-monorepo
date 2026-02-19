require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);

// 🚀 THE ADVANCED CLOUD GATE (CORS FIX) 🚀
const io = new Server(server, { 
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'] // This helps bypass cloud firewalls!
});

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const brain = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

io.on('connection', (socket) => {
  console.log('👷 Master Builder connected!', socket.id);

  socket.on('build_house', async (theMessage) => {
    socket.emit('cop_reply', 'Searching the Official 3D warehouse...');

    try {
      // 🧠 NEW CATALOG WITH BULLETPROOF URLS 🧠
      const prompt = `
        You are a 3D building architect. The user wants to build: "${theMessage}".
        We have a catalog of custom 3D models available at these URLs:
        - "spaceship": "https://pictopulse-monorepo.vercel.app/ship.glb"
        - "pizza": "https://pictopulse-monorepo.vercel.app/pizza.glb"
        - "duck": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf"

        Pick the URL that best matches what the user typed. 
        Reply ONLY with a raw JSON object: {"url": "chosen_url_here"}
        Do not use markdown or extra text.
      `;

      const result = await brain.generateContent(prompt);
      const aiResponse = result.response.text();
      
      const aiBlueprint = JSON.parse(aiResponse);

      socket.emit('draw_3d_house', aiBlueprint);
      socket.emit('cop_reply', 'Model loaded!');

    } catch (error) {
      console.error("Brain freeze:", error);
      socket.emit('cop_reply', 'Oops! The AI had a brain freeze.');
    }
  });
});

// Ask the cloud for a port, or use 3000 at home!
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚓 Cloud Cop is awake and listening on Port ${PORT}!`);
});
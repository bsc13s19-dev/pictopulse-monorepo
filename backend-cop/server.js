require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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
        We have a catalog of 4 real 3D models available at these URLs:
        - "duck" (or bird/animal): "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf"
        - "fox" (or dog/pet): "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF/Fox.gltf"
        - "avocado" (or food): "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf"
        - "lantern" (or lamp/building): "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF/Lantern.gltf"

        Pick the URL that best matches what the user typed. If none of them are a good match, pick the "duck" URL.
        Reply ONLY with a raw JSON object containing one key: "url" (the string of the chosen URL).
        Do not use markdown formatting.
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
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// We need this for the "Search" part!
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling']
});

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const brain = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

io.on('connection', (socket) => {
  console.log('👷 Master Builder connected!', socket.id);

  socket.on('build_house', async (theMessage) => {
    socket.emit('cop_reply', 'AI is deciding: Search or Generate?');

    try {
      const prompt = `User wants: "${theMessage}".
      Decide: Should we "SEARCH" for a pre-made model (animals, vehicles, complex props) or "GENERATE" a custom math shape (buildings, blocks, spheres, colored walls)?
      
      Reply ONLY in raw JSON:
      {
        "mode": "SEARCH" or "GENERATE",
        "searchKeyword": "best single word for searching",
        "mathParams": { "shape": "box" or "sphere", "width": 1-10, "height": 1-15, "color": "hexCode" }
      }`;

      const result = await brain.generateContent(prompt);
      const decision = JSON.parse(result.response.text());

      if (decision.mode === "SEARCH") {
        socket.emit('cop_reply', `Searching warehouse for: ${decision.searchKeyword}...`);
        const response = await fetch(`https://poly.pizza/api/search?q=${decision.searchKeyword}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          socket.emit('draw_3d_house', { type: 'model', url: data.results[0].url });
          socket.emit('cop_reply', `Found 3D ${decision.searchKeyword}!`);
        } else {
          socket.emit('cop_reply', 'Not in warehouse. Switching to math...');
          socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
        }
      } else {
        socket.emit('cop_reply', 'Generating custom architecture...');
        socket.emit('draw_3d_house', { type: 'math', params: decision.mathParams });
      }

    } catch (error) {
      console.error("System Error:", error);
      socket.emit('cop_reply', 'Brain freeze! Try again.');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚓 Cop active on Port ${PORT}`));
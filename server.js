const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const GameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // Permite conexiones desde cualquier origen (ajusta en producción)
    methods: ["GET", "POST"]
  }
});

const gameManager = new GameManager();

io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);
  
  // Crear partida
  socket.on('createGame', (playerName) => {
    const gameId = gameManager.createGame(playerName, socket.id);
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
  });

  // Unirse a partida
  socket.on('joinGame', ({ gameId, playerName }) => {
    const result = gameManager.joinGame(gameId, playerName, socket.id);
    if (result.success) {
      socket.join(gameId);
      socket.emit('gameJoined', result.game.getPublicState());
      io.to(gameId).emit('playerJoined', result.game.getPublicState());
    } else {
      socket.emit('error', result.message);
    }
  });

  // Jugador listo
  socket.on('playerReady', (gameId) => {
    const game = gameManager.getGame(gameId);
    if (game) {
      game.setPlayerReady(socket.id);
      const state = game.getPublicState();
      io.to(gameId).emit('gameUpdate', state);
      
      // Iniciar automáticamente si todos están listos
      if (game.allPlayersReady() && game.players.length > 1) {
        game.start();
        io.to(gameId).emit('gameStarted', state);
      }
    }
  });

  // Jugador no listo
  socket.on('playerUnready', (gameId) => {
    const game = gameManager.getGame(gameId);
    if (game) {
      game.setPlayerUnready(socket.id);
      io.to(gameId).emit('gameUpdate', game.getPublicState());
    }
  });

  // Iniciar el juego
  socket.on('startGame', (gameId) => {
    const game = gameManager.getGame(gameId);
    if (game && game.ownerSocketId === socket.id) {
      game.start();
      io.to(gameId).emit('gameStarted', game.getPublicState());
    }
  });

  // Manejar jugada (ej: tirar una carta)
  socket.on('playCard', ({ gameId, card }) => {
    const game = gameManager.getGame(gameId);
    if (game) {
      game.playCard(socket.id, card);
      io.to(gameId).emit('gameUpdate', game.getPublicState());
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    gameManager.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
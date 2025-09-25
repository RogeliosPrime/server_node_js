const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const GameManager = require('./gameManager');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const gameManager = new GameManager(io); 
// Emitir actualizaciones de tiempo cada segundo
setInterval(() => {
    Object.values(gameManager.games).forEach(game => {
        if (game.started && game.turnTimer) {
            const timeRemaining = game.turnTimer ? 
                Math.ceil((game.turnTimer._idleStart + game.turnTimer._idleTimeout - Date.now()) / 1000) : 0;
            
            game.emitToRoom('timerUpdate', timeRemaining);
        }
    });
}, 1000);

io.on('connection', (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    // Crear partida
    socket.on('createGame', ({playerName}) => {
        const gameId = gameManager.createGame(playerName, socket.id);
        socket.join(gameId);
        socket.emit('gameCreated', gameId);
        console.log(`room: ${gameId}`);
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
        socket.data.playerName = playerName;
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
                io.to(gameId).emit('gameStarted', game.getPublicState());
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

    // Manejar jugada
    socket.on('playCard', ({ gameId, card }) => {
        const game = gameManager.getGame(gameId);
        if (game) {
            game.playCard(socket.id, card);
            io.to(gameId).emit('gameUpdate', game.getPublicState());
        }
    });

    socket.on('turnChanged', (data) => {
        console.log(`Turno cambiado a: ${data.newPlayerName}`);
    });
    
    // Escuchar evento personalizado "tu turno"
    socket.on('yourTurn', (data) => {
        console.log(`¡Es tu turno! Tienes ${data.timeLimit/1000} segundos`);
        // Aquí puedes activar animaciones/notificaciones en la UI
    });

    // Robar carta
    socket.on('getDeckCard', (gameId) => {
        const game = gameManager.getGame(gameId);
        if (game) {
            const card = game.getDeckCard(socket.id);
            if (card) {
                io.to(gameId).emit('gameUpdate', game.getPublicState());
            }
        }
    });

    // Llamar a gringo
    socket.on('callGringo', (gameId) => {
        const game = gameManager.getGame(gameId);
        if (game) {
            game.callGringo(socket.id);
            io.to(gameId).emit('gameUpdate', game.getPublicState());
        }
    });

    // Intercambiar carta
    socket.on('exchangeCard', ({ gameId, card }) => {
        const game = gameManager.getGame(gameId);
        if (game) {
            game.exchangeCard(socket.id, card);
            io.to(gameId).emit('gameUpdate', game.getPublicState());
        }
    });

    // Desconexión
    socket.on('disconnect', () => {
        gameManager.handleDisconnect(socket.id);
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
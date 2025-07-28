const Game = require("./game");

class GameManager {
    constructor(io) {
        this.games = {};
        this.io = io;
    }
    
    createGame(playerName, ownerSocketId) {
        const gameId = this.generateGameId();
        this.games[gameId] = new Game(
            gameId,
            playerName,
            ownerSocketId,
            (event, data) => this.io.to(gameId).emit(event, data),  // Emit to room
            (event, data, socketId) => this.io.to(socketId).emit(event, data)  // Emit to specific player
        );
        return gameId;
    }

    joinGame(gameId, playerName, socketId) {
        const game = this.games[gameId];
        if (!game) return { success: false, message: "Partida no encontrada" };
        if (game.started) return { success: false, message: "La partida ya comenzó" };
        if(game.players.length >= 4) return { success: false, message: "Número de jugadores excedido" };

        // Verificar si el jugador ya está en la partida
        const existingPlayer = game.players.find(player => 
            player.socketId === socketId || player.name === playerName
        );
        
        if (existingPlayer) {
            return { 
                success: false, 
                message: "Ya estás en esta partida",
                isPlayer: true
            };
        }
        game.addPlayer(playerName, socketId);
        return { success: true, game };
    }

    getGame(gameId) {
        return this.games[gameId];
    }

    handleDisconnect(socketId) {
        Object.values(this.games).forEach(game => {
            game.removePlayer(socketId);
            if (game.isEmpty()) delete this.games[game.id];
        });
    }

    generateGameId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }
}

module.exports = GameManager;
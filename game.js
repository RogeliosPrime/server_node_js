class Player {
    constructor(name, socketId) {
        this.name = name;
        this.socketId = socketId;
        this.hand = [];
        this.score = 0;
        this.ready = false;
    }
}

class Game {
    static states = ["normal", "putCard", "gringo"];
    static TURN_TIMEOUT = 30000; // 30 segundos por turno
    
    constructor(id, ownerName, ownerSocketId,emitToRoom,emitToPlayer) {
        this.id = id;
        this.players = [new Player(ownerName, ownerSocketId)];
        this.ownerSocketId = ownerSocketId;
        this.started = false;
        this.deck = this.generateDeck();
        this.lastCard = null;
        this.currentTurn = ownerSocketId;
        this.currentState = Game.states[0];
        this.turnTimer = null; 
        this.emitToRoom = emitToRoom;
        this.emitToPlayer = emitToPlayer;
    }

    setPlayerReady(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        if (player) player.ready = true;
    }

    setPlayerUnready(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        if (player) player.ready = false;
    }

    allPlayersReady() {
        return this.players.length > 0 && 
               this.players.every(player => player.ready);
    }

    addPlayer(name, socketId) {
        this.players.push(new Player(name, socketId));
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
        
        // Si el jugador removido era el del turno actual, pasar al siguiente
        if (socketId === this.currentTurn) {
            this.nextTurn();
        }
    }

    start() {
        this.started = true;
        this.dealCards();
        this.startTurnTimer();
        
        // Notificar a todos los jugadores de sus cartas y estado inicial
        this.notifyAllPlayers();
    }
    
    dealCards() {
        this.players.forEach(player => {
            player.hand = this.deck.splice(0, 4);
        });
    }
    
    // Nuevo método para notificar a todos los jugadores
    notifyAllPlayers() {
        // Enviar estado público a toda la sala
        this.emitToRoom('gameStarted', this.getPublicState());
        
        // Enviar información privada a cada jugador
        this.players.forEach(player => {
            this.emitToPlayer(player.socketId, 'yourHand', {
                hand: player.hand,
                gameId: this.id
            });
        });
    }

    getDeckCard(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        if (player && player.socketId === this.currentTurn && this.deck.length > 0) {
            const card = this.deck.shift();
            player.hand.push(card);
            this.nextTurn(); // Pasar turno después de robar
            return card;
        }
        return null;
    }

    exchangeCard(socketId, card) {
        const player = this.players.find(p => p.socketId === socketId);
        if (!player || player.socketId !== this.currentTurn) return false;
        
        const cardIndex = player.hand.findIndex(c => c.id === card.id);
        if (cardIndex === -1 || this.deck.length === 0) return false;
        
        // Guardar carta jugada como última carta
        this.lastCard = player.hand[cardIndex];
        
        // Reemplazar carta
        player.hand[cardIndex] = this.deck.shift();
        
        this.nextTurn();
        return true;
    }

    playCard(socketId, card) {
        const player = this.players.find(p => p.socketId === socketId);
        if (player && player.socketId === this.currentTurn) {
            const cardIndex = player.hand.findIndex(c => c.id === card.id);
            if (cardIndex === -1) return false;
            
            // Actualizar última carta jugada
            this.lastCard = player.hand[cardIndex];
            
            // Remover carta de la mano
            player.hand.splice(cardIndex, 1);
            
            this.nextTurn();
            return true;
        }
        return false;
    }


    callGringo(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        if (!player || player.socketId !== this.currentTurn) return false;
        
        this.currentState = Game.states[2];
        this.nextTurn();
        return true;
    }

    nextTurn() {
        // Cancelar el timer del turno actual
        this.cancelTurnTimer();
        
        const currentIndex = this.players.findIndex(p => p.socketId === this.currentTurn);
        this.currentTurn = this.players[(currentIndex + 1) % this.players.length].socketId;
        
        if (this.currentState !== "gringo") {
            this.currentState = Game.states[0];
        }
        
        // Notificar al nuevo jugador que es su turno
        if (this.emitToRoom) {
            // 1. Notificación específica solo para el jugador cuyo turno es
            this.emitToPlayer(this.currentTurn, 'yourTurn', {
                message: "¡Es tu turno!",
                timeLimit: Game.TURN_TIMEOUT
            });
            
            // 2. Notificación general para todos en la sala
            this.emitToRoom('turnChanged', {
                newPlayerId: this.currentTurn,
                newPlayerName: this.getPlayerName(this.currentTurn)
            });
        }
        
        // Iniciar timer para el nuevo turno
        this.startTurnTimer();
    }
    
    // Método auxiliar para obtener nombre del jugador
    getPlayerName(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        return player ? player.name : '';
    }
    
    // Método para emitir a un jugador específico
    emitToPlayer(socketId, event, data) {
        if (this.emitToRoom) {
            // Envía el evento solo a este socket específico
            this.emitToRoom(event, data, socketId);
        }
    }

    playerReady(socketId){
        const player = this.players.find(p => p.socketId === socketId);
        player.ready = true;
        this.emitToRoom('onReady', this.getPublicState());
    }

    playerUnready(socketId){
        const player = this.players.find(p => p.socketId === socketId);
        player.ready = false;
        this.emitToRoom('onReady', this.getPublicState());
    }

    startTurnTimer() {
        // Cancelar cualquier timer existente
        this.cancelTurnTimer();
        
        // Crear nuevo timer
        this.turnTimer = setTimeout(() => {
            console.log(`Tiempo agotado para ${this.currentTurn}`);
            this.handleTurnTimeout();
        }, Game.TURN_TIMEOUT);
    }

    cancelTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }

    handleTurnTimeout() {
        const player = this.players.find(p => p.socketId === this.currentTurn);
        if (player) {
            // Acción automática: robar una carta
            let actionTaken = false;
            if (this.deck.length > 0) {
                const card = this.deck.shift();
                player.hand.push(card);
                console.log(`${player.name} robó una carta automáticamente`);
                actionTaken = true;
            }
            
            // Notificar a los jugadores
            if (this.emitToRoom) {
                this.emitToRoom('timeout', {
                    playerId: player.socketId,
                    playerName: player.name,
                    actionTaken: actionTaken,
                    action: actionTaken ? 'drewCard' : 'noAction'
                });
            }
            
            // Pasar al siguiente turno
            this.nextTurn();
        }
    }

    getPublicState() {
        return {
            id: this.id,
            state: this.currentState,
            players: this.players.map(p => ({
                name: p.name,
                score: p.score,
                cardsCount: p.hand.length,
                ready: p.ready
            })),
            currentTurn: this.currentTurn,
            started: this.started,
            lastCard: this.lastCard
        };
    }

    generateDeck() {
        const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let idCounter = 0;
        
        const orderedDeck = suits.flatMap(suit => 
            values.map(value => ({
                id: idCounter++,
                suit,
                value,
            }))
        );
        
        return this.shuffleDeck(orderedDeck);
    }

    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    isEmpty() {
        return this.players.length === 0;
    }
}

module.exports = Game;
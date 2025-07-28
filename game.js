class Player {
    constructor(name, socketId) {
        this.name = name;
        this.socketId = socketId;
        this.hand = [];
        this.score = 0;
    }
}

class Game {
    static states = ["normal", "putCard", "gringo"];
    static TURN_TIMEOUT = 30000; // 30 segundos por turno
    
    constructor(id, ownerName, ownerSocketId) {
        this.id = id;
        this.players = [new Player(ownerName, ownerSocketId)];
        this.ownerSocketId = ownerSocketId;
        this.started = false;
        this.deck = this.generateDeck();
        this.lastCard = null;
        this.currentTurn = ownerSocketId;
        this.currentState = Game.states[0];
        this.turnTimer = null; // Referencia al timeout del turno
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
        this.startTurnTimer(); // Iniciar timer para el primer turno
    }

    dealCards() {
        this.players.forEach(player => {
            player.hand = this.deck.splice(0, 4);
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
        
        // Iniciar timer para el nuevo turno
        this.startTurnTimer();
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
            if (this.deck.length > 0) {
                const card = this.deck.shift();
                player.hand.push(card);
                console.log(`${player.name} robó una carta automáticamente`);
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
                cardsCount: p.hand.length
            })),
            currentTurn: this.currentTurn,
            started: this.started,
            lastCard: this.lastCard,
            turnTimeRemaining: this.turnTimer ? 
                Math.ceil((this.turnTimer._idleStart + this.turnTimer._idleTimeout - Date.now()) / 1000) : 0
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
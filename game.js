class Player {
    constructor(name, socketId) {
      this.name = name;
      this.socketId = socketId;
      this.hand = []; // Cartas en mano
      this.score = 0;
    }
  }
  
  class Game {
    static states = ["normal","putCard","gringo"];
    constructor(id, ownerName, ownerSocketId) {
      this.id = id;
      this.players = [new Player(ownerName, ownerSocketId)];
      this.ownerSocketId = ownerSocketId;
      this.started = false;
      this.deck = this.generateDeck();
      this.lastCard = null;
      this.currentTurn = ownerSocketId;
      this.currentState = Game.states[0];
    }
  
    addPlayer(name, socketId) {
      this.players.push(new Player(name, socketId));
    }
  
    removePlayer(socketId) {
      this.players = this.players.filter(p => p.socketId !== socketId);
    }
  
    start() {
      this.started = true;
      this.dealCards();
    }
  
    dealCards() {
      // Repartir 5 cartas a cada jugador (ejemplo)
      this.players.forEach(player => {
        player.hand = this.deck.splice(0, 4);
      });
    }

    getDeckCard(socketId){
      const player = this.players.find(p => p.socketId === socketId);
      if (player && player.socketId === this.currentTurn) {
        return this.deck[0];
      }
    }

    exchangeCard(socketId, card) {
        const player = this.players.find(p => p.socketId === socketId);
        if (!player || player.socketId !== this.currentTurn) return false;
        
        const cardIndex = player.hand.findIndex(c => c.id === card.id);
        if (cardIndex === -1 || this.deck.length === 0) return false;
    
        // Reemplazar directamente en la misma posición
        player.hand[cardIndex] = this.deck.shift(); // shift() toma la primera carta
        this.nextTurn();
        return true;
    }
  
    playCard(socketId, card) {
      const player = this.players.find(p => p.socketId === socketId);
      if (player && player.socketId === this.currentTurn) {
        // Lógica para validar y procesar la jugada
        player.hand = player.hand.filter(c => c.id !== card.id);
        this.nextTurn();
      }
    }

    callGringo(socketId){
        const player = this.players.find(p => p.socketId === socketId);
        if (!player || player.socketId !== this.currentTurn) return false;
        this.currentState = states[2];
        return true;
    }
  
    nextTurn() {
      const currentIndex = this.players.findIndex(p => p.socketId === this.currentTurn);
      this.currentTurn = this.players[(currentIndex + 1) % this.players.length].socketId;
      if(this.currentState != "gringo") this.currentState = states[0];
    }
  
    getPublicState() {
      return {
        id: this.id,state: this.currentState,
        players: this.players.map(p => ({
          name: p.name,
          score: p.score,
          cardsCount: p.hand.length
        })),
        currentTurn: this.currentTurn,
        started: this.started
      };
    }
  
    generateDeck() {
        // Ejemplo: Deck básico (personaliza según tu juego)
        const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let idCounter = 0;
        
        // Crear el mazo ordenado
        const orderedDeck = suits.flatMap(suit => 
            values.map(value => ({
                id: idCounter++,
                suit: suit,
                value: value,
                // imageUrl: `/cards/${value}_${suit}.png` // Ruta para imágenes
            }))
        );
        
        // Barajar el mazo usando Fisher-Yates shuffle
        return this.shuffleDeck(orderedDeck);
    }

    // Función para barajar el mazo
    shuffleDeck(deck) {
        const shuffled = [...deck]; // Creamos una copia del mazo
        
        // Algoritmo de Fisher-Yates
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
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store game states for online matches
const rooms = {}; // { roomID: { players: { 'X': socket.id, 'O': socket.id }, playerNames: { 'X': 'Player1', 'O': 'Player2' }, board: [], currentTurn: 'X', gameActive: true, playAgainVotes: { 'X': false, 'O': false } } }
let waitingPlayer = null; // Socket for a player waiting for an opponent

// --- Game Logic Functions (Server-side) ---
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

function checkWinner(board) {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Returns 'X' or 'O'
        }
    }
    return null;
}

function isDraw(board) {
    return !board.includes('');
}

// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Join Game (Online Multiplayer) ---
    socket.on('joinGame', (data) => {
        const playerName = data.playerName || `Player ${socket.id.substring(0, 4)}`;

        if (waitingPlayer) {
            // A player is waiting, create a new room
            const roomID = `room_${socket.id.substring(0, 4)}_${waitingPlayer.socket.id.substring(0, 4)}`;

            // Assign symbols randomly
            const playerXSocket = Math.random() < 0.5 ? socket : waitingPlayer.socket;
            const playerOSocket = playerXSocket === socket ? waitingPlayer.socket : socket;

            const playerXName = playerXSocket === socket ? playerName : waitingPlayer.playerName;
            const playerOName = playerOSocket === socket ? playerName : waitingPlayer.playerName;

            rooms[roomID] = {
                players: {
                    'X': playerXSocket.id,
                    'O': playerOSocket.id
                },
                playerNames: {
                    'X': playerXName,
                    'O': playerOName
                },
                board: ['', '', '', '', '', '', '', '', ''],
                currentTurn: 'X',
                gameActive: true,
                playAgainVotes: { 'X': false, 'O': false }
            };

            // Join both sockets to the room
            playerXSocket.join(roomID);
            playerOSocket.join(roomID);

            // Notify both players that a game is found
            playerXSocket.emit('gameFound', { opponentName: playerOName, roomID: roomID });
            playerOSocket.emit('gameFound', { opponentName: playerXName, roomID: roomID });

            // Start the game for both players - send correct symbol to each
            playerXSocket.emit('gameStart', {
                roomID: roomID,
                playerSymbol: 'X',
                opponentSymbol: 'O',
                playerNames: rooms[roomID].playerNames,
                currentTurn: rooms[roomID].currentTurn
            });
            playerOSocket.emit('gameStart', {
                roomID: roomID,
                playerSymbol: 'O',
                opponentSymbol: 'X',
                playerNames: rooms[roomID].playerNames,
                currentTurn: rooms[roomID].currentTurn
            });

            console.log(`Game started in room: ${roomID} between ${playerXName} (X) and ${playerOName} (O)`);
            waitingPlayer = null; // Clear waiting player
        } else {
            // No player waiting, this player becomes the waiting player
            waitingPlayer = { socket, playerName };
            socket.emit('message', `Waiting for an opponent, ${playerName}...`);
            console.log(`Player ${playerName} (${socket.id}) is waiting for an opponent.`);
        }
    });

    // --- Player Makes a Move ---
    socket.on('makeMove', (data) => {
        const { roomID, cellIndex } = data;
        const room = rooms[roomID];

        if (!room || !room.gameActive) {
            console.warn(`Attempted move in inactive or non-existent room: ${roomID}`);
            return;
        }

        const playerSymbol = Object.keys(room.players).find(key => room.players[key] === socket.id);

        if (!playerSymbol || playerSymbol !== room.currentTurn) {
            console.warn(`Invalid move: Not current player's turn or player not in room. Socket: ${socket.id}, Current Turn: ${room.currentTurn}`);
            return;
        }

        if (room.board[cellIndex] !== '') {
            console.warn(`Invalid move: Cell already taken. Room: ${roomID}, Cell: ${cellIndex}`);
            return;
        }

        room.board[cellIndex] = playerSymbol;
        const winner = checkWinner(room.board);
        const draw = isDraw(room.board);

        if (winner || draw) {
            room.gameActive = false;
            io.to(roomID).emit('gameOver', {
                roomID,
                winner: winner || 'draw',
                board: room.board,
                playerNames: room.playerNames
            });
            console.log(`Game over in room ${roomID}. Winner: ${winner || 'Draw'}`);
        } else {
            room.currentTurn = (playerSymbol === 'X' ? 'O' : 'X');
            io.to(roomID).emit('updateBoard', {
                roomID,
                board: room.board,
                currentTurn: room.currentTurn
            });
        }
    });

    // --- Send Chat Message ---
    socket.on('sendMessage', (data) => {
        const { roomID, message, playerName } = data;
        const room = rooms[roomID];

        if (!room) {
            console.warn(`Chat message attempt in non-existent room: ${roomID}`);
            return;
        }

        // Broadcast message to all players in the room
        io.to(roomID).emit('receiveMessage', {
            playerName: playerName,
            message: message
        });
        console.log(`Message in room ${roomID} from ${playerName}: ${message}`);
    });

    // --- Player Wants to Play Again ---
    socket.on('playAgain', (data) => {
        const { roomID } = data;
        const room = rooms[roomID];

        if (!room) {
            console.warn(`Play again request for non-existent room: ${roomID}`);
            return;
        }

        const playerSymbol = Object.keys(room.players).find(key => room.players[key] === socket.id);
        if (!playerSymbol) {
            console.warn(`Play again request from player not in room: ${socket.id}`);
            return;
        }

        room.playAgainVotes[playerSymbol] = true;

        if (room.playAgainVotes['X'] && room.playAgainVotes['O']) {
            // Both players want to play again, reset and restart
            room.board = ['', '', '', '', '', '', '', '', ''];
            room.currentTurn = 'X';
            room.gameActive = true;
            room.playAgainVotes = { 'X': false, 'O': false }; // Reset votes

            const playerXSocketId = room.players['X'];
            const playerOSocketId = room.players['O'];
            
            io.to(playerXSocketId).emit('gameStart', {
                roomID: roomID,
                playerSymbol: 'X',
                opponentSymbol: 'O',
                playerNames: room.playerNames,
                currentTurn: room.currentTurn
            });
            io.to(playerOSocketId).emit('gameStart', {
                roomID: roomID,
                playerSymbol: 'O',
                opponentSymbol: 'X',
                playerNames: room.playerNames,
                currentTurn: room.currentTurn
            });
            console.log(`Room ${roomID} restarted.`);
        } else {
            // One player voted, waiting for the other
            const opponentSocketId = room.players[playerSymbol === 'X' ? 'O' : 'X'];
            io.to(opponentSocketId).emit('message', `${room.playerNames[playerSymbol]} wants to play again.`);
            socket.emit('message', `Waiting for ${room.playerNames[playerSymbol === 'X' ? 'O' : 'X']} to accept.`);
        }
    });

    // --- Handle Reconnection for existing rooms ---
    socket.on('rejoinRoom', ({ roomID, playerName }) => {
        const room = rooms[roomID];
        if (room) {
            const oldXSocketId = room.players['X'];
            const oldOSocketId = room.players['O'];

            // Check if this socket matches one of the players in the room
            let rejoinedSymbol = null;
            if (oldXSocketId === socket.id) {
                rejoinedSymbol = 'X';
            } else if (oldOSocketId === socket.id) {
                rejoinedSymbol = 'O';
            }

            if (rejoinedSymbol) {
                // The socket reconnected successfully, just ensure it's in the room
                socket.join(roomID);
                console.log(`Player ${playerName} (${socket.id}) rejoined room ${roomID} as ${rejoinedSymbol}.`);

                // Send current game state to the rejoining player
                socket.emit('gameStart', {
                    roomID: roomID,
                    playerSymbol: rejoinedSymbol,
                    opponentSymbol: (rejoinedSymbol === 'X' ? 'O' : 'X'),
                    playerNames: room.playerNames,
                    currentTurn: room.currentTurn
                });
                socket.emit('updateBoard', {
                    roomID: roomID,
                    board: room.board,
                    currentTurn: room.currentTurn
                });
            } else {
                // This socket isn't recognized as a player in that room
                socket.emit('rejoinFailed', 'You are not part of this room.');
            }
        } else {
            socket.emit('rejoinFailed', 'Room not found.');
        }
    });

    // --- Disconnect Handling ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        // If the disconnected player was waiting
        if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
            console.log(`Waiting player ${waitingPlayer.playerName} disconnected.`);
            waitingPlayer = null;
        }

        // Check if the disconnected player was in an active room
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.players['X'] === socket.id || room.players['O'] === socket.id) {
                const opponentSymbol = room.players['X'] === socket.id ? 'O' : 'X';
                const opponentSocketId = room.players[opponentSymbol];

                if (opponentSocketId) {
                    io.to(opponentSocketId).emit('opponentDisconnected');
                    console.log(`Opponent in room ${roomID} disconnected. Notifying ${opponentSocketId}.`);
                }
                delete rooms[roomID]; // Remove the room
                console.log(`Room ${roomID} removed due to player disconnect.`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// --- DOM Elements ---
const modeSelectionSection = document.getElementById('mode-selection');
const offlineModeBtn = document.getElementById('offline-mode-btn');
const onlineModeBtn = document.getElementById('online-mode-btn');

const nameInputSection = document.getElementById('name-input-section');
const player1NameInput = document.getElementById('player1-name');
const player2NameInput = document.getElementById('player2-name');
const startGameBtn = document.getElementById('start-game-btn');

const onlineStatusSection = document.getElementById('online-status-section');
const onlineMessage = document.getElementById('online-message');
const cancelOnlineBtn = document.getElementById('cancel-online-btn');

const gameSection = document.getElementById('game-section');
const statusDisplay = document.getElementById('status');
const boardCells = document.querySelectorAll('.cell');

const gameOverSection = document.getElementById('game-over-section');
const gameOverMessage = document.getElementById('game-over-message');
const playAgainPrompt = document.getElementById('play-again-prompt');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');
const thanksMessage = document.getElementById('thanks-message');

const celebrationContainer = document.getElementById('celebration');

// --- Chat DOM Elements ---
const chatMessagesContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// --- Game State Variables ---
let gameMode = null; // 'offline' or 'online'
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = false;
let player1Name = 'Player 1';
let player2Name = 'Player 2';
let playerSymbol = null; // For online mode: 'X' or 'O' for the current client
let opponentSymbol = null;
let roomID = null;
let socket;

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// --- Utility Functions ---
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
}

function getPlayerName(symbol) {
    if (gameMode === 'offline') {
        return symbol === 'X' ? player1Name : player2Name;
    } else { // Online mode
        return symbol === playerSymbol ? player1Name : player2Name;
    }
}

function getOpponentName() {
    return gameMode === 'offline' ? (currentPlayer === 'X' ? player2Name : player1Name) : player2Name;
}

function updateStatus(message) {
    statusDisplay.textContent = message;
}

function addMessageToChat(playerName, message, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message');
    messageDiv.classList.add(isOwn ? 'own' : 'other');

    const nameSpan = document.createElement('div');
    nameSpan.classList.add('player-name');
    nameSpan.textContent = playerName;

    const textSpan = document.createElement('div');
    textSpan.classList.add('message-text');
    textSpan.textContent = message;

    const timeSpan = document.createElement('div');
    timeSpan.classList.add('message-time');
    const now = new Date();
    timeSpan.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    messageDiv.appendChild(nameSpan);
    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(timeSpan);

    chatMessagesContainer.appendChild(messageDiv);
    // Auto scroll to the bottom
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    if (gameMode === 'offline') {
        // In offline mode, just add message locally
        addMessageToChat(player1Name, message, true);
    } else if (gameMode === 'online') {
        // In online mode, send via socket
        socket.emit('sendMessage', { roomID: roomID, message: message, playerName: player1Name });
        addMessageToChat(player1Name, message, true);
    }
    
    chatInput.value = '';
}

function resetBoardUI() {
    boardCells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('X', 'O');
        cell.classList.remove('win-cell'); // Clear any winning highlight
    });
}

function resetChatUI() {
    chatMessagesContainer.innerHTML = '';
}

function updateBoardUI() {
    board.forEach((cell, index) => {
        boardCells[index].textContent = cell;
        boardCells[index].classList.remove('X', 'O'); // Remove old class
        if (cell) {
            boardCells[index].classList.add(cell);
        }
    });
}

// --- Game Logic ---
function initializeGame(mode, p1Name = 'Player 1', p2Name = 'Player 2', assignedSymbol = 'X') {
    gameMode = mode;
    player1Name = p1Name;
    player2Name = p2Name;
    playerSymbol = assignedSymbol;
    opponentSymbol = (playerSymbol === 'X' ? 'O' : 'X');

    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X'; // Always starts with X
    gameActive = true;
    resetBoardUI();
    resetChatUI();
    hideCelebration();
    showSection(gameSection);
    gameOverSection.classList.add('hidden');
    playAgainPrompt.classList.add('hidden');
    thanksMessage.classList.add('hidden');

    if (gameMode === 'online') {
        updateStatus(`You are ${playerSymbol} (${player1Name}). Opponent is ${opponentSymbol} (${player2Name}).`);
        // Server will send 'turnChange'
    } else {
        updateStatus(`It's ${getPlayerName(currentPlayer)}'s turn`);
    }
}

function handleCellClick(event) {
    const clickedCell = event.target;
    const clickedCellIndex = parseInt(clickedCell.dataset.cellIndex);

    if (board[clickedCellIndex] !== '' || !gameActive) {
        return; // Cell already taken or game not active
    }

    if (gameMode === 'offline') {
        makeMove(clickedCellIndex);
    } else if (gameMode === 'online') {
        if (currentPlayer === playerSymbol) { // Only allow move if it's this client's turn
            socket.emit('makeMove', { roomID: roomID, cellIndex: clickedCellIndex });
        } else {
            updateStatus(`It's ${getPlayerName(currentPlayer)}'s turn (Opponent's turn)`);
        }
    }
}

function makeMove(index) {
    board[index] = currentPlayer;
    updateBoardUI();

    const result = checkResult();
    if (result) {
        endGame(result);
    } else {
        changePlayer();
    }
}

function changePlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus(`It's ${getPlayerName(currentPlayer)}'s turn`);
}

function checkResult() {
    let roundWon = false;
    let winningCells = [];

    for (let i = 0; i < winningConditions.length; i++) {
        const winCondition = winningConditions[i];
        let a = board[winCondition[0]];
        let b = board[winCondition[1]];
        let c = board[winCondition[2]];

        if (a === '' || b === '' || c === '') {
            continue;
        }
        if (a === b && b === c) {
            roundWon = true;
            winningCells = winCondition;
            break;
        }
    }

    if (roundWon) {
        winningCells.forEach(index => {
            boardCells[index].classList.add('win-cell'); // Add a class for winning cells
        });
        return currentPlayer; // Return the winner's symbol
    }

    // Check for draw
    if (!board.includes('')) {
        return 'draw';
    }

    return null; // No winner yet, no draw yet
}

function endGame(result) {
    gameActive = false;
    showSection(gameOverSection);
    playAgainPrompt.classList.remove('hidden');

    if (result === 'draw') {
        gameOverMessage.textContent = "Oops! Match draw. No one wins the match.";
    } else {
        const winnerName = getPlayerName(result);
        gameOverMessage.textContent = `${winnerName} wins the match!`;
        if (gameMode === 'online' && result !== playerSymbol) {
             // If online and opponent won, trigger celebration locally for better UX
             triggerCelebration();
        } else if (gameMode === 'offline' || (gameMode === 'online' && result === playerSymbol)) {
            triggerCelebration();
        }
    }
    updateStatus('Game Over!'); // Clear current turn message
}

function triggerCelebration() {
    celebrationContainer.classList.remove('hidden');
    // Generate random confetti properties
    const numConfetti = 50; // More confetti!
    for (let i = 0; i < numConfetti; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.setProperty('--delay', `${Math.random() * 2}s`);
        confetti.style.setProperty('--x', `${Math.random() * 100 - 50}vw`); // Start X around center
        confetti.style.setProperty('--y', `${Math.random() * -20}vh`); // Start Y above screen
        confetti.style.setProperty('--final-x', `${Math.random() * 100 - 50}vw`); // End X randomly
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 75%)`; // Random color
        confetti.style.width = `${Math.random() * 8 + 5}px`; // Random size
        confetti.style.height = confetti.style.width;
        celebrationContainer.appendChild(confetti);
    }
}

function hideCelebration() {
    celebrationContainer.classList.add('hidden');
    celebrationContainer.innerHTML = ''; // Clear generated confetti elements
}

// --- Event Listeners ---
offlineModeBtn.addEventListener('click', () => {
    gameMode = 'offline';
    player1NameInput.value = 'Player 1';
    player2NameInput.value = 'Player 2';
    showSection(nameInputSection);
});

onlineModeBtn.addEventListener('click', () => {
    gameMode = 'online';
    player1NameInput.value = 'You'; // Default for current client
    player2NameInput.value = 'Opponent'; // Default for opponent
    showSection(nameInputSection);
    // Initialize socket connection
    socket = io();
    setupSocketListeners();
});

cancelOnlineBtn.addEventListener('click', () => {
    socket.disconnect();
    roomID = null;
    showSection(modeSelectionSection);
});

startGameBtn.addEventListener('click', () => {
    player1Name = player1NameInput.value.trim();
    player2Name = player2NameInput.value.trim();

    if (!player1Name || !player2Name) {
        alert('Please enter names for both players.');
        return;
    }

    if (gameMode === 'offline') {
        initializeGame('offline', player1Name, player2Name);
    } else if (gameMode === 'online') {
        showSection(onlineStatusSection);
        onlineMessage.textContent = 'Searching for an opponent...';
        cancelOnlineBtn.classList.remove('hidden');
        socket.emit('joinGame', { playerName: player1Name });
    }
});

boardCells.forEach(cell => cell.addEventListener('click', handleCellClick));

// Chat Event Listeners
sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

yesBtn.addEventListener('click', () => {
    if (gameMode === 'offline') {
        initializeGame('offline', player1Name, player2Name);
    } else if (gameMode === 'online') {
        socket.emit('playAgain', { roomID });
        // The server will respond with gameStart or similar
        onlineMessage.textContent = 'Waiting for opponent to accept...';
        showSection(onlineStatusSection);
        cancelOnlineBtn.classList.add('hidden'); // Cannot cancel in play again state
    }
});

noBtn.addEventListener('click', () => {
    playAgainPrompt.classList.add('hidden');
    thanksMessage.classList.remove('hidden');
    if (gameMode === 'online') {
        socket.disconnect(); // Disconnect if player doesn't want to play again
        roomID = null;
    }
    // Give some time to read "Thanks for playing!" then reset to mode selection
    setTimeout(() => {
        thanksMessage.classList.add('hidden');
        showSection(modeSelectionSection);
    }, 3000);
});

// --- Socket.io Client Setup ---
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
        if (gameMode === 'online' && roomID) {
            // Reconnected, try to rejoin room
            socket.emit('rejoinRoom', { roomID, playerName: player1Name });
        }
    });

    socket.on('message', (msg) => {
        onlineMessage.textContent = msg;
    });

    socket.on('gameFound', (data) => {
        onlineMessage.textContent = `Game found! Playing against ${data.opponentName}.`;
        player2Name = data.opponentName; // Set opponent's name
        roomID = data.roomID;
        // The server will then emit 'gameStart'
    });

    socket.on('gameStart', (data) => {
        roomID = data.roomID;
        player1Name = data.playerNames[data.playerSymbol];
        player2Name = data.playerNames[data.opponentSymbol];
        initializeGame('online', player1Name, player2Name, data.playerSymbol);
        updateStatus(`It's ${getPlayerName(data.currentTurn)}'s turn`);
        cancelOnlineBtn.classList.add('hidden'); // Hide cancel button once game starts
    });

    socket.on('updateBoard', (data) => {
        board = data.board;
        currentPlayer = data.currentTurn;
        updateBoardUI();
        updateStatus(`It's ${getPlayerName(currentPlayer)}'s turn`);
    });

    socket.on('gameOver', (data) => {
        board = data.board; // Ensure client has final board state
        updateBoardUI();
        endGame(data.winner);
        player1Name = data.playerNames[playerSymbol]; // Ensure names are correct for game over message
        player2Name = data.playerNames[opponentSymbol];
    });

    socket.on('receiveMessage', (data) => {
        const { playerName, message } = data;
        addMessageToChat(playerName, message, false);
    });

    socket.on('opponentDisconnected', () => {
        gameActive = false;
        showSection(gameOverSection);
        gameOverMessage.textContent = 'Your opponent disconnected. Game ended.';
        playAgainPrompt.classList.add('hidden');
        thanksMessage.classList.remove('hidden');
        if (roomID) {
            socket.disconnect();
            roomID = null;
        }
        setTimeout(() => {
            thanksMessage.classList.add('hidden');
            showSection(modeSelectionSection);
        }, 3000);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        if (gameMode === 'online' && gameActive) {
             // If in an active online game and socket disconnects unexpectedly
            gameActive = false;
            showSection(gameOverSection);
            gameOverMessage.textContent = 'Disconnected from the server. Game ended.';
            playAgainPrompt.classList.add('hidden');
            thanksMessage.classList.remove('hidden');
            roomID = null;
            setTimeout(() => {
                thanksMessage.classList.add('hidden');
                showSection(modeSelectionSection);
            }, 3000);
        } else if (gameMode === 'online' && onlineStatusSection.classList.contains('hidden') === false) {
            // If waiting for opponent and disconnected
            onlineMessage.textContent = 'Disconnected from server. Please try again.';
            cancelOnlineBtn.classList.add('hidden');
            setTimeout(() => {
                showSection(modeSelectionSection);
            }, 3000);
        }
    });

    socket.on('rejoinFailed', () => {
        console.log('Rejoin failed, starting fresh.');
        roomID = null;
        // Optionally, inform the user they can't rejoin and push to mode selection
        showSection(modeSelectionSection);
    });
}

// --- Initial Setup ---
showSection(modeSelectionSection);
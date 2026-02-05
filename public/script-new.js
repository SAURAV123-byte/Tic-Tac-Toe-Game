// ============== DOM Elements ==============
const modeSelectionSection = document.getElementById('mode-selection');
const offlineTwoPlayerBtn = document.getElementById('offline-two-player-btn');
const offlineAiBtn = document.getElementById('offline-ai-btn');
const onlineModeBtn = document.getElementById('online-mode-btn');

const settingsSection = document.getElementById('settings-section');
const aiDifficultySection = document.getElementById('ai-difficulty-section');
const boardSizeRadios = document.querySelectorAll('input[name="board-size"]');
const firstToNInput = document.getElementById('first-to-n');
const aiDifficultyRadios = document.querySelectorAll('input[name="ai-difficulty"]');
const player1NameInput = document.getElementById('player1-name');
const player2NameInput = document.getElementById('player2-name');
const player1SymbolInput = document.getElementById('player1-symbol');
const player2SymbolInput = document.getElementById('player2-symbol');
const boardColorInput = document.getElementById('board-color');
const player1ColorInput = document.getElementById('player1-color');
const player2ColorInput = document.getElementById('player2-color');
const soundToggle = document.getElementById('sound-toggle');
const player2Label = document.getElementById('player2-label');
const startGameBtn = document.getElementById('start-game-btn');
const backBtn = document.getElementById('back-btn');

const onlineStatusSection = document.getElementById('online-status-section');
const onlineMessage = document.getElementById('online-message');
const cancelOnlineBtn = document.getElementById('cancel-online-btn');

const gameSection = document.getElementById('game-section');
const statusDisplay = document.getElementById('status');
const board = document.getElementById('board');
const boardContainer = document.getElementById('board-container');
const chatMessagesContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

const scoreboard = document.getElementById('scoreboard');
const p1ScoreName = document.getElementById('p1-score-name');
const p2ScoreName = document.getElementById('p2-score-name');
const p1Score = document.getElementById('p1-score');
const p2Score = document.getElementById('p2-score');

const undoBtn = document.getElementById('undo-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');

const gameOverSection = document.getElementById('game-over-section');
const gameOverMessage = document.getElementById('game-over-message');
const playAgainPrompt = document.getElementById('play-again-prompt');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');
const thanksMessage = document.getElementById('thanks-message');
const matchEndBtn = document.getElementById('match-end-btn');

const celebrationContainer = document.getElementById('celebration');

// ============== Game State ==============
let gameMode = null; // 'offline-2p', 'offline-ai', 'online'
let boardSize = 3; // 3x3, 4x4, or 5x5
let firstToN = 1;
let aiDifficulty = 'easy'; // 'easy', 'medium', 'hard'
let board_state = [];
let currentPlayer = 'X';
let gameActive = false;
let isMatchOver = false;

let player1Name = 'Player 1';
let player2Name = 'Player 2';
let player1Symbol = 'X';
let player2Symbol = 'O';
let player1Color = '#ef5350';
let player2Color = '#42a5f5';
let soundEnabled = true;

let player1Score = 0;
let player2Score = 0;

let moveHistory = [];
let socket;
let playerSymbol = null;
let opponentSymbol = null;
let roomID = null;

const winningConditions = {
    3: [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],
    4: [[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],
        [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],
        [0,5,10,15],[3,6,9,12]],
    5: [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
        [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
        [0,6,12,18,24],[4,8,12,16,20]]
};

// ============== Sound Effects ==============
function playSound(type) {
    if (!soundEnabled) return;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'move':
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'win':
            oscillator.frequency.value = 1200;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'draw':
            oscillator.frequency.value = 600;
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
    }
}

// ============== Utility Functions ==============
function showSection(section) {
    document.querySelectorAll('.section:not(.hidden)').forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
}

function initializeBoard() {
    board_state = new Array(boardSize * boardSize).fill('');
    moveHistory = [];
    board.innerHTML = '';
    
    const gridClass = `grid-${boardSize}x${boardSize}`;
    board.className = `grid ${gridClass}`;
    
    for (let i = 0; i < boardSize * boardSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.cellIndex = i;
        cell.addEventListener('click', handleCellClick);
        board.appendChild(cell);
    }
    
    applyCustomization();
}

function applyCustomization() {
    document.documentElement.style.setProperty('--board-color', boardColorInput.value);
    document.documentElement.style.setProperty('--player1-color', player1ColorInput.value);
    document.documentElement.style.setProperty('--player2-color', player2ColorInput.value);
}

function updateBoardUI() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        cell.textContent = board_state[index];
        cell.className = 'cell';
        if (board_state[index]) {
            cell.classList.add(board_state[index] === player1Symbol ? 'X' : 'O');
        }
    });
}

function updateStatus(message) {
    statusDisplay.textContent = message;
}

function updateScore() {
    p1Score.textContent = player1Score;
    p2Score.textContent = player2Score;
    p1ScoreName.textContent = player1Name;
    p2ScoreName.textContent = player2Name;
}

// ============== Game Logic ==============
function checkWinner(state = board_state) {
    const conditions = winningConditions[boardSize];
    for (let condition of conditions) {
        const [first, ...rest] = condition;
        if (state[first] && rest.every(index => state[index] === state[first])) {
            return { winner: state[first], cells: condition };
        }
    }
    return null;
}

function isDraw(state = board_state) {
    return state.every(cell => cell !== '');
}

function makeMove(index) {
    if (board_state[index] !== '' || !gameActive) return false;
    
    moveHistory.push({
        board: [...board_state],
        currentPlayer: currentPlayer,
        index: index
    });
    
    board_state[index] = currentPlayer;
    updateBoardUI();
    playSound('move');
    
    const result = checkWinner();
    if (result) {
        endGame(result.winner, result.cells);
        return true;
    }
    
    if (isDraw()) {
        endGame('draw');
        return true;
    }
    
    currentPlayer = currentPlayer === player1Symbol ? player2Symbol : player1Symbol;
    updateStatus(`${getPlayerName(currentPlayer)}'s turn`);
    
    if (gameMode === 'offline-ai' && currentPlayer === player2Symbol) {
        setTimeout(makeAIMove, 500);
    }
    
    return true;
}

function getPlayerName(symbol) {
    return symbol === player1Symbol ? player1Name : player2Name;
}

function handleCellClick(event) {
    const index = parseInt(event.target.dataset.cellIndex);
    
    if (gameMode === 'offline-2p' || gameMode === 'offline-ai') {
        if (gameMode === 'offline-ai' && currentPlayer === player2Symbol) return;
        makeMove(index);
    } else if (gameMode === 'online') {
        if (currentPlayer === playerSymbol) {
            socket.emit('makeMove', { roomID, cellIndex: index });
        }
    }
}

// ============== AI Logic ==============
function getAvailableMoves(state = board_state) {
    return state.map((cell, index) => cell === '' ? index : null).filter(i => i !== null);
}

function makeAIMove() {
    if (!gameActive) return;
    
    const available = getAvailableMoves();
    if (available.length === 0) return;
    
    let move;
    
    if (aiDifficulty === 'easy') {
        move = available[Math.floor(Math.random() * available.length)];
    } else if (aiDifficulty === 'medium') {
        move = getMediumAIMove(available);
    } else if (aiDifficulty === 'hard') {
        move = getHardAIMove(available);
    }
    
    makeMove(move);
}

function getMediumAIMove(available) {
    // Check if AI can win
    for (let move of available) {
        const testState = [...board_state];
        testState[move] = player2Symbol;
        if (checkWinner(testState)) return move;
    }
    
    // Check if opponent can win and block
    for (let move of available) {
        const testState = [...board_state];
        testState[move] = player1Symbol;
        if (checkWinner(testState)) return move;
    }
    
    // Random move
    return available[Math.floor(Math.random() * available.length)];
}

function getHardAIMove(available) {
    let bestScore = -Infinity;
    let bestMove = available[0];
    
    for (let move of available) {
        const testState = [...board_state];
        testState[move] = player2Symbol;
        const score = minimax(testState, 0, false);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    return bestMove;
}

function minimax(state, depth, isMaximizing) {
    const result = checkWinner(state);
    
    if (result) {
        return result.winner === player2Symbol ? 10 - depth : depth - 10;
    }
    
    if (isDraw(state)) {
        return 0;
    }
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let move of getAvailableMoves(state)) {
            const newState = [...state];
            newState[move] = player2Symbol;
            const score = minimax(newState, depth + 1, false);
            bestScore = Math.max(score, bestScore);
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let move of getAvailableMoves(state)) {
            const newState = [...state];
            newState[move] = player1Symbol;
            const score = minimax(newState, depth + 1, true);
            bestScore = Math.min(score, bestScore);
        }
        return bestScore;
    }
}

// ============== Undo Functionality ==============
function undoMove() {
    if (moveHistory.length < 1) return;
    
    moveHistory.pop();
    
    if (moveHistory.length > 0) {
        const previousState = moveHistory[moveHistory.length - 1];
        board_state = [...previousState.board];
        currentPlayer = previousState.currentPlayer === player1Symbol ? player2Symbol : player1Symbol;
    } else {
        board_state = new Array(boardSize * boardSize).fill('');
        currentPlayer = player1Symbol;
    }
    
    updateBoardUI();
    updateStatus(`${getPlayerName(currentPlayer)}'s turn`);
    gameActive = true;
}

// ============== Game End ==============
function endGame(result, winningCells = []) {
    gameActive = false;
    
    if (result === 'draw') {
        gameOverMessage.textContent = '🤝 Match Draw!';
        updateStatus('Game Over');
        playSound('draw');
    } else {
        const winner = result === player1Symbol ? player1Name : player2Name;
        gameOverMessage.textContent = `🎉 ${winner} Wins!`;
        
        if (result === player1Symbol) {
            player1Score++;
        } else {
            player2Score++;
        }
        
        updateScore();
        triggerCelebration();
        playSound('win');
        
        // Highlight winning cells
        if (winningCells.length > 0) {
            winningCells.forEach(index => {
                document.querySelectorAll('.cell')[index].classList.add('win-cell');
            });
        }
    }
    
    if (player1Score === firstToN || player2Score === firstToN) {
        isMatchOver = true;
        setTimeout(() => {
            showMatchEndMessage();
        }, 1500);
    } else {
        setTimeout(() => {
            showSection(gameOverSection);
            playAgainPrompt.classList.remove('hidden');
            matchEndBtn.classList.add('hidden');
        }, 1500);
    }
}

function showMatchEndMessage() {
    const matchWinner = player1Score === firstToN ? player1Name : player2Name;
    gameOverMessage.textContent = `🏆 ${matchWinner} wins the match ${player1Score}-${player2Score}!`;
    playAgainPrompt.classList.add('hidden');
    matchEndBtn.classList.remove('hidden');
}

function triggerCelebration() {
    celebrationContainer.classList.remove('hidden');
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.setProperty('--delay', `${Math.random() * 2}s`);
        confetti.style.setProperty('--x', `${Math.random() * 100 - 50}vw`);
        confetti.style.setProperty('--y', `${Math.random() * -20}vh`);
        confetti.style.setProperty('--final-x', `${Math.random() * 100 - 50}vw`);
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 75%)`;
        confetti.style.width = `${Math.random() * 8 + 5}px`;
        confetti.style.height = confetti.style.width;
        celebrationContainer.appendChild(confetti);
    }
}

function hideCelebration() {
    celebrationContainer.classList.add('hidden');
    celebrationContainer.innerHTML = '';
}

// ============== Chat ==============
function addMessageToChat(playerName, message, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', isOwn ? 'own' : 'other');
    
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
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    if (gameMode === 'offline-2p' || gameMode === 'offline-ai') {
        addMessageToChat(player1Name, message, true);
    } else if (gameMode === 'online') {
        socket.emit('sendMessage', { roomID, message, playerName: player1Name });
        addMessageToChat(player1Name, message, true);
    }
    
    chatInput.value = '';
}

// ============== Event Listeners ==============
// Mode Selection
offlineTwoPlayerBtn.addEventListener('click', () => {
    gameMode = 'offline-2p';
    aiDifficultySection.classList.add('hidden');
    player2Label.textContent = 'Player 2 Name:';
    player2NameInput.value = 'Player 2';
    showSection(settingsSection);
});

offlineAiBtn.addEventListener('click', () => {
    gameMode = 'offline-ai';
    aiDifficultySection.classList.remove('hidden');
    player2Label.textContent = 'AI Name:';
    player2NameInput.value = 'AI';
    showSection(settingsSection);
});

onlineModeBtn.addEventListener('click', () => {
    gameMode = 'online';
    aiDifficultySection.classList.add('hidden');
    player2Label.textContent = 'Opponent Name:';
    player2NameInput.value = 'Opponent';
    socket = io();
    setupSocketListeners();
    showSection(settingsSection);
});

// Settings
boardSizeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        boardSize = parseInt(e.target.value);
    });
});

aiDifficultyRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        aiDifficulty = e.target.value;
    });
});

soundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
});

backBtn.addEventListener('click', () => {
    if (gameMode === 'online' && socket) {
        socket.disconnect();
    }
    gameMode = null;
    showSection(modeSelectionSection);
});

startGameBtn.addEventListener('click', () => {
    player1Name = player1NameInput.value.trim() || 'Player 1';
    player2Name = player2NameInput.value.trim() || 'Player 2';
    player1Symbol = player1SymbolInput.value || 'X';
    player2Symbol = player2SymbolInput.value || 'O';
    firstToN = Math.max(1, parseInt(firstToNInput.value) || 1);
    
    if (gameMode === 'offline-2p' || gameMode === 'offline-ai') {
        startOfflineGame();
    } else if (gameMode === 'online') {
        showSection(onlineStatusSection);
        onlineMessage.textContent = 'Searching for opponent...';
        cancelOnlineBtn.classList.remove('hidden');
        socket.emit('joinGame', { playerName: player1Name });
    }
});

// Chat
sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// Game Controls
undoBtn.addEventListener('click', () => {
    if (gameMode === 'offline-ai' || gameMode === 'offline-2p') {
        undoMove();
    }
});

restartBtn.addEventListener('click', () => {
    if (gameMode === 'offline-ai' || gameMode === 'offline-2p') {
        startOfflineGame();
    }
});

homeBtn.addEventListener('click', () => {
    if (gameMode === 'online' && socket) {
        socket.disconnect();
    }
    gameMode = null;
    player1Score = 0;
    player2Score = 0;
    isMatchOver = false;
    showSection(modeSelectionSection);
});

// Game Over
yesBtn.addEventListener('click', () => {
    if (!isMatchOver) {
        if (gameMode === 'offline-ai' || gameMode === 'offline-2p') {
            startOfflineGame();
        } else if (gameMode === 'online') {
            socket.emit('playAgain', { roomID });
            onlineMessage.textContent = 'Waiting for opponent...';
            showSection(onlineStatusSection);
        }
    }
});

noBtn.addEventListener('click', () => {
    if (gameMode === 'online' && socket) {
        socket.disconnect();
    }
    player1Score = 0;
    player2Score = 0;
    isMatchOver = false;
    gameMode = null;
    showSection(modeSelectionSection);
});

matchEndBtn.addEventListener('click', () => {
    player1Score = 0;
    player2Score = 0;
    isMatchOver = false;
    gameMode = null;
    showSection(modeSelectionSection);
});

cancelOnlineBtn.addEventListener('click', () => {
    socket.disconnect();
    showSection(modeSelectionSection);
});

function startOfflineGame() {
    initializeBoard();
    player1Score = gameMode === 'offline-2p' ? player1Score : 0;
    player2Score = gameMode === 'offline-2p' ? player2Score : 0;
    currentPlayer = player1Symbol;
    gameActive = true;
    isMatchOver = false;
    
    hideCelebration();
    resetChatUI();
    updateScore();
    updateStatus(`${player1Name}'s turn`);
    showSection(gameSection);
    gameOverSection.classList.add('hidden');
    
    if (gameMode === 'offline-ai' && currentPlayer === player2Symbol) {
        setTimeout(makeAIMove, 500);
    }
}

function resetChatUI() {
    chatMessagesContainer.innerHTML = '';
}

// ============== Socket.io Setup ==============
function setupSocketListeners() {
    socket.on('gameFound', (data) => {
        onlineMessage.textContent = `Found opponent: ${data.opponentName}`;
        roomID = data.roomID;
    });
    
    socket.on('gameStart', (data) => {
        roomID = data.roomID;
        playerSymbol = data.playerSymbol;
        opponentSymbol = data.opponentSymbol;
        player2Name = data.playerNames[opponentSymbol];
        
        player1Symbol = playerSymbol;
        player2Symbol = opponentSymbol;
        
        initializeBoard();
        currentPlayer = player1Symbol;
        gameActive = true;
        
        updateScore();
        updateStatus(`${getPlayerName(currentPlayer)}'s turn`);
        showSection(gameSection);
        gameOverSection.classList.add('hidden');
    });
    
    socket.on('updateBoard', (data) => {
        board_state = data.board;
        currentPlayer = data.currentTurn;
        updateBoardUI();
        updateStatus(`${getPlayerName(currentPlayer)}'s turn`);
    });
    
    socket.on('gameOver', (data) => {
        board_state = data.board;
        updateBoardUI();
        endGame(data.winner, data.winningCells);
    });
    
    socket.on('receiveMessage', (data) => {
        addMessageToChat(data.playerName, data.message, false);
    });
    
    socket.on('opponentDisconnected', () => {
        gameActive = false;
        updateStatus('Opponent disconnected');
    });
}

// ============== Initial Setup ==============
showSection(modeSelectionSection);

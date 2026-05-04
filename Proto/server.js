
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let gamePlayers = {};
let currentQuestion = null;
let questionActive = false;
let answeredPlayers = {};
let questionTimer = null;

const MAX_SCORE = 50;

const questions = [
  {
    question: "Sila ke-1 Pancasila adalah?",
    options: ["Kemanusiaan", "Ketuhanan Yang Maha Esa", "Persatuan", "Keadilan"],
    answer: 1
  },
  {
    question: "Gotong royong termasuk nilai?",
    options: ["Individual", "Persatuan", "Materialisme", "Kapitalisme"],
    answer: 1
  }
];

function generatePlatforms() {
  const platforms = [];
  platforms.push({ x: 0, y: 500, w: 800, h: 50, type: "ground" });

  for (let i = 0; i < 5; i++) {
    platforms.push({
      x: Math.floor(Math.random() * 700),
      y: Math.floor(Math.random() * 400) + 100,
      w: 100,
      h: 20,
      type: Math.random() < 0.4 ? "quiz" : "normal",
      id: i
    });
  }
  return platforms;
}

io.on("connection", (socket) => {

  socket.on("startGame", () => {
    const map = generatePlatforms();
    io.emit("gameStarted", { map });
  });

  socket.on("joinGame", ({ name }) => {
    gamePlayers[socket.id] = { id: socket.id, name, score: 0 };
    socket.emit("allPlayers", Object.values(gamePlayers));
    socket.broadcast.emit("newPlayer", gamePlayers[socket.id]);
  });

  socket.on("move", (data) => {
    socket.broadcast.emit("playerMove", { id: socket.id, x: data.x, y: data.y });
  });

  socket.on("triggerQuiz", () => {
    if (questionActive) return;

    currentQuestion = questions[Math.floor(Math.random() * questions.length)];
    questionActive = true;
    answeredPlayers = {};

    let timeLeft = 10;

    io.emit("newQuestion", { ...currentQuestion });

    questionTimer = setInterval(() => {
      timeLeft--;
      io.emit("timerUpdate", timeLeft);

      if (timeLeft <= 0) {
        clearInterval(questionTimer);
        questionActive = false;
        io.emit("questionEnd");
      }
    }, 1000);
  });

  socket.on("submitAnswer", ({ answer }) => {
    if (!questionActive) return;
    if (answeredPlayers[socket.id]) return;

    answeredPlayers[socket.id] = true;

    const player = gamePlayers[socket.id];
    if (!player) return;

    const correct = answer === currentQuestion.answer;

    if (correct) player.score += 10;

    io.emit("answerResult", {
      playerId: socket.id,
      correct,
      score: player.score
    });

    io.emit("updateLeaderboard", Object.values(gamePlayers));

    if (player.score >= MAX_SCORE) {
      io.emit("gameOver", {
        winner: player.name,
        score: player.score
      });
      questionActive = false;
    }
  });

  socket.on("disconnect", () => {
    delete gamePlayers[socket.id];
    io.emit("playerLeft", socket.id);
  });

});

server.listen(3000, () => console.log("Running on http://localhost:3000"));

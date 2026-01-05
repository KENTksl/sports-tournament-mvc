const express = require("express");
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const config = require(__dirname + "/Config/Setting.json");

const app = express();

// --- Database Connection ---
const { username, password, database } = config.mongodb;
const uri = `mongodb+srv://${username}:${password}@cluster0.u5scqoz.mongodb.net/${database}?retryWrites=true&w=majority`;

mongoose.connect(uri)
    .then(() => console.log('Mongoose connected...'))
    .catch(err => console.error('Mongoose connection error:', err));

// --- Middleware ---
global.__basedir = __dirname;
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/static", express.static(__dirname + "/public"));

// --- View Engine ---
app.set("views", __dirname + "/apps/views");
app.set("view engine", "ejs");

// --- Controllers ---
const controller = require(__dirname + "/apps/controllers");
app.use(controller);

// --- Server Start ---
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, function () {
    console.log(`Server is running on port ${PORT}`);
});

// --- Socket.IO ---
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.set('io', io);

io.on('connection', (socket) => {
    socket.on('join_tournament', (tid) => {
        if (tid) socket.join('tournament:' + String(tid));
    });
    socket.on('join_match', (mid) => {
        if (mid) socket.join('match:' + String(mid));
    });
});

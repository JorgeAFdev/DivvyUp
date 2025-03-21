const express = require("express");
const { connectDB } = require("./mongo/connection");
const http = require('http');
const cors = require("cors");
const { socketServer } = require('./socket/socket.server')
const app = express();
const router = require("./routers/router");

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketServer(server);

app.set('socketio', io);

app.use("/api", router);

connectDB().then(() => console.log("Connected to database!"));

const port = process.env.PORT || 3001;

server.listen(port, () => {
  console.log("Server is up and running ⚡");
});

module.exports = { app, server };

import express from "express";
import http from 'http';
import cors from "cors";
import { connectDB } from "./mongo/connection/index.js";
import { socketServer } from './socket/socket.server.js';
import router from "./routers/router.js";

const app = express();

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

export { app, server };

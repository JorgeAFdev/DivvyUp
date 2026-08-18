import 'dotenv/config';
import express from "express";
import http from 'http';
import cors from "cors";
import { toNodeHandler } from 'better-auth/node';
import { connectDB } from "./mongo/connection/index.js";
import { socketServer } from './socket/socket.server.js';
import { createAuth } from './security/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import router from "./routers/router.js";

const start = async () => {
  // Awaited before createAuth: the mongodbAdapter needs a live mongoose.connection.db.
  await connectDB();
  console.log("Connected to database!");

  const app = express();

  const auth = createAuth();
  app.set('auth', auth);

  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

  // Better Auth reads the raw request body, so its handler must be mounted
  // before express.json() consumes it.
  app.all('/api/auth/*', toNodeHandler(auth));

  app.use(express.json());

  const server = http.createServer(app);
  const io = socketServer(server, auth);
  app.set('socketio', io);

  app.use("/api", router);

  app.use(errorHandler);

  const port = process.env.PORT || 3001;
  server.listen(port, () => {
    console.log("Server is up and running ⚡");
  });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

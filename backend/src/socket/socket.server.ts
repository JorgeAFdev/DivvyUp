import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let clientUrl = process.env.CLIENT_URL

const socketServer = (server: HttpServer) => {
    const io = new Server(server, {
        cors: {
            origin: clientUrl,
        },
    });

    io.on('connection', (socket) => {
        socket.on('register', (userId: string) => {
            socket.join(`user:${userId}`);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
    return io;
};

export { socketServer };
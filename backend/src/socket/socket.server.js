import { Server } from 'socket.io';
import dotenv from 'dotenv';

let clientUrl = process.env.CLIENT_URL

const socketServer = (server) => {
    const io = new Server(server, {
        cors: {
            origin: clientUrl,
        },
    });

    io.on('connection', (socket) => {
        socket.on('register', (userId) => {
            socket.join(`user:${userId}`);
        });

        io.on('disconnect', (socket) => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
    return io;
};

export { socketServer };
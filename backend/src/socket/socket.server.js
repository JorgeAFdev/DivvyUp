import { Server } from 'socket.io';

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

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
    return io;
};

export { socketServer };
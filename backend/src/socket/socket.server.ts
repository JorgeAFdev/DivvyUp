import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from '../security/auth.js';

const socketServer = (server: HttpServer, auth: Auth) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true,
        },
    });

    // Validate the Better Auth session cookie at the handshake. Before this the
    // room was chosen by a userId the client sent in a 'register' event, so any
    // client could join user:<someone-else> and receive their notifications.
    io.use(async (socket, next) => {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(socket.request.headers) });
        if (!session) {
            return next(new Error('Unauthorized'));
        }
        socket.data.userId = session.user.id;
        next();
    });

    io.on('connection', (socket) => {
        socket.join(`user:${socket.data.userId}`);

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });

    return io;
};

export { socketServer };

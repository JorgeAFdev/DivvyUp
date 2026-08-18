import cors from 'cors';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import router from './routers/router.js';
import { createAuth } from './security/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Test-only app. Must be built after connectDB() resolves: createAuth() reads
// mongoose.connection.db. Mirrors index.ts — Better Auth handler before
// express.json(), auth stashed on the app for requireSession — but mounts the
// router at '/' and skips the socket/DB-connect the real server owns.
export const bootstrapApp = () => {
    const app = express();

    const auth = createAuth();
    app.set('auth', auth);

    app.use(cors());

    app.all('/api/auth/*', toNodeHandler(auth));

    app.use(express.json());

    app.use('/', router);

    app.use(errorHandler);

    return app;
}

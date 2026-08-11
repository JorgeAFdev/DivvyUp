import cors from 'cors';
import express from 'express';
import router from './routers/router.js';

export const bootstrapApp = () => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/', router);

    return app;
}



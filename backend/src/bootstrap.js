const cors = require('cors');
const express = require('express');
const router = require('./routers/router');


exports.bootstrapApp = () => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/', router);

    return app;
}



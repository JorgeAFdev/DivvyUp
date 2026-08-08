const express = require('express');
const upload = require('../config/multer.config'); // Middleware de multer
const authController = require('../controllers/auth.controller');

const Router = express.Router();

Router.post('/register', upload.single('profilePicture'), authController.register);
Router.post('/login', authController.login);

module.exports = Router;

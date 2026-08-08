import express from 'express';
import upload from '../config/multer.config.js';
import * as authController from '../controllers/auth.controller.js';

const Router = express.Router();

Router.post('/register', upload.single('profilePicture'), authController.register);
Router.post('/login', authController.login);

export default Router;

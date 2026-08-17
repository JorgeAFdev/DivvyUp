import express from 'express';
import { loginSchema, registerSchema } from '@monorepo/validation';
import upload from '../config/multer.config.js';
import { validate } from '../middlewares/validate.js';
import * as authController from '../controllers/auth.controller.js';

const Router = express.Router();

// validate runs after multer so req.body carries the parsed multipart fields.
Router.post('/register', upload.single('profilePicture'), validate(registerSchema), authController.register);
Router.post('/login', validate(loginSchema), authController.login);

export default Router;

import type { Request, Response } from 'express';
import User from '../schemas/user.schema.js';
import uploadToCloudinary from '../config/cloudinary.config.js';
import { serializeAuthResponse } from '../serializers/contract.js';

const register = async (req: Request, res: Response) => {
    try {
        const { email, name, password } = req.body;
        let profilePicture = '';

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Si hay un archivo de imagen, lo subimos a Cloudinary
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer); // Usamos el buffer de la imagen
            profilePicture = result; // Guarda la URL segura de Cloudinary
        }

        const newUser = new User({ email, name, password, profilePicture });
        const createdUser = await newUser.save();

        // Enviar correo de bienvenida
        // sendEmail(email, 'Welcome to DivvyUp', `Thank you ${name} for registering with DivvyUp!`);

        return res.status(200).json(serializeAuthResponse(createdUser.generateJWT(), createdUser));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error creating new user' });
    }
};

const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const foundUser = await User.findOne({ email }).select('+password');

        // One message for both branches on purpose. Saying which of the two
        // failed tells an attacker whether that address has an account here,
        // which is the first half of a targeted phishing or reset attempt.
        const isMatch = foundUser && await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        return res.status(200).json(serializeAuthResponse(foundUser.generateJWT(), foundUser));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error Logging in' });
    }
};

export { register, login };

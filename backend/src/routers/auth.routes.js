const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../schemas/user.schema');
const sendEmail = require('../services/sendgrid');
const upload = require('../config/multer.config'); // Middleware de multer
const uploadToCloudinary = require('../config/cluodinary.config'); // Función para subir a Cloudinary

const Router = express.Router();

// REGISTER
Router.post('/register', upload.single('profilePicture'), async (req, res) => {
    try {
        const { email, name, password } = req.body;
        let profilePicture = '';

        console.log(email, name, password, req.file);

        if (!email) {
            return res.status(400).json({ error:  'Email not received' });
        }

        if (!password) {
            return res.status(400).json({ error:  'Password not received' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered'  });
        }

        // Si hay un archivo de imagen, lo subimos a Cloudinary
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer); // Usamos el buffer de la imagen
            console.log('Imagen result:', result);
            profilePicture = result; // Guarda la URL segura de Cloudinary
        }

        const newUser = new User({ email, name, password, profilePicture });
        const createdUser = await newUser.save();

        // Enviar correo de bienvenida
        sendEmail(email, 'Welcome to DivvyUp', `Thank you ${name} for registering with DivvyUp!`);

        return res.status(200).json({
            token: await createdUser.generateJWT(),
            user: {
                email: createdUser.email,
                name: createdUser.name,
                id: createdUser._id,
                profilePicture: createdUser.profilePicture,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error creating new user' });
    }
});

// LOGIN
Router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        const foundUser = await User.findOne({ email });

        if (!foundUser) {
            return res.status(400).json({ error:  'User not found, please Register' });
        }

        // Compara la contraseña
        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error:  'Invalid Password' });
        }

        return res.status(200).json({
            token: foundUser.generateJWT(),
            user: {
                email: foundUser.email,
                name: foundUser.name,
                id: foundUser._id,
                profilePicture: foundUser.profilePicture,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error Logging in' });
    }
});

module.exports = Router;

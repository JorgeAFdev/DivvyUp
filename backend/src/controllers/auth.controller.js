import User from '../schemas/user.schema.js';
import uploadToCloudinary from '../config/cloudinary.config.js';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const EMAIL_PATTERN = /.+@.+\..+/;

// Checked here rather than on the schema so a bad request answers 400 where it
// is read, instead of reaching save() and coming back as a ValidationError the
// catch would have to tell apart from a real failure.
const registrationErrors = ({ name, email, password }) => {
    const errors = [];

    if (!name || name.length < 3) errors.push('Name must be at least 3 characters long');
    else if (name.length > 100) errors.push('Name must be at most 100 characters long');

    if (!email) errors.push('Email not received');
    else if (!EMAIL_PATTERN.test(email)) errors.push('Please enter a valid email address');

    if (!password) errors.push('Password not received');
    else if (!PASSWORD_PATTERN.test(password)) {
        errors.push(
            'Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter and a number'
        );
    }

    return errors;
};

const register = async (req, res) => {
    try {
        const { email, name, password } = req.body;
        let profilePicture = '';

        const errors = registrationErrors(req.body);
        if (errors.length) {
            return res.status(400).json({ error: errors.join('. ') });
        }

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
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        const foundUser = await User.findOne({ email }).select('+password');

        // One message for both branches on purpose. Saying which of the two
        // failed tells an attacker whether that address has an account here,
        // which is the first half of a targeted phishing or reset attempt.
        const isMatch = foundUser && await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
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
};

export { register, login };

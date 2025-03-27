const User = require('../schemas/user.schema');
const uploadToCloudinary = require('../config/cluodinary.config');

// Crear un nuevo usuario
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, profilePicture } = req.body;

        const newUser = new User({
            name,
            email,
            password,
            profilePicture, // Asignamos el valor de la foto de perfil
        });

        await newUser.save();
        res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear el usuario', error });
    }
};
exports.getCurrentUser = async (req, res) => {
    try {
        const userId = req.jwtPayload.id;
        const CurrentUser = await User.findById(userId);
        res.status(200).json(CurrentUser);    
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al cargar el usuario solicitado', error });
    }
}

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los usuarios', error });
    }
};

// Actualizar un usuario
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.jwtPayload; // ID del usuario autenticado
        var profilePicture = ''; 
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer); // Usamos el buffer de la imagen
            console.log('Imagen result:', result);
            profilePicture = result; // Guarda la URL segura de Cloudinary
        } else {
                profilePicture = req.jwtPayload.profilePicture;
            };
        const updatedUser = await User.findByIdAndUpdate(id,{name: req.body.name, email: req.body.email, profilePicture} , {
            new: true, // Devuelve el usuario actualizado
        });

        if (!updatedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        console.log('User updated:', updatedUser);
        res.status(200).json({ message: "Usuario actualizado exitosamente", user: updatedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar el usuario", error });
    }
};

// Eliminar un usuario
exports.deleteUser = async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(200).json({ message: 'Usuario eliminado exitosamente', user: deletedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar el usuario', error });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {return res.status(404).json({message: 'User not found'})}
            res.status(200).json(user)
    } catch (error) {
        console.log(error)
            res.status(500).json({ message: 'Error al obtener el usuario', error })
    }
}
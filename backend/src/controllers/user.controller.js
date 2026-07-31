const User = require('../schemas/user.schema');
const uploadToCloudinary = require('../config/cloudinary.config');

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
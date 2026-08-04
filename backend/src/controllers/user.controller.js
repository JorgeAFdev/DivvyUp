const User = require('../schemas/user.schema');
const uploadToCloudinary = require('../config/cloudinary.config');

// Actualizar un usuario
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.jwtPayload; // ID del usuario autenticado
        const changes = { name: req.body.name, email: req.body.email };

        // Only touch the picture when a new one arrives. The JWT payload is
        // {id, name, email}, so the old code assigned undefined and wiped the
        // picture every time someone edited just their name.
        if (req.file) {
            changes.profilePicture = await uploadToCloudinary(req.file.buffer);
        }

        const updatedUser = await User.findByIdAndUpdate(id, changes, {
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
const User = require('../schemas/user.schema');
const uploadToCloudinary = require('../config/cloudinary.config');

const updateUser = async (req, res) => {
    try {
        const { id } = req.jwtPayload;
        const changes = { name: req.body.name, email: req.body.email };

        // Without this guard, an edit with no new file sets profilePicture
        // to undefined and wipes it.
        if (req.file) {
            changes.profilePicture = await uploadToCloudinary(req.file.buffer);
        }

        const updatedUser = await User.findByIdAndUpdate(id, changes, {
            new: true,
        });

        if (!updatedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        res.status(200).json({ message: "Usuario actualizado exitosamente", user: updatedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar el usuario", error });
    }
};

module.exports = { updateUser };
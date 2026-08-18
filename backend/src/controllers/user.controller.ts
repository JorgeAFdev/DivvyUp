import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import uploadToCloudinary from '../config/cloudinary.config.js';
import { serializeSessionUser } from '../serializers/contract.js';
import type { Auth } from '../security/auth.js';

const updateUser = async (req: Request, res: Response) => {
    try {
        const auth = req.app.get('auth') as Auth;
        const headers = fromNodeHeaders(req.headers);

        // Name and picture only. Email is auth-sensitive: changing it goes through
        // Better Auth's verification flow, which lands in a later child PR, so it
        // is read-only here (the form field is disabled).
        const changes: { name: string; image?: string } = { name: req.body.name };
        if (req.file) {
            changes.image = await uploadToCloudinary(req.file.buffer);
        }

        await auth.api.updateUser({ body: changes, headers });

        const session = await auth.api.getSession({ headers });
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        res.status(200).json({ message: 'Usuario actualizado exitosamente', user: serializeSessionUser(session.user) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar el usuario', error });
    }
};

export { updateUser };

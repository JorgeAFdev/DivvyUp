import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { APIError } from 'better-auth/api';
import uploadToCloudinary from '../config/cloudinary.config.js';
import { serializeSessionUser } from '../serializers/contract.js';
import type { Auth } from '../security/auth.js';

const updateUser = async (req: Request, res: Response) => {
    try {
        const auth = req.app.get('auth') as Auth;
        const headers = fromNodeHeaders(req.headers);

        // Name and picture only. Email is auth-sensitive: changing it goes through
        // Better Auth's verification flow, which lands in a later child PR, so it
        // is read-only here. Reject a differing email with 400 rather than accept
        // it, drop it, and answer 200 "success" — the schema still requires the
        // field, so the client echoes the current one.
        if (req.body.email !== req.user.email) {
            return res.status(400).json({ error: 'Email cannot be changed' });
        }

        const changes: { name: string; image?: string } = { name: req.body.name };
        if (req.file) {
            changes.image = await uploadToCloudinary(req.file.buffer);
        }

        await auth.api.updateUser({ body: changes, headers });

        const session = await auth.api.getSession({ headers });
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        res.status(200).json({ message: 'User updated successfully', user: serializeSessionUser(session.user) });
    } catch (error) {
        // A Better Auth failure (e.g. BAD_REQUEST "No fields to update", a revoked
        // session) carries its own status; surface it instead of flattening every
        // case to 500 and serializing the raw error object onto the wire.
        if (error instanceof APIError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Could not update the user' });
    }
};

export { updateUser };

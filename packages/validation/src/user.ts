import { z } from 'zod';
import { registerSchema } from './auth.js';

// Profile update is register minus the password: same name and email rules and
// their copy, no duplication. updateUser does not change the password (there is
// no change-password endpoint), so the field is dropped rather than made
// optional.
export const userUpdateSchema = registerSchema.omit({ password: true });

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

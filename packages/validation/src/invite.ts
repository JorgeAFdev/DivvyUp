import { z } from 'zod';
import { objectId } from './common.js';

// Joining is either "I am this unclaimed member" (memberId) or "add me under
// this name" (name), so the body needs exactly one of the two. The name is
// trimmed here — that is the cleanName the controller used to apply — while
// whether the name collides with an existing member stays a DB check in the
// controller. The :groupId of regenerate reuses groupParamsSchema.
export const joinSchema = z
    .object({
        memberId: objectId('Invalid member ID').optional(),
        name: z.string().trim().optional(),
    })
    .refine((body) => Boolean(body.memberId) || Boolean(body.name), {
        error: 'A memberId or a name is required',
    });

export type JoinInput = z.infer<typeof joinSchema>;

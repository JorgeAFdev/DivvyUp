import { z } from 'zod';

// A member id is a 24-hex string. This validates it without pulling mongoose
// into the package, which the frontend bundles: a regex keeps the input
// contract shared, an ObjectId cast would not. Missing/garbage ids still hit
// the controller's membership check, so this only covers the shape.
const objectId = (message: string) => z.string().regex(/^[0-9a-fA-F]{24}$/, message);

// name is not trimmed here: the group name is stored raw, so its length check
// must see the raw value. Member names are trimmed because the controller
// checks and stores them through cleanName (a trim), so the schema mirrors it.
export const groupMemberSchema = z.object({
    _id: z.string().optional(),
    name: z
        .string({ error: 'Every member needs a name' })
        .trim()
        .min(1, 'Every member needs a name')
        .max(30, 'member name is too large'),
});

export const groupSchema = z.object({
    name: z
        .string({ error: 'Name is required' })
        .min(1, 'Name is required')
        .max(30, 'name is too large'),
    description: z
        .string({ error: 'Description is required' })
        .min(1, 'Description is required')
        .max(50, 'description is too large'),
    members: z
        .array(groupMemberSchema, { error: 'A group needs at least one member' })
        .min(1, 'A group needs at least one member'),
});

export const groupParamsSchema = z.object({
    groupId: objectId('Invalid group ID'),
});

export type GroupInput = z.infer<typeof groupSchema>;
export type GroupMemberInput = z.infer<typeof groupMemberSchema>;

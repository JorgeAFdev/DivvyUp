import mongoose from 'mongoose';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { ZodType } from 'zod';
import { registerSchema, loginSchema } from '@monorepo/validation';

// Same flattening the retired `validate` middleware used, so the auth error copy
// (the shared password/email rules and their text) stays identical to before the
// Better Auth swap. Thrown as an APIError so it surfaces at /api/auth/* as a 400.
const enforce = (schema: ZodType, body: unknown) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new APIError('BAD_REQUEST', {
            message: result.error.issues.map((issue) => issue.message).join('. '),
        });
    }
};

// Built after connectDB() resolves: mongodbAdapter needs a live mongoose.connection.db.
export const createAuth = () =>
    betterAuth({
        baseURL: process.env.BETTER_AUTH_URL,
        secret: process.env.BETTER_AUTH_SECRET,
        // mongoose bundles a different mongodb major than the adapter resolves; the
        // Db is the same driver handle at runtime, so the cast is only the types.
        // Db is taken from the adapter's own signature to avoid a direct 'mongodb'
        // import (not a backend dependency under pnpm's strict node_modules).
        // transaction:false because we pass mongoose's Db, not a MongoClient, and
        // the local mongodb-memory-server is a standalone (no replica set, so no
        // transactions). A single mongodb version is pinned in the root package.json
        // (pnpm overrides) so the adapter's ObjectId/BSON matches mongoose's driver.
        database: mongodbAdapter(mongoose.connection.db as unknown as Parameters<typeof mongodbAdapter>[0], { transaction: false }),
        emailAndPassword: { enabled: true },
        // Let MongoDB own _id (an ObjectId); Better Auth reads it back as its hex
        // string, which is what Group.members[].user stores as the account link.
        advanced: { database: { generateId: false } },
        trustedOrigins: [process.env.CLIENT_URL as string],
        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                if (ctx.path === '/sign-up/email') enforce(registerSchema, ctx.body);
                if (ctx.path === '/sign-in/email') enforce(loginSchema, ctx.body);
            }),
        },
    });

export type Auth = ReturnType<typeof createAuth>;

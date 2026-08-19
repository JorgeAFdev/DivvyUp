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
        // mongoose and the adapter resolve different mongodb majors (pinned to one
        // in pnpm-workspace.yaml), so the cast is types only. Db comes from the
        // adapter signature to avoid importing 'mongodb' (not a backend dep).
        // transaction:false: mongoose's Db is not a MongoClient and the local
        // mongodb-memory-server is a standalone.
        database: mongodbAdapter(mongoose.connection.db as unknown as Parameters<typeof mongodbAdapter>[0], { transaction: false }),
        emailAndPassword: { enabled: true },
        socialProviders: {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID as string,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            },
        },
        // Trusted for linking only because Google verifies the email: a Google
        // sign-in matching an existing account is provably the same person. Never
        // link on a provider that does not verify the email.
        account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
        advanced: {
            // Let MongoDB own _id (an ObjectId); Better Auth reads it back as its
            // hex string, which is what Group.members[].user stores as the link.
            database: { generateId: false },
            // Host-only (no Domain): the API is the sole reader (httpOnly), so the
            // cookie never needs sharing across hosts. crossSubDomainCookies stays
            // off — sibling subdomains could only widen it to the root jorgeaf.dev.
            cookies: { session_token: { name: 'divvyup_session' } },
        },
        trustedOrigins: [process.env.CLIENT_URL as string],
        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                if (ctx.path === '/sign-up/email') enforce(registerSchema, ctx.body);
                if (ctx.path === '/sign-in/email') enforce(loginSchema, ctx.body);
            }),
        },
    });

export type Auth = ReturnType<typeof createAuth>;

import request from 'supertest';
import type { Express } from 'express';

export interface TestUser {
    id: string;
    name: string;
    email: string;
    cookie: string;
}

// Creates a Better Auth user through the mounted sign-up endpoint and returns
// its id and session cookie — the analog of the old User.create + generateJWT.
// The cookie goes on later requests via .set('Cookie', user.cookie).
export const signUp = async (
    app: Express,
    { name, email, password = 'Password1' }: { name: string; email: string; password?: string },
): Promise<TestUser> => {
    const res = await request(app).post('/api/auth/sign-up/email').send({ name, email, password });
    if (res.status !== 200) {
        throw new Error(`sign-up failed (${res.status}): ${JSON.stringify(res.body)}`);
    }
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
    const cookie = setCookie.map((entry) => entry.split(';')[0]).join('; ');
    return { id: res.body.user.id, name, email, cookie };
};

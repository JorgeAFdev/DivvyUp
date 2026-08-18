import supertest from "supertest";
import type { Express } from "express";
import mongoose from "mongoose";
import { bootstrapApp } from "../bootstrap.js";
import { disconnectDB, connectDB } from "../mongo/connection/index.js";

// Registration, hashing, sessions and the credential check are Better Auth's now
// and are its own to test. What stays ours is the Zod hook that gates the Better
// Auth endpoints (registerSchema/loginSchema from @monorepo/validation) and the
// invariant that no secret ever reaches a response. Those are what this file pins.

let app: Express;
let fakeRequest: ReturnType<typeof supertest>;

const signUp = (body: any) => fakeRequest.post("/api/auth/sign-up/email").send(body);
const signIn = (body: any) => fakeRequest.post("/api/auth/sign-in/email").send(body);

const valid = { name: "Ana", email: "ana@user.com", password: "Password1" };

beforeAll(async () => {
    await connectDB();
    app = bootstrapApp();
    fakeRequest = supertest(app);
});

beforeEach(async () => {
    await mongoose.connection.dropDatabase();
});

afterAll(async () => {
    await disconnectDB();
});

describe("sign-up validation (our Zod hook)", () => {
    it("accepts a well-formed sign-up", async () => {
        const response = await signUp(valid);

        expect(response.status).toBe(200);
    });

    const weak: [string, string][] = [
        ["too short", "Pass1"],
        ["no uppercase", "password1"],
        ["no lowercase", "PASSWORD1"],
        ["no number", "Passwordd"],
    ];

    it.each(weak)("rejects a password with %s", async (_label, password) => {
        const response = await signUp({ ...valid, password });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/at least 8 characters/);
    });

    // A rejection must not quote what it rejected, or the password ends up in the
    // response body and any log that records one.
    it.each(weak)("never echoes the password back (%s)", async (_label, password) => {
        const response = await signUp({ ...valid, password });

        expect(JSON.stringify(response.body)).not.toContain(password);
    });

    it("rejects a short name with the exact copy", async () => {
        const response = await signUp({ ...valid, name: "An" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Name must be at least 3 characters long");
    });

    it("rejects a malformed email", async () => {
        const response = await signUp({ ...valid, email: "nope" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Please enter a valid email address");
    });

    it("joins every reason when more than one field fails", async () => {
        const response = await signUp({ name: "An", email: "nope", password: "weak" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Name must be at least 3 characters long. Please enter a valid email address. " +
            "Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter and a number"
        );
    });
});

describe("no secret ever reaches the response", () => {
    it("sign-up never returns the password", async () => {
        const response = await signUp(valid);

        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).not.toContain(valid.password);
    });

    it("sign-in never returns the password", async () => {
        await signUp(valid);
        const response = await signIn({ email: valid.email, password: valid.password });

        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).not.toContain(valid.password);
    });
});

describe("sign-in validation (our Zod hook)", () => {
    it("rejects a malformed email before checking credentials", async () => {
        const response = await signIn({ email: "nope", password: valid.password });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Please enter a valid email address");
    });

    it("rejects a well-formed unknown email as invalid credentials", async () => {
        const response = await signIn({ email: "nobody@user.com", password: "Password1" });

        expect(response.status).toBe(401);
    });
});

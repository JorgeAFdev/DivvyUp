import supertest from "supertest";
import type { Express } from "express";
import mongoose from "mongoose";
import { bootstrapApp } from "../bootstrap.js";
import { disconnectDB, connectDB } from "../mongo/connection/index.js";
import { signUp, type TestUser } from "./helpers/session.js";

let app: Express;
let fakeRequest: ReturnType<typeof supertest>;

const patch = (body: any, cookie: string) =>
    fakeRequest.patch("/user/update").set("Cookie", cookie).send(body);

let jorge: TestUser;

beforeAll(async () => {
    await connectDB();
    app = bootstrapApp();
    fakeRequest = supertest(app);
});

beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    jorge = await signUp(app, { name: "Jorge", email: "jorge@user.com" });
});

afterAll(async () => {
    await disconnectDB();
});

describe("PATCH /user/update", () => {
    it("updates the name", async () => {
        const response = await patch({ name: "Jorge A", email: jorge.email }, jorge.cookie);

        expect(response.status).toBe(200);
        expect(response.body.user.name).toBe("Jorge A");
    });

    it("leaves the email untouched (email change is deferred)", async () => {
        const response = await patch({ name: "Jorge A", email: "jorgea@user.com" }, jorge.cookie);

        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe("jorge@user.com");
    });

    it("never returns the password hash", async () => {
        const response = await patch({ name: "Jorge A", email: jorge.email }, jorge.cookie);

        expect(response.body.user.password).toBeUndefined();
    });

    it("rejects a malformed email", async () => {
        const response = await patch({ name: "Jorge", email: "nope" }, jorge.cookie);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Please enter a valid email address");
    });

    it("rejects a name shorter than 3", async () => {
        const response = await patch({ name: "Jo", email: jorge.email }, jorge.cookie);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Name must be at least 3 characters long");
    });

    it("flattens several field errors in schema order", async () => {
        const response = await patch({}, jorge.cookie);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Name must be at least 3 characters long. Email not received");
    });

    it("rejects a request without a session", async () => {
        const response = await fakeRequest.patch("/user/update").send({ name: "Jorge", email: "jorge@user.com" });

        expect(response.status).toBe(401);
    });
});

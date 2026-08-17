import supertest from "supertest";
import { bootstrapApp } from "../bootstrap.js";
import type { HydratedDocument } from "mongoose";
import { disconnectDB, connectDB } from "../mongo/connection/index.js";
import User from "../schemas/user.schema.js";
import type { UserDoc, UserMethods } from "../schemas/user.schema.js";

const app = bootstrapApp();
const fakeRequest = supertest(app);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const patch = (body?: any, token?: string) =>
    fakeRequest.patch("/user/update").set(auth(token!)).send(body);

let jorge: HydratedDocument<UserDoc, UserMethods>;
let jorgeToken: string;

beforeAll(async () => {
    await connectDB();
});

beforeEach(async () => {
    await User.deleteMany({});
    jorge = await User.create({ name: "Jorge", email: "jorge@user.com", password: "Password1" });
    jorgeToken = jorge.generateJWT();
});

afterAll(async () => {
    await disconnectDB();
});

describe("PATCH /user/update", () => {
    it("updates the name and email", async () => {
        const response = await patch({ name: "Jorge A", email: "jorgea@user.com" }, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.user.name).toBe("Jorge A");
        expect(response.body.user.email).toBe("jorgea@user.com");
    });

    it("never returns the password hash", async () => {
        const response = await patch({ name: "Jorge A", email: "jorgea@user.com" }, jorgeToken);

        expect(response.body.user.password).toBeUndefined();
    });

    it("rejects a malformed email", async () => {
        const response = await patch({ name: "Jorge", email: "nope" }, jorgeToken);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Please enter a valid email address");
    });

    it("rejects a name shorter than 3", async () => {
        const response = await patch({ name: "Jo", email: "jorge@user.com" }, jorgeToken);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Name must be at least 3 characters long");
    });

    it("flattens several field errors in schema order", async () => {
        const response = await patch({}, jorgeToken);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Name must be at least 3 characters long. Email not received");
    });

    it("rejects a request without a token", async () => {
        const response = await fakeRequest.patch("/user/update").send({ name: "Jorge", email: "jorge@user.com" });

        expect(response.status).toBe(401);
    });
});

// Must be set before the modules below are loaded: both jwt.js and user.schema.js
// capture process.env.jwt_secret at import time.
process.env.jwt_secret = process.env.jwt_secret || "test-secret";

const supertest = require("supertest");
const { bootstrapApp } = require("../bootstrap");
const app = bootstrapApp();
const fakeRequest = supertest(app);
const { disconnectDB, connectDB } = require("../mongo/connection");
const User = require("../schemas/user.schema");

const credentials = { email: "jorge@user.com", password: "Password1" };

let jorge;

beforeAll(async () => {
    await connectDB();
});

beforeEach(async () => {
    await User.deleteMany({});
    jorge = await User.create({ name: "Jorge", ...credentials });
});

afterAll(async () => {
    await disconnectDB();
});

describe("POST /auth/login", () => {
    it("returns a token and the user for the right credentials", async () => {
        const response = await fakeRequest.post("/auth/login").send(credentials);

        expect(response.status).toBe(200);
        expect(response.body.token).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
            id: jorge._id.toString(),
            name: "Jorge",
            email: credentials.email,
        });
    });

    it("never returns the password hash", async () => {
        const response = await fakeRequest.post("/auth/login").send(credentials);

        expect(response.body.user.password).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain("$2");
    });

    it("rejects a wrong password", async () => {
        const response = await fakeRequest
            .post("/auth/login")
            .send({ ...credentials, password: "WrongPassword1" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid credentials");
    });

    // Same message as the wrong password on purpose: a different one tells an
    // attacker whether that address has an account here.
    it("rejects an unknown email with the same message", async () => {
        const response = await fakeRequest
            .post("/auth/login")
            .send({ ...credentials, email: "nobody@user.com" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid credentials");
    });
});

describe("POST /auth/register", () => {
    it("creates the user and never returns the password hash", async () => {
        const response = await fakeRequest
            .post("/auth/register")
            .send({ name: "Ana", email: "ana@user.com", password: "Password1" });

        expect(response.status).toBe(200);
        expect(response.body.user.password).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain("$2");
    });

    it("hashes the password so the new user can log in", async () => {
        await fakeRequest
            .post("/auth/register")
            .send({ name: "Ana", email: "ana@user.com", password: "Password1" });

        const stored = await User.findOne({ email: "ana@user.com" }).select("+password");
        expect(stored.password).not.toBe("Password1");

        const response = await fakeRequest
            .post("/auth/login")
            .send({ email: "ana@user.com", password: "Password1" });
        expect(response.status).toBe(200);
    });
});

describe("PATCH /user/update", () => {
    it("never returns the password hash", async () => {
        const response = await fakeRequest
            .patch("/user/update")
            .set({ Authorization: `Bearer ${jorge.generateJWT()}` })
            .send({ name: "Jorge Alvarez", email: credentials.email });

        expect(response.status).toBe(200);
        expect(response.body.user.name).toBe("Jorge Alvarez");
        expect(response.body.user.password).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain("$2");
    });
});

describe("the password field", () => {
    it("stays out of a plain query", async () => {
        const found = await User.findOne({ email: credentials.email });

        expect(found.email).toBe(credentials.email);
        expect(found.password).toBeUndefined();
    });

    it("comes back with select('+password'), which is what login needs", async () => {
        const found = await User.findOne({ email: credentials.email }).select("+password");

        expect(found.password).toEqual(expect.any(String));
        await expect(found.comparePassword(credentials.password)).resolves.toBe(true);
    });
});

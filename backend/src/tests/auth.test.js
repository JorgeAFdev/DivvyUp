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

describe("POST /auth/register password strength", () => {
    const register = (password) =>
        fakeRequest.post("/auth/register").send({ name: "Ana", email: "ana@user.com", password });

    const rejected = [
        ["too short", "Pass1"],
        ["no uppercase", "password1"],
        ["no lowercase", "PASSWORD1"],
        ["no number", "Passwordd"],
    ];

    it.each(rejected)("rejects a password with %s", async (_label, password) => {
        const response = await register(password);

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/at least 8 characters/);
        expect(await User.countDocuments({ email: "ana@user.com" })).toBe(0);
    });

    // A rejection must not quote what it rejected, or the password ends up in
    // the response body and in any log that records one. Mongoose's minlength
    // message does exactly that, which is one reason the rule is not there.
    it.each(rejected)("never echoes the password back (%s)", async (_label, password) => {
        const response = await register(password);

        expect(JSON.stringify(response.body)).not.toContain(password);
    });

    it("accepts a password that meets the rule", async () => {
        const response = await register("Password1");

        expect(response.status).toBe(200);
    });
});

describe("POST /auth/register field validation", () => {
    // These reached save() and came back as a 500 saying "Error creating new
    // user": a client error reported as a server one, with no reason attached.
    it("answers 400 and the reason for a short name", async () => {
        const response = await fakeRequest
            .post("/auth/register")
            .send({ name: "An", email: "ana@user.com", password: "Password1" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Name must be at least 3 characters long");
    });

    it("answers 400 and the reason for a malformed email", async () => {
        const response = await fakeRequest
            .post("/auth/register")
            .send({ name: "Ana", email: "nope", password: "Password1" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Please enter a valid email address");
    });

    it("joins every reason when more than one field fails", async () => {
        const response = await fakeRequest
            .post("/auth/register")
            .send({ name: "An", email: "nope", password: "weak" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
            "Name must be at least 3 characters long. Please enter a valid email address. " +
            "Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter and a number"
        );
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

// Must be set before the modules below are loaded: both jwt.js and user.schema.js
// capture process.env.jwt_secret at import time.
process.env.jwt_secret = process.env.jwt_secret || "test-secret";

const supertest = require("supertest");
const { bootstrapApp } = require("../bootstrap");
const app = bootstrapApp();
const fakeRequest = supertest(app);
const { disconnectDB, connectDB } = require("../mongo/connection");
const Group = require("../schemas/group.schema");
const Expense = require("../schemas/expense.schema");
const Payment = require("../schemas/payment.schema");
const User = require("../schemas/user.schema");

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const post = (path, token, body) => fakeRequest.post(path).set(auth(token)).send(body);
const put = (path, token, body) => fakeRequest.put(path).set(auth(token)).send(body);
const get = (path, token) => fakeRequest.get(path).set(auth(token));

const groupBody = {
    name: "Piso",
    description: "Gastos del piso",
    members: [{ name: "Mamá" }, { name: "Ana" }],
};

const idsOf = (group) => group.members.map((m) => m._id.toString());

const dinnerFor = (group) => {
    const [jorge, mama, ana] = idsOf(group);
    return {
        description: "Cena",
        totalAmount: 30,
        group: group._id,
        paidBy: jorge,
        participants: [
            { member: jorge, amountOwed: 10 },
            { member: mama, amountOwed: 10 },
            { member: ana, amountOwed: 10 },
        ],
    };
};

let jorge;
let ana;
let jorgeToken;
let anaToken;
let group;

beforeAll(async () => {
    await connectDB();
    jorge = await User.create({ name: "Jorge", email: "jorge@user.com", password: "Password1" });
    ana = await User.create({ name: "Ana", email: "ana@user.com", password: "Password1" });
    jorgeToken = jorge.generateJWT();
    anaToken = ana.generateJWT();
});

beforeEach(async () => {
    await Promise.all([Group.deleteMany({}), Expense.deleteMany({}), Payment.deleteMany({})]);
    const response = await post("/group", jorgeToken, groupBody);
    group = await Group.findById(response.body._id);
});

afterAll(async () => {
    await disconnectDB();
});

describe("POST /group", () => {
    it("creates members by name and links the creator from the JWT", async () => {
        const response = await post("/group", jorgeToken, groupBody);

        expect(response.status).toBe(201);
        expect(response.body.members.map((m) => m.name)).toEqual(["Jorge", "Mamá", "Ana"]);
        expect(response.body.members[0].user._id).toBe(jorge._id.toString());
        expect(response.body.members[1].user).toBeNull();
        expect(response.body.inviteCode).toHaveLength(22);
        expect(response.body.balance).toHaveLength(3);
        expect(response.body.balance.every((b) => b.amount === 0)).toBe(true);
    });

    it("rejects duplicate names, ignoring case and surrounding spaces", async () => {
        const response = await post("/group", jorgeToken, {
            ...groupBody,
            members: [{ name: "Mamá" }, { name: "  mamá " }],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Duplicate members are not allowed");
    });

    it("rejects a member whose name collides with the creator's", async () => {
        const response = await post("/group", jorgeToken, {
            ...groupBody,
            members: [{ name: "jorge" }],
        });

        expect(response.status).toBe(400);
    });

    it("rejects a member without a name", async () => {
        const response = await post("/group", jorgeToken, {
            ...groupBody,
            members: [{ name: "  " }],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Every member needs a name");
    });

    it("rejects a request without a token", async () => {
        const response = await fakeRequest.post("/group").send(groupBody);

        expect(response.status).toBe(401);
    });
});

describe("PUT /group/:groupId", () => {
    it("renames a member by _id without losing their history", async () => {
        await Expense.create(dinnerFor(group));
        const [jorgeId, mamaId, anaId] = idsOf(group);

        const response = await put(`/group/${group._id}`, jorgeToken, {
            name: "Piso",
            description: "Gastos del piso",
            members: [
                { _id: jorgeId, name: "Jorge" },
                { _id: mamaId, name: "Mamá Pili" },
                { _id: anaId, name: "Ana" },
            ],
        });

        expect(response.status).toBe(200);
        expect(response.body.members[1]._id).toBe(mamaId);
        expect(response.body.members[1].name).toBe("Mamá Pili");

        const balance = response.body.balance.find((b) => b.member === mamaId);
        expect(balance.amount).toBe(-10);

        const debts = await Payment.find({ group: group._id, from: mamaId });
        expect(debts).toHaveLength(1);
    });

    it("adds a member that comes without an _id", async () => {
        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [
                ...idsOf(group).map((_id, i) => ({ _id, name: group.members[i].name })),
                { name: "Luis" },
            ],
        });

        expect(response.status).toBe(200);
        expect(response.body.members).toHaveLength(4);
        expect(response.body.members[3].name).toBe("Luis");
        expect(response.body.balance).toHaveLength(4);
    });

    it("refuses to remove a member who has expenses, and says who blocks it", async () => {
        await Expense.create(dinnerFor(group));
        const [jorgeId, mamaId] = idsOf(group);

        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [{ _id: jorgeId, name: "Jorge" }, { _id: mamaId, name: "Mamá" }],
        });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain("Ana");
    });

    it("removes a member without expenses and regenerates the debts", async () => {
        await Expense.create({
            ...dinnerFor(group),
            totalAmount: 20,
            participants: dinnerFor(group).participants.slice(0, 2).map((p) => ({ ...p })),
        });
        const [jorgeId, mamaId, anaId] = idsOf(group);

        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [{ _id: jorgeId, name: "Jorge" }, { _id: mamaId, name: "Mamá" }],
        });

        expect(response.status).toBe(200);
        expect(response.body.members).toHaveLength(2);
        expect(await Payment.find({ group: group._id, from: anaId })).toHaveLength(0);
        expect(await Payment.find({ group: group._id, status: "pending" })).toHaveLength(1);
    });

    it("refuses to remove a member who settled a debt, even with no expenses left", async () => {
        const expense = await Expense.create(dinnerFor(group));
        const [jorgeId, mamaId, anaId] = idsOf(group);

        await Payment.findOneAndUpdate(
            { group: group._id, from: mamaId, to: jorgeId, status: "pending" },
            { status: "paid", paidAt: new Date() },
        );
        await Expense.findOneAndDelete({ _id: expense._id });

        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [{ _id: jorgeId, name: "Jorge" }, { _id: anaId, name: "Ana" }],
        });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain("Mamá");
    });

    it("refuses the same _id twice, which would split one member in two", async () => {
        const [jorgeId, mamaId] = idsOf(group);

        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [
                { _id: jorgeId, name: "Jorge" },
                { _id: mamaId, name: "Mamá" },
                { _id: mamaId, name: "Mamá bis" },
            ],
        });

        expect(response.status).toBe(400);

        const untouched = await Group.findById(group._id);
        expect(untouched.members).toHaveLength(3);
    });

    it("refuses to let you remove yourself", async () => {
        const [, mamaId, anaId] = idsOf(group);

        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [{ _id: mamaId, name: "Mamá" }, { _id: anaId, name: "Ana" }],
        });

        expect(response.status).toBe(403);
    });

    it("rejects an _id that belongs to another group", async () => {
        const other = await post("/group", jorgeToken, { ...groupBody, name: "Otro" });

        const response = await put(`/group/${group._id}`, jorgeToken, {
            ...groupBody,
            members: [{ _id: other.body.members[0]._id, name: "Jorge" }],
        });

        expect(response.status).toBe(400);
    });

    it("rejects someone who is not a member", async () => {
        const response = await put(`/group/${group._id}`, anaToken, groupBody);

        expect(response.status).toBe(403);
    });
});

describe("GET /group/:groupId", () => {
    it("returns the group with its invite code", async () => {
        const response = await get(`/group/${group._id}`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.inviteCode).toBe(group.inviteCode);
    });

    it("rejects someone who is not a member", async () => {
        const response = await get(`/group/${group._id}`, anaToken);

        expect(response.status).toBe(403);
    });

    it("rejects a request without a token", async () => {
        const response = await fakeRequest.get(`/group/${group._id}`);

        expect(response.status).toBe(401);
    });
});

describe("GET /group/user", () => {
    it("returns the groups the user is a member of", async () => {
        const response = await get("/group/user", jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].inviteCode).toBe(group.inviteCode);
    });

    it("returns an empty list, not a 404, until the user joins one", async () => {
        const empty = await get("/group/user", anaToken);
        expect(empty.status).toBe(200);
        expect(empty.body).toEqual([]);

        const [, , anaId] = idsOf(group);
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });

        const response = await get("/group/user", anaToken);
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
    });

    it("never exposes a member's email", async () => {
        const [, , anaId] = idsOf(group);
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });

        const response = await get("/group/user", jorgeToken);
        const linked = response.body[0].members.filter((m) => m.user);

        expect(linked).toHaveLength(2);
        expect(linked.every((m) => m.user.email === undefined)).toBe(true);
        expect(linked.every((m) => m.user.password === undefined)).toBe(true);
        expect(linked[0].user.name).toBe("Jorge");
    });
});

describe("GET /group/:groupId/groupDetails", () => {
    it("returns members, balance, expenses and debts", async () => {
        await Expense.create(dinnerFor(group));
        const [jorgeId, mamaId] = idsOf(group);

        const response = await get(`/group/${group._id}/groupDetails`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.inviteCode).toBe(group.inviteCode);
        expect(response.body.members).toHaveLength(3);
        expect(response.body.expenses).toHaveLength(1);
        expect(response.body.expenses[0].paidBy.name).toBe("Jorge");
        expect(response.body.expenses[0].participants[0].member.name).toBe("Jorge");
        expect(response.body.debts).toHaveLength(2);
        expect(response.body.debts[0].to.name).toBe("Jorge");

        const mama = response.body.balance.find((b) => b.member._id === mamaId);
        expect(mama.amount).toBe(-10);
        expect(mama.member.name).toBe("Mamá");
        expect(mama.member.user).toBeNull();
    });

    it("rejects someone who is not a member", async () => {
        const response = await get(`/group/${group._id}/groupDetails`, anaToken);

        expect(response.status).toBe(403);
    });
});

describe("DELETE /group/:groupId", () => {
    it("deletes the group with its expenses and its payments", async () => {
        await Expense.create(dinnerFor(group));

        const response = await fakeRequest.delete(`/group/${group._id}`).set(auth(jorgeToken));

        expect(response.status).toBe(204);
        expect(await Group.findById(group._id)).toBeNull();
        expect(await Expense.find({ group: group._id })).toHaveLength(0);
        expect(await Payment.find({ group: group._id })).toHaveLength(0);
    });
});

describe("GET /group/join/:inviteCode", () => {
    it("shows only the members without an account", async () => {
        const response = await get(`/group/join/${group.inviteCode}`, anaToken);

        expect(response.status).toBe(200);
        expect(response.body.name).toBe("Piso");
        expect(response.body.members.map((m) => m.name)).toEqual(["Mamá", "Ana"]);
        expect(response.body.alreadyMember).toBe(false);
    });

    it("tells a member they are already in", async () => {
        const response = await get(`/group/join/${group.inviteCode}`, jorgeToken);

        expect(response.body.alreadyMember).toBe(true);
    });

    it("404s on an unknown code", async () => {
        const response = await get("/group/join/nope", anaToken);

        expect(response.status).toBe(404);
    });
});

describe("POST /group/join/:inviteCode", () => {
    it("links the chosen member and keeps their debts", async () => {
        await Expense.create(dinnerFor(group));
        const [, , anaId] = idsOf(group);

        const response = await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });

        expect(response.status).toBe(200);
        expect(response.body.members[2].user._id).toBe(ana._id.toString());

        const debts = await Payment.find({ group: group._id, from: anaId, status: "pending" });
        expect(debts).toHaveLength(1);
        expect(debts[0].amount).toBe(10);
    });

    it("refuses a member that is already linked", async () => {
        const [jorgeId] = idsOf(group);

        const response = await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: jorgeId });

        expect(response.status).toBe(409);
    });

    it("refuses someone who is already a member", async () => {
        const [, mamaId] = idsOf(group);

        const response = await post(`/group/join/${group.inviteCode}`, jorgeToken, { memberId: mamaId });

        expect(response.status).toBe(409);
    });

    it("creates a new linked member from a name, with a balance entry at 0", async () => {
        const response = await post(`/group/join/${group.inviteCode}`, anaToken, { name: "Ana G." });

        expect(response.status).toBe(200);
        expect(response.body.members).toHaveLength(4);
        expect(response.body.members[3].user._id).toBe(ana._id.toString());

        const updated = await Group.findById(group._id);
        const entry = updated.balance.find((b) => b.member.toString() === updated.members[3]._id.toString());
        expect(entry.amount).toBe(0);
    });

    it("refuses a name already taken in the group", async () => {
        const response = await post(`/group/join/${group.inviteCode}`, anaToken, { name: "Ana" });

        expect(response.status).toBe(400);
    });

    it("refuses a body with neither memberId nor name", async () => {
        const response = await post(`/group/join/${group.inviteCode}`, anaToken, {});

        expect(response.status).toBe(400);
    });
});

describe("POST /group/:groupId/invite-code/regenerate", () => {
    it("invalidates the previous link", async () => {
        const response = await post(`/group/${group._id}/invite-code/regenerate`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.inviteCode).not.toBe(group.inviteCode);

        const stale = await get(`/group/join/${group.inviteCode}`, anaToken);
        expect(stale.status).toBe(404);

        const fresh = await get(`/group/join/${response.body.inviteCode}`, anaToken);
        expect(fresh.status).toBe(200);
    });

    it("rejects someone who is not a member", async () => {
        const response = await post(`/group/${group._id}/invite-code/regenerate`, anaToken);

        expect(response.status).toBe(403);
    });
});

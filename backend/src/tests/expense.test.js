// Must be set before the modules below are loaded: both jwt.js and user.schema.js
// capture process.env.jwt_secret at import time.
process.env.jwt_secret = process.env.jwt_secret || "test-secret";

const Decimal = require("decimal.js");
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
const patch = (path, token, body) => fakeRequest.patch(path).set(auth(token)).send(body);
const get = (path, token) => fakeRequest.get(path).set(auth(token));

// bootstrapApp() has no Socket.IO, so notifications need a stub to land somewhere.
let emitted = [];
app.set("socketio", {
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
});

const idsOf = (group) => group.members.map((m) => m._id.toString());

let jorge;
let ana;
let jorgeToken;
let anaToken;
let group;
let jorgeId;
let mamaId;
let anaId;

const reload = async () => {
    group = await Group.findById(group._id);
    [jorgeId, mamaId, anaId] = idsOf(group);
};

beforeAll(async () => {
    await connectDB();
    jorge = await User.create({ name: "Jorge", email: "jorge@user.com", password: "Password1" });
    ana = await User.create({ name: "Ana", email: "ana@user.com", password: "Password1" });
    jorgeToken = jorge.generateJWT();
    anaToken = ana.generateJWT();
});

beforeEach(async () => {
    emitted = [];
    await Promise.all([Group.deleteMany({}), Expense.deleteMany({}), Payment.deleteMany({})]);
    const response = await post("/group", jorgeToken, {
        name: "Piso",
        description: "Gastos del piso",
        members: [{ name: "Mamá" }, { name: "Ana" }],
    });
    group = await Group.findById(response.body._id);
    [jorgeId, mamaId, anaId] = idsOf(group);
});

afterAll(async () => {
    await disconnectDB();
});

describe("POST /group/:groupId/expenses", () => {
    it("lets a member without an account pay, and hydrates the response", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: mamaId,
            participants: [jorgeId, mamaId, anaId],
        });

        expect(response.status).toBe(201);
        expect(response.body.paidBy.name).toBe("Mamá");
        expect(response.body.paidBy.user).toBeNull();
        expect(response.body.participants).toHaveLength(3);
        expect(response.body.participants[0].member.name).toBe("Jorge");
        expect(response.body.participants[0].amountOwed).toBe(10);
        expect(response.body.group.name).toBe("Piso");

        await reload();
        const balance = group.balance.find((b) => b.member.toString() === mamaId);
        expect(balance.amount).toBe(20);
    });

    it("notifies only the participants with an account, never the caller", async () => {
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });
        await reload();

        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });

        expect(emitted.map((e) => e.room)).toEqual([`user:${ana._id.toString()}`]);
        expect(emitted[0].payload.type).toBe("EXPENSE_CREATED");
    });

    it("hands out the leftover cents so the balance still nets to zero", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Café",
            totalAmount: 10,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });

        expect(response.body.participants.map((p) => p.amountOwed)).toEqual([3.34, 3.33, 3.33]);

        await reload();
        const amounts = group.balance.map((b) => b.amount);
        expect(amounts).toEqual([6.66, -3.33, -3.33]);
        expect(new Decimal(0).plus(amounts[0]).plus(amounts[1]).plus(amounts[2]).toNumber()).toBe(0);

        const debts = await Payment.find({ group: group._id, status: "pending" });
        expect(debts.map((d) => d.amount)).toEqual([3.33, 3.33]);
    });

    it("rejects a payer who is not a member of the group", async () => {
        const other = await post("/group", anaToken, {
            name: "Otro",
            description: "x",
            members: [{ name: "Luis" }],
        });

        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: other.body.members[0]._id,
            participants: [jorgeId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Payer is not part of the group");
    });

    it("rejects a participant who is not a member of the group", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId, group._id.toString()],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("One or more participants are not part of the group");
    });

    it("rejects an amount of 0", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: -5,
            paidBy: jorgeId,
            participants: [jorgeId],
        });

        expect(response.status).toBe(400);
    });

    it("rejects someone who is not a member", async () => {
        const response = await post(`/group/${group._id}/expenses`, anaToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId],
        });

        expect(response.status).toBe(403);
    });
});

describe("PATCH /group/:groupId/expenses/:expenseId", () => {
    it("rewrites the expense and rebalances the group", async () => {
        const created = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });

        const response = await patch(`/group/${group._id}/expenses/${created.body._id}`, jorgeToken, {
            description: "Cena y postre",
            totalAmount: 20,
            paidBy: mamaId,
            participants: [jorgeId, mamaId],
        });

        expect(response.status).toBe(200);
        expect(response.body.paidBy.name).toBe("Mamá");
        expect(response.body.participants).toHaveLength(2);

        await reload();
        expect(group.balance.find((b) => b.member.toString() === mamaId).amount).toBe(10);
        expect(group.balance.find((b) => b.member.toString() === anaId).amount).toBe(0);
    });
});

describe("GET /group/:groupId/expenses", () => {
    it("returns the expenses with their members embedded", async () => {
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: mamaId,
            participants: [jorgeId, mamaId, anaId],
        });

        const response = await get(`/group/${group._id}/expenses`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body[0].paidBy.name).toBe("Mamá");
        expect(response.body[0].participants.map((p) => p.member.name)).toEqual(["Jorge", "Mamá", "Ana"]);
    });

    it("rejects someone who is not a member", async () => {
        const response = await get(`/group/${group._id}/expenses`, anaToken);

        expect(response.status).toBe(403);
    });
});

describe("DELETE /group/:groupId/expenses/:expenseId", () => {
    it("deletes the expense and clears the balance", async () => {
        const created = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });

        const response = await fakeRequest
            .delete(`/group/${group._id}/expenses/${created.body._id}`)
            .set(auth(jorgeToken));

        expect(response.status).toBe(200);

        await reload();
        expect(group.balance.every((b) => b.amount === 0)).toBe(true);
        expect(await Payment.find({ group: group._id, status: "pending" })).toHaveLength(0);
    });
});

describe("GET /user/expenses", () => {
    it("returns the expenses of every group the user is a member of", async () => {
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: mamaId,
            participants: [jorgeId, mamaId, anaId],
        });

        const second = await post("/group", jorgeToken, {
            name: "Viaje",
            description: "Fin de semana",
            members: [{ name: "Luis" }],
        });
        const [jorgeInTrip, luis] = second.body.members.map((m) => m._id);
        await post(`/group/${second.body._id}/expenses`, jorgeToken, {
            description: "Gasolina",
            totalAmount: 50,
            paidBy: luis,
            participants: [jorgeInTrip, luis],
        });

        const response = await get("/user/expenses", jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.map((g) => g.groupName).sort()).toEqual(["Piso", "Viaje"]);
        expect(response.body.every((g) => g.expenses.length === 1)).toBe(true);
        expect(response.body.flatMap((g) => g.expenses).map((e) => e.paidBy.name).sort()).toEqual(["Luis", "Mamá"]);
    });

    it("leaves out the expenses the user has nothing to do with", async () => {
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Taxi",
            totalAmount: 20,
            paidBy: mamaId,
            participants: [mamaId, anaId],
        });

        const response = await get("/user/expenses", jorgeToken);

        expect(response.status).toBe(404);
    });

    it("404s for a user who is in no group", async () => {
        const response = await get("/user/expenses", anaToken);

        expect(response.status).toBe(404);
    });
});

describe("PATCH /payment/:paymentId", () => {
    const debtOf = (from) => Payment.findOne({ group: group._id, from, status: "pending" });

    beforeEach(async () => {
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });
        emitted = [];
    });

    it("lets the creditor settle a debt owed to them", async () => {
        const debt = await debtOf(mamaId);

        const response = await patch(`/payment/${debt._id}`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("paid");
        expect(response.body.paidAt).toBeTruthy();
        expect(response.body.from.name).toBe("Mamá");

        await reload();
        expect(group.balance.find((b) => b.member.toString() === mamaId).amount).toBe(0);
        expect(group.balance.find((b) => b.member.toString() === jorgeId).amount).toBe(10);
    });

    it("lets a member settle a debt between two members without an account", async () => {
        await Expense.deleteMany({ group: group._id });
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Taxi",
            totalAmount: 20,
            paidBy: mamaId,
            participants: [mamaId, anaId],
        });

        const debt = await debtOf(anaId);
        expect(debt.to.toString()).toBe(mamaId);

        const response = await patch(`/payment/${debt._id}`, jorgeToken);

        expect(response.status).toBe(200);
        expect(emitted).toHaveLength(0);
    });

    it("rejects a member who is not a party when the other side has an account", async () => {
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });
        await reload();

        const debt = await debtOf(mamaId);
        const response = await patch(`/payment/${debt._id}`, anaToken);

        expect(response.status).toBe(403);
    });

    it("notifies the creditor when they have an account", async () => {
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });
        await reload();
        emitted = [];

        const debt = await debtOf(mamaId);
        await patch(`/payment/${debt._id}`, jorgeToken);

        expect(emitted).toHaveLength(0);

        const anasDebt = await debtOf(anaId);
        await patch(`/payment/${anasDebt._id}`, anaToken);

        expect(emitted.map((e) => e.room)).toEqual([`user:${jorge._id.toString()}`]);
        expect(emitted[0].payload.type).toBe("DEBT_SETTLED");
        expect(emitted[0].payload.message).toContain("has settled their debt with");
    });

    it("rejects someone who is not a member of the group", async () => {
        const debt = await debtOf(mamaId);

        const response = await patch(`/payment/${debt._id}`, anaToken);

        expect(response.status).toBe(403);
    });
});

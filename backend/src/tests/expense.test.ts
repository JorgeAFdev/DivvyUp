import { Decimal } from "decimal.js";
import type { HydratedDocument } from "mongoose";
import supertest from "supertest";
import { bootstrapApp } from "../bootstrap.js";
import { disconnectDB, connectDB } from "../mongo/connection/index.js";
import Group from "../schemas/group.schema.js";
import type { GroupHydrated } from "../schemas/group.schema.js";
import Expense from "../schemas/expense.schema.js";
import Payment from "../schemas/payment.schema.js";
import User from "../schemas/user.schema.js";
import type { UserDoc, UserMethods } from "../schemas/user.schema.js";

const app = bootstrapApp();
const fakeRequest = supertest(app);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const post = (path: string, token: string, body?: any) => fakeRequest.post(path).set(auth(token)).send(body);
const patch = (path: string, token: string, body?: any) => fakeRequest.patch(path).set(auth(token)).send(body);
const get = (path: string, token: string) => fakeRequest.get(path).set(auth(token));

// bootstrapApp() has no Socket.IO, so notifications need a stub to land somewhere.
let emitted: any[] = [];
app.set("socketio", {
    to: (room: string) => ({ emit: (event: string, payload: any) => emitted.push({ room, event, payload }) }),
});

const idsOf = (group: GroupHydrated) => group.members.map((m) => m._id.toString());

let jorge: HydratedDocument<UserDoc, UserMethods>;
let ana: HydratedDocument<UserDoc, UserMethods>;
let jorgeToken: string;
let anaToken: string;
let group: GroupHydrated;
let jorgeId: string;
let mamaId: string;
let anaId: string;

const reload = async () => {
    group = (await Group.findById(group._id))!;
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
    group = (await Group.findById(response.body._id))!;
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
        // The group no longer rides along inside every expense.
        expect(response.body.group).toBe(group._id.toString());

        await reload();
        const balance = group.balance.find((b) => b.member.toString() === mamaId)!;
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

        expect(emitted.map((e: any) => e.room)).toEqual([`user:${ana._id.toString()}`]);
        expect(emitted[0].payload.type).toBe("EXPENSE_CREATED");
    });

    it("hands out the leftover cents so the balance still nets to zero", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Café",
            totalAmount: 10,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });

        expect(response.body.participants.map((p: any) => p.amountOwed)).toEqual([3.34, 3.33, 3.33]);

        await reload();
        const amounts = group.balance.map((b) => b.amount);
        expect(amounts).toEqual([6.66, -3.33, -3.33]);
        expect(new Decimal(0).plus(amounts[0]).plus(amounts[1]).plus(amounts[2]).toNumber()).toBe(0);

        const debts = await Payment.find({ group: group._id, status: "pending" });
        expect(debts.map((d) => d.amount)).toEqual([3.33, 3.33]);
    });

    it("rejects an amount with more than two decimals", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Café",
            totalAmount: 10.001,
            paidBy: jorgeId,
            participants: [jorgeId, mamaId, anaId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Total amount cannot have more than 2 decimals");
    });

    it("rejects an amount that is not a number", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Café",
            totalAmount: "gratis",
            paidBy: jorgeId,
            participants: [jorgeId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Total amount must be a number");
    });

    it("rejects participants that are not a list", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 10,
            paidBy: jorgeId,
            participants: true,
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Participants must be a list of members");
    });

    it("rejects the same participant twice, which would double their share", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [mamaId, mamaId, anaId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Duplicate participants are not allowed");
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

    it("rejects a negative amount", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: -5,
            paidBy: jorgeId,
            participants: [jorgeId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Total amount must be greater than 0");
    });

    it("rejects an amount of a million or more", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 1000000,
            paidBy: jorgeId,
            participants: [jorgeId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Total amount must be less than 1,000,000");
    });

    it("rejects an empty participant list", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Cena",
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("At least one participant must be selected");
    });

    it("rejects a missing description", async () => {
        const response = await post(`/group/${group._id}/expenses`, jorgeToken, {
            totalAmount: 30,
            paidBy: jorgeId,
            participants: [jorgeId],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Description is required");
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
        expect(group.balance.find((b) => b.member.toString() === mamaId)!.amount).toBe(10);
        expect(group.balance.find((b) => b.member.toString() === anaId)!.amount).toBe(0);
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
        expect(response.body[0].participants.map((p: any) => p.member.name)).toEqual(["Jorge", "Mamá", "Ana"]);
    });

    it("returns an empty list for a group with no expenses", async () => {
        const response = await get(`/group/${group._id}/expenses`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
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

describe(":groupId / :expenseId ObjectId validation", () => {
    const badId = "not-a-valid-object-id";
    const missingId = "0123456789abcdef01234567";
    const body = () => ({ description: "Cena", totalAmount: 30, paidBy: jorgeId, participants: [jorgeId] });

    it("400s an unparseable groupId on POST", async () => {
        const response = await post(`/group/${badId}/expenses`, jorgeToken, body());

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid group or expense ID");
    });

    it("400s an unparseable groupId on GET", async () => {
        const response = await get(`/group/${badId}/expenses`, jorgeToken);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid group or expense ID");
    });

    it("400s an unparseable expenseId on PATCH", async () => {
        const response = await patch(`/group/${group._id}/expenses/${badId}`, jorgeToken, body());

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid group or expense ID");
    });

    it("400s an unparseable expenseId on DELETE", async () => {
        const response = await fakeRequest.delete(`/group/${group._id}/expenses/${badId}`).set(auth(jorgeToken));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid group or expense ID");
    });

    it("checks the id before the body on POST", async () => {
        const response = await post(`/group/${badId}/expenses`, jorgeToken, { totalAmount: "free" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid group or expense ID");
    });

    it("lets a well-formed but unknown groupId through to the not-found check", async () => {
        const response = await post(`/group/${missingId}/expenses`, jorgeToken, body());

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Group does not exist");
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
        const [jorgeInTrip, luis] = second.body.members.map((m: any) => m._id);
        await post(`/group/${second.body._id}/expenses`, jorgeToken, {
            description: "Gasolina",
            totalAmount: 50,
            paidBy: luis,
            participants: [jorgeInTrip, luis],
        });

        const response = await get("/user/expenses", jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.map((g: any) => g.groupName).sort()).toEqual(["Piso", "Viaje"]);
        // Members travel once per group, not once per expense.
        expect(response.body.every((g: any) => g.members.length > 0)).toBe(true);
        expect(response.body.flatMap((g: any) => g.expenses).every((e: any) => e.group !== undefined && !e.group.members)).toBe(true);
        expect(response.body.every((g: any) => g.expenses.length === 1)).toBe(true);
        expect(response.body.flatMap((g: any) => g.expenses).map((e: any) => e.paidBy.name).sort()).toEqual(["Luis", "Mamá"]);
    });

    it("leaves out the expenses the user has nothing to do with", async () => {
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Taxi",
            totalAmount: 20,
            paidBy: mamaId,
            participants: [mamaId, anaId],
        });

        const response = await get("/user/expenses", jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it("survives a group whose member points at a deleted account", async () => {
        const ghost = await User.create({ name: "Ghost", email: "ghost@user.com", password: "Password1" });
        const ghostToken = ghost.generateJWT();
        await post("/group", ghostToken, { name: "Fantasma", description: "x", members: [{ name: "Otro" }] });
        await User.findByIdAndDelete(ghost._id);

        const response = await get("/user/expenses", ghostToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it("returns an empty list for a user who is in no group", async () => {
        const response = await get("/user/expenses", anaToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });
});

describe("PATCH /payment/:paymentId", () => {
    const debtOf = (from: string) => Payment.findOne({ group: group._id, from, status: "pending" });

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
        const debt = (await debtOf(mamaId))!;

        const response = await patch(`/payment/${debt._id}`, jorgeToken);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("paid");
        expect(response.body.paidAt).toBeTruthy();
        expect(response.body.from.name).toBe("Mamá");

        await reload();
        expect(group.balance.find((b) => b.member.toString() === mamaId)!.amount).toBe(0);
        expect(group.balance.find((b) => b.member.toString() === jorgeId)!.amount).toBe(10);
    });

    it("lets a member settle a debt between two members without an account", async () => {
        await Expense.deleteMany({ group: group._id });
        await post(`/group/${group._id}/expenses`, jorgeToken, {
            description: "Taxi",
            totalAmount: 20,
            paidBy: mamaId,
            participants: [mamaId, anaId],
        });

        const debt = (await debtOf(anaId))!;
        expect(debt.to.toString()).toBe(mamaId);

        const response = await patch(`/payment/${debt._id}`, jorgeToken);

        expect(response.status).toBe(200);
        expect(emitted).toHaveLength(0);
    });

    it("rejects a member who is not a party when the other side has an account", async () => {
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });
        await reload();

        const debt = (await debtOf(mamaId))!;
        const response = await patch(`/payment/${debt._id}`, anaToken);

        expect(response.status).toBe(403);
    });

    it("notifies the creditor when they have an account", async () => {
        await post(`/group/join/${group.inviteCode}`, anaToken, { memberId: anaId });
        await reload();
        emitted = [];

        const debt = (await debtOf(mamaId))!;
        await patch(`/payment/${debt._id}`, jorgeToken);

        expect(emitted).toHaveLength(0);

        const anasDebt = (await debtOf(anaId))!;
        await patch(`/payment/${anasDebt._id}`, anaToken);

        expect(emitted.map((e: any) => e.room)).toEqual([`user:${jorge._id.toString()}`]);
        expect(emitted[0].payload.type).toBe("DEBT_SETTLED");
        expect(emitted[0].payload.message).toContain("has settled their debt with");
    });

    it("rejects someone who is not a member of the group", async () => {
        const debt = (await debtOf(mamaId))!;

        const response = await patch(`/payment/${debt._id}`, anaToken);

        expect(response.status).toBe(403);
    });

    it("refuses to settle a cancelled debt", async () => {
        const debt = (await debtOf(mamaId))!;
        await Payment.findByIdAndUpdate(debt._id, { status: "cancelled" });

        const response = await patch(`/payment/${debt._id}`, jorgeToken);

        expect(response.status).toBe(409);
    });

    it("refuses to settle the same debt twice", async () => {
        const debt = (await debtOf(mamaId))!;
        await patch(`/payment/${debt._id}`, jorgeToken);
        emitted = [];

        const response = await patch(`/payment/${debt._id}`, jorgeToken);

        expect(response.status).toBe(409);
        expect(emitted).toHaveLength(0);
    });

    it("400s an unparseable paymentId", async () => {
        const response = await patch(`/payment/not-a-valid-object-id`, jorgeToken);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid payment ID");
    });

    it("lets a well-formed but unknown paymentId through to the not-found check", async () => {
        const response = await patch(`/payment/0123456789abcdef01234567`, jorgeToken);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Payment not found");
    });
});

import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../mongo/connection/index.js";
import Group from "../schemas/group.schema.js";
import type { GroupHydrated } from "../schemas/group.schema.js";
import Expense from "../schemas/expense.schema.js";
import Payment from "../schemas/payment.schema.js";
import { memberOf, hydrateMembers } from "../utils/members.js";
import { updateBalance, generateDebts } from "../services/ledger.js";

const jorgeUserId = new mongoose.Types.ObjectId();

const setUpGroup = () =>
    Group.create({
        name: "Piso",
        description: "Gastos del piso",
        members: [
            { name: "Jorge", user: jorgeUserId },
            { name: "Mamá" },
            { name: "Ana" },
        ],
    });

const memberIds = (group: GroupHydrated) => group.members.map((m) => m._id);

const amountOf = (group: GroupHydrated, memberId: mongoose.Types.ObjectId) =>
    group.balance.find((b) => b.member.toString() === memberId.toString())!.amount;

let group: GroupHydrated;
let jorge: mongoose.Types.ObjectId;
let mama: mongoose.Types.ObjectId;
let ana: mongoose.Types.ObjectId;

beforeAll(async () => {
    await connectDB();
});

beforeEach(async () => {
    await Promise.all([Group.deleteMany({}), Expense.deleteMany({}), Payment.deleteMany({})]);
    group = await setUpGroup();
    [jorge, mama, ana] = memberIds(group);
});

afterAll(async () => {
    await disconnectDB();
});

describe("Group engine", () => {
    it("gives every group an invite code", async () => {
        const other = await setUpGroup();

        expect(group.inviteCode).toHaveLength(22);
        expect(other.inviteCode).not.toBe(group.inviteCode);
    });

    describe("updateBalance", () => {
        it("starts every member at 0, keyed by member id", async () => {
            const balance = await updateBalance(group);

            expect(balance).toHaveLength(3);
            expect(balance.map((b) => b.member.toString())).toEqual(
                [jorge, mama, ana].map((id) => id.toString()),
            );
            expect(balance.every((b) => b.amount === 0)).toBe(true);
        });

        it("makes a member without an account the creditor of what they paid", async () => {
            await Expense.create({
                description: "Cena",
                totalAmount: 30,
                group: group._id,
                paidBy: mama,
                participants: [
                    { member: jorge, amountOwed: 10 },
                    { member: mama, amountOwed: 10 },
                    { member: ana, amountOwed: 10 },
                ],
            });

            const updated = (await Group.findById(group._id))!;

            expect(amountOf(updated, mama)).toBe(20);
            expect(amountOf(updated, jorge)).toBe(-10);
            expect(amountOf(updated, ana)).toBe(-10);
        });

        it("rounds every accumulation to two decimals", async () => {
            await Expense.create({
                description: "Café",
                totalAmount: 10,
                group: group._id,
                paidBy: jorge,
                participants: [
                    { member: jorge, amountOwed: 3.33 },
                    { member: mama, amountOwed: 3.33 },
                    { member: ana, amountOwed: 3.34 },
                ],
            });

            const updated = (await Group.findById(group._id))!;

            expect(amountOf(updated, jorge)).toBe(6.67);
            expect(amountOf(updated, ana)).toBe(-3.34);
        });

        it("applies paid payments and ignores pending ones", async () => {
            await Expense.create({
                description: "Cena",
                totalAmount: 30,
                group: group._id,
                paidBy: mama,
                participants: [
                    { member: jorge, amountOwed: 10 },
                    { member: mama, amountOwed: 10 },
                    { member: ana, amountOwed: 10 },
                ],
            });

            await Payment.findOneAndUpdate(
                { group: group._id, from: jorge, to: mama, status: "pending" },
                { status: "paid", paidAt: new Date() },
            );

            const settled = (await Group.findById(group._id))!;
            await updateBalance(settled);

            expect(amountOf(settled, jorge)).toBe(0);
            expect(amountOf(settled, mama)).toBe(10);
            expect(amountOf(settled, ana)).toBe(-10);
        });
    });

    describe("generateDebts", () => {
        it("creates pending payments between member ids", async () => {
            await Expense.create({
                description: "Cena",
                totalAmount: 30,
                group: group._id,
                paidBy: mama,
                participants: [
                    { member: jorge, amountOwed: 10 },
                    { member: mama, amountOwed: 10 },
                    { member: ana, amountOwed: 10 },
                ],
            });

            const debts = await Payment.find({ group: group._id, status: "pending" }).sort({ amount: 1 });

            expect(debts).toHaveLength(2);
            expect(debts.every((d) => d.to.toString() === mama.toString())).toBe(true);
            expect(debts.map((d) => d.from.toString()).sort()).toEqual(
                [jorge.toString(), ana.toString()].sort(),
            );
            expect(debts.every((d) => d.amount === 10)).toBe(true);
        });

        it("generates a debt between two members without an account", async () => {
            await Expense.create({
                description: "Taxi",
                totalAmount: 20,
                group: group._id,
                paidBy: mama,
                participants: [{ member: ana, amountOwed: 20 }],
            });

            const debts = await Payment.find({ group: group._id, status: "pending" });

            expect(debts).toHaveLength(1);
            expect(debts[0].from.toString()).toBe(ana.toString());
            expect(debts[0].to.toString()).toBe(mama.toString());
        });

        it("replaces the previous pending debts and leaves the paid ones alone", async () => {
            await Expense.create({
                description: "Cena",
                totalAmount: 30,
                group: group._id,
                paidBy: mama,
                participants: [
                    { member: jorge, amountOwed: 10 },
                    { member: mama, amountOwed: 10 },
                    { member: ana, amountOwed: 10 },
                ],
            });

            await Payment.findOneAndUpdate(
                { group: group._id, from: jorge, to: mama, status: "pending" },
                { status: "paid", paidAt: new Date() },
            );

            const settled = (await Group.findById(group._id))!;
            await updateBalance(settled);
            await generateDebts(settled);

            const pending = await Payment.find({ group: group._id, status: "pending" });
            const paid = await Payment.find({ group: group._id, status: "paid" });

            expect(paid).toHaveLength(1);
            expect(pending).toHaveLength(1);
            expect(pending[0].from.toString()).toBe(ana.toString());
            expect(pending[0].amount).toBe(10);
        });
    });

    describe("memberOf", () => {
        it("finds the member a user is linked to", () => {
            expect(memberOf(group, jorgeUserId)!._id.toString()).toBe(jorge.toString());
        });

        it("returns undefined for a user who is not a member", () => {
            expect(memberOf(group, new mongoose.Types.ObjectId())).toBeUndefined();
        });

        it("does not match members without an account", () => {
            expect(memberOf(group, null)).toBeUndefined();
        });
    });

    describe("hydrateMembers", () => {
        it("embeds the member in balances, debts and expenses", async () => {
            const expense = await Expense.create({
                description: "Cena",
                totalAmount: 20,
                group: group._id,
                paidBy: mama,
                participants: [{ member: ana, amountOwed: 20 }],
            });

            const updated = (await Group.findById(group._id))!;
            const debts = await Payment.find({ group: group._id, status: "pending" });

            const [balance] = hydrateMembers(updated, updated.balance, ["member"]).filter(
                (b) => b.member?._id.toString() === mama.toString(),
            );
            const [debt] = hydrateMembers(updated, debts, ["from", "to"]);
            const [hydrated] = hydrateMembers(updated, [expense], ["paidBy", "participants.member"]);

            expect(balance.member!.name).toBe("Mamá");
            expect(balance.member!.user).toBeNull();
            expect(debt.from!.name).toBe("Ana");
            expect(debt.to!.name).toBe("Mamá");
            expect(hydrated.paidBy!.name).toBe("Mamá");
            expect(hydrated.participants[0].member!.name).toBe("Ana");
            expect(hydrated.participants[0].amountOwed).toBe(20);
        });

        it("leaves an unknown member id as null", async () => {
            const orphan = { member: new mongoose.Types.ObjectId(), amount: 5 };

            expect(hydrateMembers(group, orphan, ["member"]).member).toBeNull();
        });

        it("does not touch the object it was given", async () => {
            const entry = { member: group.members[0]._id, amount: 5 };

            const hydrated = hydrateMembers(group, entry, ["member"]);

            expect(hydrated.member!.name).toBe("Jorge");
            expect(entry.member).toBe(group.members[0]._id);
        });
    });
});

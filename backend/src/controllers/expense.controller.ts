import type { Request, Response } from "express";
import mongoose from "mongoose";
import Expense from "../schemas/expense.schema.js";
import type { ExpenseHydrated } from "../schemas/expense.schema.js";
import Group from "../schemas/group.schema.js";
import type { GroupHydrated } from "../schemas/group.schema.js";
import { MEMBER_FIELDS, MEMBER_PATHS, memberOf, hydrateMembers, linkedUserIds } from "../utils/members.js";
import { sendNotificationToUser, notificationTypes } from "../services/notifications.js";
import { splitEvenly } from "../services/split.js";
import { serializeHydratedExpense, serializeUserExpensesGroup } from "../serializers/contract.js";
import type { HydratedExpense } from "@monorepo/shared";

function expenseResponse(group: GroupHydrated, expenses: ExpenseHydrated): HydratedExpense;
function expenseResponse(group: GroupHydrated, expenses: ExpenseHydrated[]): HydratedExpense[];
function expenseResponse(group: GroupHydrated, expenses: ExpenseHydrated | ExpenseHydrated[]) {
    return Array.isArray(expenses)
        ? hydrateMembers(group, expenses, MEMBER_PATHS).map(serializeHydratedExpense)
        : serializeHydratedExpense(hydrateMembers(group, expenses, MEMBER_PATHS));
}

// Shape (participants is a unique non-empty list, the amount is a valid money
// number, the ids are 24-hex) is guaranteed by expenseSchema before this runs.
// What is left is the DB check the schema cannot make: that those ids name
// members of this group.
const checkMembership = (group: GroupHydrated, paidBy: string, participants: string[]) => {
    const memberIds = new Set(group.members.map((member) => member._id.toString()));

    if (!memberIds.has(paidBy)) {
        return "Payer is not part of the group";
    }
    if (participants.some((participant) => !memberIds.has(participant))) {
        return "One or more participants are not part of the group";
    }
    return null;
};

const createExpense = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user;
        const { groupId } = req.params;
        const { description, totalAmount, paidBy, participants } = req.body;

        const group = await Group.findById(groupId).populate("members.user", MEMBER_FIELDS);
        if (!group) {
            return res.status(400).json({ error: "Group does not exist" });
        }

        if (!memberOf(group, userId)) {
            return res.status(403).json({ error: 'You must be a member of this group to create an expense' });
        }

        const invalid = checkMembership(group, paidBy, participants);
        if (invalid) {
            return res.status(400).json({ error: invalid });
        }

        const newExpense = await Expense.create({
            description,
            totalAmount,
            group: groupId,
            paidBy,
            participants: splitEvenly(participants, totalAmount),
        });

        const io = req.app.get('socketio');
        linkedUserIds(group, participants)
            .filter((linkedUserId) => linkedUserId !== userId)
            .forEach((linkedUserId) => {
                sendNotificationToUser(io, linkedUserId, notificationTypes.EXPENSE_CREATED, `you have been added to expense ${newExpense.description} from group ${group.name}`, {
                    expenseId: newExpense._id,
                    expenseDescription: newExpense.description,
                    expenseAmount: newExpense.totalAmount
                })
            });

        res.status(201).json(expenseResponse(group, newExpense));
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error creating expense" });
    }
};

const updateExpense = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user;
        const { expenseId, groupId } = req.params;
        const { description, totalAmount, paidBy, participants } = req.body;

        const expense = await Expense.findOne({ _id: expenseId, group: groupId });
        if (!expense) {
            return res.status(404).json({ error: "Expense not found in this group" });
        }

        const group = await Group.findById(groupId).populate("members.user", MEMBER_FIELDS);
        if (!group) {
            return res.status(400).json({ error: "Group does not exist" });
        }

        if (!memberOf(group, userId)) {
            return res.status(403).json({ error: 'You must be a member of this group to update this expense' });
        }

        const invalid = checkMembership(group, paidBy, participants);
        if (invalid) {
            return res.status(400).json({ error: invalid });
        }

        const updatedExpense = await Expense.findByIdAndUpdate(expenseId, {
            description,
            totalAmount,
            paidBy,
            participants: splitEvenly(participants, totalAmount),
        },
            { new: true }
        );

        // Null when the expense was deleted between the findOne above and this
        // update (two clients, one editing and one deleting). Without the guard
        // the typed expenseResponse would not compile, and the client would get
        // 200 {} instead of a 404.
        if (!updatedExpense) {
            return res.status(404).json({ error: "Expense not found in this group" });
        }

        return res.status(200).json(expenseResponse(group, updatedExpense));
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error editing expense" });
    }
}

const getExpensesByGroupId = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user;
        const { groupId } = req.params;

        const group = await Group.findById(groupId).populate("members.user", MEMBER_FIELDS);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!memberOf(group, userId)) {
            return res.status(403).json({ error: "You don't have permission to view expenses from this group" });
        }

        const expenses = await Expense.find({ group: groupId });

        res.status(200).json(expenseResponse(group, expenses));
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error getting expenses" });
    }
};

const getExpensesByUserId = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        // The user id is no longer written on an expense: it has to be resolved
        // to the member id they own in each of their groups first.
        // A group whose member no longer resolves to an account (the user was
        // deleted straight in the database) would blow up the whole endpoint.
        const groups = (await Group.find({ "members.user": userId }).populate("members.user", MEMBER_FIELDS))
            .filter((group) => memberOf(group, userId));

        if (groups.length === 0) {
            return res.status(200).json([]);
        }

        const expenses = await Expense.find({
            $or: groups.flatMap((group) => {
                const me = memberOf(group, userId)!._id;
                return [
                    { group: group._id, paidBy: me },
                    { group: group._id, "participants.member": me },
                ];
            }),
        });

        const groupedExpenses = groups
            .map((group) => ({
                group,
                expenses: expenses.filter((expense) => expense.group.equals(group._id)),
            }))
            .filter((entry) => entry.expenses.length > 0)
            .map((entry) => serializeUserExpensesGroup({
                groupId: entry.group._id,
                groupName: entry.group.name,
                groupDescription: entry.group.description,
                members: entry.group.members,
                expenses: hydrateMembers(entry.group, entry.expenses, MEMBER_PATHS),
            }));

        res.status(200).json(groupedExpenses);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error getting expenses" });
    }
};

const deleteExpense = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user;
        const { groupId, expenseId } = req.params;

        const expense = await Expense.findOne({ _id: expenseId, group: groupId });
        if (!expense) {
            return res.status(404).json({ error: "Expense not found in this group" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!memberOf(group, userId)) {
            return res.status(403).json({ error: "You must be a member of this group to delete expenses" });
        }

        await Expense.findByIdAndDelete(expenseId);
        res.status(200).json({ message: "Expense successfully deleted" });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Error deleting the expense" });
    }
}


export { createExpense, updateExpense, getExpensesByGroupId, getExpensesByUserId, deleteExpense };

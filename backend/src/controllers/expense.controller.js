const Decimal = require("decimal.js");
const Expense = require("../schemas/expense.schema");
const Group = require("../schemas/group.schema");
const mongoose = require("mongoose");
const { MEMBER_FIELDS, memberOf, hydrateMembers, linkedUserIds } = require("../utils/members");
const { sendNotificationToUser, notificationTypes } = require("../services/notifications");

const MEMBER_PATHS = ["paidBy", "participants.member"];
const CENT = new Decimal("0.01");

const groupSummary = (group) => ({
    _id: group._id,
    name: group.name,
    description: group.description,
    members: group.members,
});

const expenseResponse = (group, expenses) => {
    const hydrated = hydrateMembers(group, expenses, MEMBER_PATHS);
    const withGroup = (expense) => ({ ...expense, group: groupSummary(group) });

    return Array.isArray(hydrated) ? hydrated.map(withGroup) : withGroup(hydrated);
};

const validateExpense = ({ group, paidBy, participants, totalAmount }) => {
    const memberIds = new Set(group.members.map((member) => member._id.toString()));

    if (!memberIds.has(String(paidBy))) {
        return "Payer is not part of the group";
    }
    if (participants.some((participant) => !memberIds.has(String(participant)))) {
        return "One or more participants are not part of the group";
    }
    if (totalAmount <= 0) {
        return "Total amount must be greater than 0";
    }
    if (totalAmount >= 1000000) {
        return "Total amount must be less than 1,000,000";
    }
    return null;
};

// An even split rarely divides into whole cents, so the shares are floored and
// the leftover cents are handed out one each, from the top of the list. Splitting
// with toFixed(2) instead left the group's balance off by those cents forever.
const splitEvenly = (participants, totalAmount) => {
    const total = new Decimal(totalAmount);
    const share = total.dividedBy(participants.length).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const leftoverCents = total.minus(share.times(participants.length)).times(100).toNumber();

    return participants.map((member, index) => ({
        member,
        amountOwed: (index < leftoverCents ? share.plus(CENT) : share).toNumber(),
    }));
};

const createExpense = async (req, res) => {
    try {
        const { id: userId } = req.jwtPayload;
        const { groupId } = req.params;
        const { description, totalAmount, paidBy, participants } = req.body;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: "Invalid group or expense ID" });
        }

        if (!description || !totalAmount || !paidBy || !participants || participants.length === 0) {
            return res.status(400).json({ error: "Incomplete data" });
        }

        const group = await Group.findById(groupId).populate("members.user", MEMBER_FIELDS);
        if (!group) {
            return res.status(400).json({ error: "Group does not exist" });
        }

        if (!memberOf(group, userId)) {
            return res.status(403).json({ error: 'You must be a member of this group to create an expense' });
        }

        const invalid = validateExpense({ group, paidBy, participants, totalAmount });
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

const updateExpense = async (req, res) => {
    try {
        const { id: userId } = req.jwtPayload;
        const { expenseId, groupId } = req.params;
        const { description, totalAmount, paidBy, participants } = req.body;

        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(expenseId)) {
            return res.status(400).json({ error: "Invalid group or expense ID" });
        }

        if (!description || !totalAmount || !paidBy || !participants || participants.length === 0) {
            return res.status(400).json({ error: "Some required fields are missing" });
        }

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

        const invalid = validateExpense({ group, paidBy, participants, totalAmount });
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

        return res.status(200).json(expenseResponse(group, updatedExpense));
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error editing expense" });
    }
}

const getExpensesByGroupId = async (req, res) => {
    try {
        const { id: userId } = req.jwtPayload;
        const { groupId } = req.params;

        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: "Invalid group ID" });
        }

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

const getExpensesByUserId = async (req, res) => {
    try {
        const { id: userId } = req.jwtPayload;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        // The user id is no longer written on an expense: it has to be resolved
        // to the member id they own in each of their groups first.
        const groups = await Group.find({ "members.user": userId }).populate("members.user", MEMBER_FIELDS);
        if (groups.length === 0) {
            return res.status(200).json([]);
        }

        const expenses = await Expense.find({
            $or: groups.flatMap((group) => {
                const me = memberOf(group, userId)._id;
                return [
                    { group: group._id, paidBy: me },
                    { group: group._id, "participants.member": me },
                ];
            }),
        });

        const groupedExpenses = groups
            .map((group) => ({
                groupId: group._id.toString(),
                groupName: group.name,
                groupDescription: group.description,
                expenses: expenseResponse(
                    group,
                    expenses.filter((expense) => expense.group.equals(group._id)),
                ),
            }))
            .filter((entry) => entry.expenses.length > 0);

        res.status(200).json(groupedExpenses);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error getting expenses" });
    }
};

const deleteExpense = async (req, res) => {
    try {
        const { id: userId } = req.jwtPayload;
        const { groupId, expenseId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(expenseId)) {
            return res.status(400).json({ error: "Invalid group or expense ID" });
        }

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


module.exports = { createExpense, updateExpense, getExpensesByGroupId, getExpensesByUserId, deleteExpense };

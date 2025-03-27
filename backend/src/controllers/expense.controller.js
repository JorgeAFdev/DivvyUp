const Expense = require("../schemas/expense.schema");
const User = require("../schemas/user.schema");
const Group = require("../schemas/group.schema");
const mongoose = require("mongoose");
const { sendNotificationToUser, notificationTypes } = require("../services/notifications");

const createExpense = async (req, res) => {
    try {
        const { id: userId } = req.jwtPayload;
        const { groupId } = req.params;
        const { description, totalAmount, paidBy, participants } = req.body;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: "Invalid group or expense ID" });
        }

        if (!description || !totalAmount || !groupId || !paidBy || !participants || participants.length === 0) {
            return res.status(400).json({ error: "Incomplete data" });
        }

        const groupExists = await Group.findById(groupId).populate("members", "_id");
        if (!groupExists) {
            return res.status(400).json({ error: "Group does not exist" });
        }

        const payer = await User.findById(paidBy);
        if (!payer) {
            return res.status(400).json({ error: "User paying the expense does not exist" });
        }

        const groupMembers = groupExists.members.map((m) => m.user.toString());
        if (!groupMembers.includes(paidBy.toString())) {
            return res.status(400).json({ error: "Payer is not part of the group" });
        }

        // Validate user autenticated belongs to group
        const creatorExists = groupMembers.some(user => user.toString() === userId)
        if (!creatorExists) {
            return res.status(403).json({ error: 'You must be a member of this group to create an expense' });
        }

        // Format Participants
        const formatedParticipants = participants.map((participant) => ({ user: participant }))

        // Verify participants exists as users
        const participantIds = formatedParticipants.map((p) => p.user);
        const participantsExist = await User.find({ _id: { $in: participantIds } });
        if (participantsExist.length !== participantIds.length) {
            return res.status(400).json({ error: "One or more participants are not valid users" });
        }

        const participantsNotInGroup = participantIds.filter((p) => !groupMembers.includes(p));
        if (participantsNotInGroup.length > 0) {
            return res.status(400).json({ error: "One or more participants are not part of the group" });
        }

        if (totalAmount <= 0) {
            return res.status(400).json({ error: "Total amount must be greater than 0" });
        }

        if (totalAmount >= 1000000) {
            return res.status(400).json({ error: "Total amount must be less than 1,000,000" });
        }

        const totalParticipants = participants.length;
        const amountPerParticipant = totalAmount / totalParticipants;
        const roundedAmount = amountPerParticipant.toFixed(2);

        const updatedParticipants = formatedParticipants.map((p) => ({
            user: p.user,
            amountOwed: roundedAmount,
        }));

        const newExpense = await Expense.create({
            description,
            totalAmount,
            group: groupId,
            paidBy: paidBy,
            participants: updatedParticipants,
        });

        const expense = await Expense.findById(newExpense._id).populate("participants.user", "name").populate({ path: "group", select: "name description members", populate: { path: "members.user", select: "name" } }).populate("paidBy", "name");

        const io = req.app.get('socketio');
        participantIds.forEach(participant => {
            if (participant.toString() === userId) { return; }

            sendNotificationToUser(io, participant.toString(), notificationTypes.EXPENSE_CREATED, `you have been added to expense ${expense.description} from group ${expense.group.name}`, {
                expenseId: expense._id,
                expenseDescription: expense.description,
                expenseAmount: expense.totalAmount
            })
        });

        res.status(201).json(expense);
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

        if (!description || !totalAmount || !participants || participants.length === 0) {
            return res.status(400).json({ error: "Some required fields are missing" });
        }

        const expense = await Expense.findOne({ _id: expenseId, group: groupId });
        if (!expense) {
            return res.status(404).json({ error: "Expense not found in this group" });
        }

        const payer = await User.findById(paidBy);
        if (!payer) {
            return res.status(400).json({ error: "User paying the expense does not exist" });
        }

        const groupExists = await Group.findById(groupId).populate("members", "_id");
        if (!groupExists) {
            return res.status(400).json({ error: "Group does not exist" });
        }

        const groupMembers = groupExists.members.map((m) => m.user.toString());
        if (!groupMembers.includes(paidBy.toString())) {
            return res.status(400).json({ error: "Payer is not part of the group" });
        }

        // Validate user autenticated belongs to group
        const isMember = groupMembers.some(user => user.toString() === userId)
        if (!isMember) {
            return res.status(403).json({ error: 'You must be a member of this group to update this expense' });
        }

        // Format Participants
        const formatedParticipants = participants.map((participant) => ({ user: participant }))

        // Verify participants exists as users
        const participantIds = formatedParticipants.map((p) => p.user);
        const participantsExist = await User.find({ _id: { $in: participantIds } });
        if (participantsExist.length !== participantIds.length) {
            return res.status(400).json({ error: "One or more participants are not valid users" });
        }

        const participantsNotInGroup = participantIds.filter((p) => !groupMembers.includes(p));
        if (participantsNotInGroup.length > 0) {
            return res.status(400).json({ error: "One or more participants are not part of the group" });
        }

        if (totalAmount <= 0) {
            return res.status(400).json({ error: "Total amount must be greater than 0" });
        }

        if (totalAmount >= 1000000) {
            return res.status(400).json({ error: "Total amount must be less than 1,000,000" });
        }

        const totalParticipants = participants.length;
        const amountPerParticipant = totalAmount / totalParticipants;
        const roundedAmount = amountPerParticipant.toFixed(2);

        const updatedParticipants = formatedParticipants.map((p) => ({
            user: p.user,
            amountOwed: roundedAmount,
        }));

        const updatedExpense = await Expense.findByIdAndUpdate(expenseId, {
            description,
            totalAmount,
            paidBy,
            participants: updatedParticipants,
        },
            { new: true }
        );

        const newExpense = await Expense.findById(updatedExpense._id).populate("participants.user", "name").populate({ path: "group", select: "name description members", populate: { path: "members.user", select: "name" } }).populate("paidBy", "name");

        return res.status(200).json(newExpense);
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

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const isMember = group.members.some((m) => m.user.toString() === userId);
        if (!isMember) {
            return res.status(403).json({ error: "You don't have permission to view expenses from this group" });
        }

        const expenses = await Expense.find({ group: groupId }).populate("participants.user", "name").populate({ path: "group", select: "name description members", populate: { path: "members.user", select: "name" } }).populate("paidBy", "name");

        if (expenses.length <= 0) { return res.status(404).json({ error: "Expenses not found for this group" }) }

        res.status(200).json(expenses);
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

        const expenses = await Expense.find({ $or: [{ "participants.user": userId }, { paidBy: userId }] }).populate("participants.user", "name").populate({ path: "group", select: "name description members", populate: { path: "members.user", select: "name" } }).populate("paidBy", "name profilePicture");

        if (expenses.length <= 0) { return res.status(404).json({ error: "Expenses not found for this user" }) }

        const expensesByGroup = {};

        expenses.forEach(expense => {
            const groupId = expense.group._id.toString();

            expensesByGroup[groupId] = expensesByGroup[groupId] ?? {
                groupId: groupId,
                groupName: expense.group.name,
                groupDescription: expense.group.description,
                expenses: []
            };

            expensesByGroup[groupId].expenses.push(expense);
        });
        const groupedExpenses = Object.values(expensesByGroup);
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

        const isMember = group.members.some(member => member.user.toString() === userId);
        if (!isMember) {
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
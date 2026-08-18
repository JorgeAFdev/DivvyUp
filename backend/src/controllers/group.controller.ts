import type { Request, Response } from "express";
import Expense from "../schemas/expense.schema.js";
import Group from "../schemas/group.schema.js";
import Payment from "../schemas/payment.schema.js";
import mongoose from "mongoose";
import { MEMBER_FIELDS, MEMBER_PATHS, memberOf, hydrateMembers } from "../utils/members.js";
import { updateBalance, generateDebts } from "../services/ledger.js";
import { cleanName, hasDuplicateNames } from "../utils/validation.js";
import { serializeGroup, serializeGroupDetails } from "../serializers/contract.js";

const createGroup = async (req: Request, res: Response) => {
  try {
    const { id: userId, name: creatorName } = req.user;
    const { name, description, members } = req.body;

    // Member names are trimmed by groupSchema; the creator's name comes from the
    // Better Auth session, which no schema touches, so it is normalized here.
    // members[].user stays an ObjectId — it is the Better Auth user's _id.
    const formattedMembers = [
      { name: cleanName(creatorName), user: new mongoose.Types.ObjectId(userId) },
      ...members.map((member: any) => ({ name: member.name })),
    ];

    if (hasDuplicateNames(formattedMembers.map((member) => member.name))) {
      return res.status(400).json({ error: "Duplicate members are not allowed" });
    }

    const group = await Group.create({ name, description, members: formattedMembers });
    await updateBalance(group);
    await group.populate("members.user", MEMBER_FIELDS);

    res.status(201).json(serializeGroup(group));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating group" });
  }
};

const updateGroup = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user;
    const { groupId } = req.params;
    const { name, description, members } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const me = memberOf(group, userId);
    if (!me) {
      return res.status(403).json({ error: "You don't have permission to edit this group" });
    }

    if (hasDuplicateNames(members.map((member: any) => member.name))) {
      return res.status(400).json({ error: "Duplicate members are not allowed" });
    }

    const currentById = new Map(group.members.map((member) => [member._id.toString(), member]));
    const keptIds = new Set();

    for (const entry of members) {
      if (!entry._id) { continue; }
      if (!currentById.has(entry._id.toString())) {
        return res.status(400).json({ error: "One or more members do not belong to this group" });
      }
      if (keptIds.has(entry._id.toString())) {
        return res.status(400).json({ error: "Duplicate members are not allowed" });
      }
      keptIds.add(entry._id.toString());
    }

    if (!keptIds.has(me._id.toString())) {
      return res.status(403).json({ error: "You cannot remove yourself from the group while updating it" });
    }

    const removed = group.members.filter((member) => !keptIds.has(member._id.toString()));
    const membershipChanged = removed.length > 0 || members.some((entry: any) => !entry._id);

    if (removed.length > 0) {
      const removedIds = removed.map((member) => member._id);
      const [expenses, settledPayments] = await Promise.all([
        Expense.find({
          group: groupId,
          $or: [{ paidBy: { $in: removedIds } }, { "participants.member": { $in: removedIds } }],
        }),
        Payment.find({
          group: groupId,
          status: "paid",
          $or: [{ from: { $in: removedIds } }, { to: { $in: removedIds } }],
        }),
      ]);

      const blocking = removed.filter(
        (member) =>
          expenses.some(
            (expense) =>
              expense.paidBy.equals(member._id) ||
              expense.participants.some((participant) => participant.member.equals(member._id)),
          ) ||
          settledPayments.some(
            (payment) => payment.from.equals(member._id) || payment.to.equals(member._id),
          ),
      );

      if (blocking.length > 0) {
        return res.status(409).json({
          error: `These members have expenses or settled debts and cannot be removed: ${blocking.map((member) => member.name).join(", ")}`,
        });
      }
    }

    group.set({
      name,
      description,
      members: members.map((entry: any) => {
        const current = entry._id && currentById.get(entry._id.toString());
        return current
          ? { _id: current._id, name: entry.name, user: current.user }
          : { name: entry.name };
      }),
    });

    await group.save();
    await updateBalance(group);
    // Regenerating deletes and re-creates every pending Payment, so a rename
    // would 404 anyone who already had a debt open on screen.
    if (membershipChanged) {
      await generateDebts(group);
    }
    await group.populate("members.user", MEMBER_FIELDS);

    res.status(200).json(serializeGroup(group));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating group" });
  }
};

const getUserGroups = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user Id" });
    }

    const groups = await Group.find({ "members.user": userId }).populate("members.user", MEMBER_FIELDS);

    res.status(200).json(groups.map(serializeGroup));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting groups" })
  }
};

const getGroupById = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user;
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate("members.user", MEMBER_FIELDS);
    if (!group) {
      return res.status(400).json({ error: "Group does not exist" })
    }

    if (!memberOf(group, userId)) {
      return res.status(403).json({ error: "You don't have permission to view this group" });
    }

    res.status(200).json(serializeGroup(group));
  } catch (error) {
    res.status(500).json({ error: "Error getting group" });
  }
};

const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user;
    const { groupId } = req.params;

    const group = await Group.findById(groupId)
    if (!group) { return res.status(404).json({ error: 'group not found' }) }

    if (!memberOf(group, userId)) {
      return res.status(403).json({ error: "You don't have permission to edit this group" });
    }

    await Group.findByIdAndDelete(groupId);
    await Expense.deleteMany({ group: groupId });
    await Payment.deleteMany({ group: groupId });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting group' });
  }
};


const getGroupDetails = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user;
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate('members.user', MEMBER_FIELDS);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!memberOf(group, userId)) {
      return res.status(403).json({ error: "You don't have permission to view expenses from this group" });
    }

    const expenses = await Expense.find({ group: groupId });

    const debts = await Payment.find({
      group: groupId,
      status: 'pending'
    });

    res.status(200).json(serializeGroupDetails({
      inviteCode: group.inviteCode,
      members: group.members,
      expenses: hydrateMembers(group, expenses, MEMBER_PATHS),
      balance: hydrateMembers(group, [...group.balance], ["member"] as const),
      debts: hydrateMembers(group, debts, ["from", "to"] as const),
    }));
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error getting group details" });
  }
}

export {
  createGroup,
  getGroupById,
  updateGroup,
  deleteGroup,
  getUserGroups,
  getGroupDetails,
};

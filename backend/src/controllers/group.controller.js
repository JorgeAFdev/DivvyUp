const Expense = require("../schemas/expense.schema");
const Group = require("../schemas/group.schema");
const Payment = require("../schemas/payment.schema");
const User = require("../schemas/user.schema");
const mongoose = require("mongoose");
const { MEMBER_FIELDS, memberOf, hydrateMembers } = require("../utils/members");


const cleanName = (name) => (typeof name === "string" ? name.trim() : "");

const hasDuplicateNames = (names) => {
  const normalized = names.map((name) => name.toLowerCase());
  return new Set(normalized).size !== normalized.length;
};

const validateGroupBody = ({ name, description, members }) => {
  if (!name || !description || !members || members.length === 0) {
    return "incomplete data";
  }
  if (name.length > 30) { return "name is too large"; }
  if (description.length > 50) { return "description is too large"; }
  if (members.some((member) => !cleanName(member.name))) {
    return "Every member needs a name";
  }
  if (members.some((member) => cleanName(member.name).length > 30)) {
    return "member name is too large";
  }
  return null;
};

const createGroup = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { name, description, members } = req.body;

    const invalid = validateGroupBody({ name, description, members });
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    const creator = await User.findById(userId);
    if (!creator) {
      return res.status(404).json({ error: "User not found" });
    }

    const formattedMembers = [
      { name: cleanName(creator.name), user: creator._id },
      ...members.map((member) => ({ name: cleanName(member.name) })),
    ];

    if (hasDuplicateNames(formattedMembers.map((member) => member.name))) {
      return res.status(400).json({ error: "Duplicate members are not allowed" });
    }

    const group = await Group.create({ name, description, members: formattedMembers });
    await group.updateBalance();
    await group.populate("members.user", MEMBER_FIELDS);

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating group" });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { groupId } = req.params;
    const { name, description, members } = req.body;

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const invalid = validateGroupBody({ name, description, members });
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const me = memberOf(group, userId);
    if (!me) {
      return res.status(403).json({ error: "You don't have permission to edit this group" });
    }

    if (hasDuplicateNames(members.map((member) => cleanName(member.name)))) {
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
    const membershipChanged = removed.length > 0 || members.some((entry) => !entry._id);

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
      members: members.map((entry) => {
        const current = entry._id && currentById.get(entry._id.toString());
        return current
          ? { _id: current._id, name: cleanName(entry.name), user: current.user }
          : { name: cleanName(entry.name) };
      }),
    });

    await group.save();
    await group.updateBalance();
    // Regenerating deletes and re-creates every pending Payment, so a rename
    // would 404 anyone who already had a debt open on screen.
    if (membershipChanged) {
      await group.generateDebts();
    }
    await group.populate("members.user", MEMBER_FIELDS);

    res.status(200).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating group" });
  }
};

const getUserGroups = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user Id" });
    }

    const groups = await Group.find({ "members.user": userId }).populate("members.user", MEMBER_FIELDS);

    res.status(200).json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting groups" })
  }
};

const getGroupById = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { groupId } = req.params;

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }
    const group = await Group.findById(groupId).populate("members.user", MEMBER_FIELDS);
    if (!group) {
      return res.status(400).json({ error: "Group does not exist" })
    }

    if (!memberOf(group, userId)) {
      return res.status(403).json({ error: "You don't have permission to view this group" });
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ error: "Error getting group" });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { groupId } = req.params;

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

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


const getGroupDetails = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { groupId } = req.params;

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

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

    res.status(200).json({
      inviteCode: group.inviteCode,
      members: group.members,
      expenses: hydrateMembers(group, expenses, ["paidBy", "participants.member"]),
      balance: hydrateMembers(group, group.balance, ["member"]),
      debts: hydrateMembers(group, debts, ["from", "to"]),
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error getting group details" });
  }
}

// Public on purpose, and deliberately not the same handler as the one below:
// the list of unclaimed members is the part that must stay behind the token,
// and a condition inside one handler is one bug away from leaking it.
const getInviteName = async (req, res) => {
  try {
    const { inviteCode } = req.params;

    const group = await Group.findOne({ inviteCode }).select("name");
    if (!group) {
      return res.status(404).json({ error: "This invite link is no longer valid" });
    }

    res.status(200).json({ name: group.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting invite" });
  }
};

const getGroupByInviteCode = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { inviteCode } = req.params;

    const group = await Group.findOne({ inviteCode });
    if (!group) {
      return res.status(404).json({ error: "This invite link is no longer valid" });
    }

    res.status(200).json({
      _id: group._id,
      name: group.name,
      description: group.description,
      alreadyMember: Boolean(memberOf(group, userId)),
      members: group.members
        .filter((member) => !member.user)
        .map((member) => ({ _id: member._id, name: member.name })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting group" });
  }
};

const joinGroup = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { inviteCode } = req.params;
    const { memberId, name } = req.body;

    const group = await Group.findOne({ inviteCode });
    if (!group) {
      return res.status(404).json({ error: "This invite link is no longer valid" });
    }

    if (memberOf(group, userId)) {
      return res.status(409).json({ error: "You are already a member of this group" });
    }

    if (memberId) {
      if (!mongoose.Types.ObjectId.isValid(memberId)) {
        return res.status(400).json({ error: "Invalid member ID" });
      }

      const member = group.members.id(memberId);
      if (!member) {
        return res.status(404).json({ error: "That member is not in this group" });
      }
      if (member.user) {
        return res.status(409).json({ error: "That member is already linked to an account" });
      }

      member.user = userId;
      await group.save();
    } else if (cleanName(name)) {
      const names = group.members.map((member) => member.name).concat(cleanName(name));
      if (hasDuplicateNames(names)) {
        return res.status(400).json({ error: "Duplicate members are not allowed" });
      }

      group.members.push({ name: cleanName(name), user: userId });
      await group.save();
      await group.updateBalance();
    } else {
      return res.status(400).json({ error: "A memberId or a name is required" });
    }

    await group.populate("members.user", MEMBER_FIELDS);
    res.status(200).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error joining group" });
  }
};

const regenerateInviteCode = async (req, res) => {
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

    if (!memberOf(group, userId)) {
      return res.status(403).json({ error: "You don't have permission to edit this group" });
    }

    group.inviteCode = Group.newInviteCode();
    await group.save();

    res.status(200).json({ inviteCode: group.inviteCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error regenerating the invite code" });
  }
};

module.exports = {
  createGroup,
  getInviteName,
  getGroupById,
  updateGroup,
  deleteGroup,
  getUserGroups,
  getGroupDetails,
  getGroupByInviteCode,
  joinGroup,
  regenerateInviteCode
};

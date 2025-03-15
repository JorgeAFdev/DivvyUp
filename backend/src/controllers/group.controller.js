const Expense = require("../schemas/expense.schema");
const Group = require("../schemas/group.schema");
const Payment = require("../schemas/payment.schema");
const User = require("../schemas/user.schema");
const mongoose = require("mongoose");

const createGroup = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { name, description, members } = req.body;
    if (!name || !description || !members || members.length === 0) {
      return res.status(400).json({ error: "incomplete data" })
    }

    if (name.length > 30) { return res.status(400).json({ error: 'name is too large' }) };
    if (description.length > 50) { return res.status(400).json({ error: 'description is too large' }) };

    // members to array of strings
    const emailMembers = members.map((m) => m.email);

    const hasDuplicates = new Set(emailMembers).size !== emailMembers.length;
    if (hasDuplicates) {
      return res.status(400).json({ error: 'Duplicate members are not allowed' });
    }

    // verify members exists as users
    const existingUsers = await User.find({ email: { $in: emailMembers } });
    if (existingUsers.length !== members.length) {
      return res.status(400).json({ error: 'One or more members do not exist' })
    }

    // Validate user autenticated belongs to one of the members
    const creatorExists = existingUsers.some(user => user._id.toString() === userId)
    if (!creatorExists) {
      return res.status(403).json({ error: 'The creator of the group must be a member' });
    }

    // format members
    const formattedMembers = existingUsers.map((user) => ({ user: user._id }));

    const group = await Group.create({
      name,
      description,
      members: formattedMembers
    })

    const newGroup = await Group.findById(group._id).populate("members.user", "name email")
    await newGroup.updateBalance();
    res.status(201).json(newGroup);
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
    if (!name || !description || !members || members.length === 0) {
      return res.status(400).json({ error: "incomplete data" })
    }

    if (name.length > 30) { return res.status(400).json({ error: 'name is too large' }) };
    if (description.length > 50) { return res.status(400).json({ error: 'description is too large' }) };

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // validate if a member is updating the group
    const isMember = group.members.some((m) => m.user.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: "You don't have permission to edit this group" });
    }

    // members to array of strings
    const emailMembers = members.map((m) => m.email);

    const hasDuplicates = new Set(emailMembers).size !== emailMembers.length;
    if (hasDuplicates) {
      return res.status(400).json({ error: 'Duplicate members are not allowed' });
    }

    // verify members exists as users
    const existingUsers = await User.find({ email: { $in: emailMembers } });
    if (existingUsers.length !== emailMembers.length) {
      return res.status(400).json({ error: 'One or more members do not exist' })
    }

    // Validate user autenticated is still a member
    const userStillMember = existingUsers.some(user => user._id.toString() === userId)
    if (!userStillMember) {
      return res.status(403).json({ error: 'You cannot remove yourself from the group while updating it' });
    }

    // format members
    const formattedMembers = existingUsers.map((user) => ({ user: user._id }));

    const newGroup = await Group.findByIdAndUpdate(groupId, {
      name,
      description,
      members: formattedMembers
    },
      { new: true }
    ).populate("members.user", "name email");
    if (!newGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    await newGroup.updateBalance();

    res.status(200).json(newGroup);
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

    const groups = await Group.find({ "members.user": userId }).populate("members.user", "name email");
    if (groups.length === 0) {
      return res.status(404).json({ error: "Groups not found" });
    }
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
    const group = await Group.findById(groupId).populate("members.user", "name");
    if (!group) {
      return res.status(400).json({ error: "Group does not exist" })
    }

    // validate user belongs to the group
    const isMember = group.members.some((m) => m.user._id.toString() === userId);
    if (!isMember) {
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

    // validate if a member is deleting the group
    const isMember = group.members.some((m) => m.user.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: "You don't have permission to edit this group" });
    }

    await Group.findByIdAndDelete(groupId);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error deleting group" });
  }
};


const getGroupDetails = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { groupId } = req.params;

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const group = await Group.findById(groupId).populate('members.user').populate('balance.user');

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isMember = group.members.some((m) => m.user._id.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: "You don't have permission to view expenses from this group" });
    }

    const expenses = await Expense.find({ group: groupId }).populate("participants.user", "name").populate({ path: "group", select: "name description members", populate: { path: "members.user", select: "name" } }).populate("paidBy", "name profilePicture");

    const debts = await Payment.find({
      group: groupId,
      status: 'pending'
    }).populate("from", "name").populate("to", "name");

    res.status(200).json({ expenses, balance: group.balance, debts });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error getting group details" });
  }
}

module.exports = {
  createGroup,
  getGroupById,
  updateGroup,
  deleteGroup,
  getUserGroups,
  getGroupDetails
};

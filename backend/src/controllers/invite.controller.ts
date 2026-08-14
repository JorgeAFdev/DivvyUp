import type { Request, Response } from "express";
import type { InviteName, InviteCode } from "@monorepo/shared";
import mongoose from "mongoose";
import Group from "../schemas/group.schema.js";
import { MEMBER_FIELDS, memberOf } from "../utils/members.js";
import { updateBalance } from "../services/ledger.js";
import { cleanName, hasDuplicateNames } from "../utils/validation.js";
import { serializeGroup, serializeInviteInfo } from "../serializers/contract.js";

// Public on purpose, and deliberately not the same handler as the one below:
// the list of unclaimed members is the part that must stay behind the token,
// and a condition inside one handler is one bug away from leaking it.
const getInviteName = async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.params;

    const group = await Group.findOne({ inviteCode }).select("name");
    if (!group) {
      return res.status(404).json({ error: "This invite link is no longer valid" });
    }

    res.status(200).json({ name: group.name } satisfies InviteName);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting invite" });
  }
};

const getGroupByInviteCode = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { inviteCode } = req.params;

    const group = await Group.findOne({ inviteCode });
    if (!group) {
      return res.status(404).json({ error: "This invite link is no longer valid" });
    }

    res.status(200).json(serializeInviteInfo({
      _id: group._id,
      name: group.name,
      description: group.description,
      alreadyMember: Boolean(memberOf(group, userId)),
      members: group.members
        .filter((member) => !member.user)
        .map((member) => ({ _id: member._id, name: member.name })),
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting group" });
  }
};

const joinGroup = async (req: Request, res: Response) => {
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

      member.user = new mongoose.Types.ObjectId(userId);
      await group.save();
    } else if (cleanName(name)) {
      const names = group.members.map((member) => member.name).concat(cleanName(name));
      if (hasDuplicateNames(names)) {
        return res.status(400).json({ error: "Duplicate members are not allowed" });
      }

      group.members.push({ name: cleanName(name), user: new mongoose.Types.ObjectId(userId) });
      await group.save();
      await updateBalance(group);
    } else {
      return res.status(400).json({ error: "A memberId or a name is required" });
    }

    await group.populate("members.user", MEMBER_FIELDS);
    res.status(200).json(serializeGroup(group));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error joining group" });
  }
};

const regenerateInviteCode = async (req: Request, res: Response) => {
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

    res.status(200).json({ inviteCode: group.inviteCode } satisfies InviteCode);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error regenerating the invite code" });
  }
};

export { getInviteName, getGroupByInviteCode, joinGroup, regenerateInviteCode };

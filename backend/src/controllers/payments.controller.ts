import type { Request, Response } from "express";
import mongoose from "mongoose";
import Group from "../schemas/group.schema.js";
import Payment from "../schemas/payment.schema.js";
import { MEMBER_FIELDS, memberOf, hydrateMembers, linkedUserIds } from "../utils/members.js";
import { sendNotificationToUser, notificationTypes } from "../services/notifications.js";
import { updateBalance, generateDebts } from "../services/ledger.js";

const pay = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.jwtPayload!;
    const { paymentId } = req.params;

    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(409).json({ error: "This debt is not pending" });
    }

    const group = await Group.findById(payment.group).populate('members.user', MEMBER_FIELDS);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const me = memberOf(group, userId);
    if (!me) {
      return res.status(403).json({ error: "You don't have permission to pay this debt" });
    }

    const from = group.members.id(payment.from);
    const to = group.members.id(payment.to);

    // Nobody is a party to a debt between two members without an account, so
    // any member of the group can settle that one on their behalf.
    const bothUnclaimed = !from?.user && !to?.user;
    const isParty = me._id.equals(payment.from) || me._id.equals(payment.to);
    if (!isParty && !bothUnclaimed) {
      return res.status(403).json({ error: "You don't have permission to update this payment" });
    }

    payment.status = "paid";
    payment.paidAt = new Date();
    await payment.save();

    const io = req.app.get('socketio');
    linkedUserIds(group, [payment.to])
      .filter((linkedUserId) => linkedUserId !== userId)
      .forEach((linkedUserId) => {
        sendNotificationToUser(io, linkedUserId, notificationTypes.DEBT_SETTLED, `${from?.name} has settled their debt with ${to?.name}`, {
          paymentId: payment._id,
          paymentAmount: payment.amount,
          groupId: payment.group.toString()
        })
      });

    await updateBalance(group);
    await generateDebts(group);

    res.status(200).json(hydrateMembers(group, payment, ["from", "to"]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating payment." });
  }
};

export { pay };

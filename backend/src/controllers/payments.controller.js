const mongoose = require("mongoose");
const Group = require("../schemas/group.schema");
const Payment = require("../schemas/payment.schema");
const { sendNotificationToUser, notificationTypes } = require("../services/notifications");

const pay = async (req, res) => {
  try {
    const { id: userId } = req.jwtPayload;
    const { paymentId } = req.params;

    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const payment = await Payment.findById(paymentId).populate('from', '_id name').populate('to', '_id name');
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const groupId = payment.group;
    const group = await Group.findById(groupId).populate('members.user').populate('balance.user');

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isMember = group.members.some((m) => m.user._id.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: "You don't have permission to pay this debt" });
    }

    const from = payment.from._id.toString();
    const to = payment.to._id.toString();

    if (userId !== from && userId !== to) {
      return res.status(403).json({ error: "You don't have permission to update this payment" });
    }

    payment.status = "paid";
    await payment.save();

    const io = req.app.get('socketio');

    sendNotificationToUser(io, to, notificationTypes.DEBT_SETTLED, `${payment.from.name} has settled his debt with ${payment.to.name}`, {
      paymentId: payment._id,
      paymentAmount: payment.amount,
      groupId: payment.group._id.toString()
    })

    await group.updateBalance();
    await group.generateDebts();

    res.status(200).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating payment." });
  }
};

module.exports = { pay };

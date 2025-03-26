const mongoose = require('mongoose');
const Expense = require('./expense.schema');
const Payment = require('./payment.schema');


const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      }],
    balance: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: {
          type: Number,
          default: 0
        }
      }
    ]
  },
  {
    timestamps: true,
  }
);

function roundToTwoDecimals(num) {
  return (Math.round(num * 100) / 100);
}

GroupSchema.methods.updateBalance = async function () {
  const expenses = await Expense.find({ group: this._id }).populate("participants.user", "name").populate({ path: "group", select: "name description members", populate: { path: "members.user", select: "name" } }).populate("paidBy", "name");

  const completedPayments = await Payment.find({
    group: this._id,
    status: 'paid'
  });

  if (expenses.length === 0) {
    this.balance = this.members.map(member => ({
      user: member.user._id,
      amount: 0
    }));
  } else {
    const balance = {}

    expenses.forEach((expense) => {
      const { paidBy, participants, totalAmount } = expense;
      balance[paidBy._id] = balance[paidBy._id] ?? { user: paidBy._id, amount: 0 };
      balance[paidBy._id].amount = roundToTwoDecimals(balance[paidBy._id].amount + totalAmount);

      participants.forEach((participant) => {
        const { user, amountOwed } = participant;
        balance[user._id] = balance[user._id] ?? { user: user._id, amount: 0 };
        balance[user._id].amount = roundToTwoDecimals(balance[user._id].amount - amountOwed);
      });
    });

    completedPayments.forEach((payment) => {
      const { from, to, amount } = payment;
      if (balance[from]) {
        balance[from].amount = roundToTwoDecimals(balance[from].amount + amount);
      }

      if (balance[to]) {
        balance[to].amount = roundToTwoDecimals(balance[to].amount - amount);
      }
    });

    this.members.forEach(member => {
      if (!balance[member.user._id]) {
        balance[member.user._id] = { user: member.user._id, amount: 0 };
      }
    });

    this.balance = Object.values(balance);
  }
  await this.save();
  return this.balance;
}

GroupSchema.methods.generateDebts = async function () {
  await Payment.deleteMany({
    group: this._id,
    status: 'pending'
  });

  const balanceCopy = JSON.parse(JSON.stringify(this.balance));
  let debts = [];
  let debtors = balanceCopy.filter(person => person.amount < 0);
  let creditors = balanceCopy.filter(person => person.amount > 0);

  for (let debtor of debtors) {
    for (let creditor of creditors) {
      if (debtor.amount === 0) break;

      let amountToPay = Math.min(Math.abs(debtor.amount), creditor.amount);
      amountToPay = roundToTwoDecimals(amountToPay);

      if (amountToPay > 0) {
        const newPayment = await Payment.create({
          group: this._id,
          from: debtor.user,
          to: creditor.user,
          amount: amountToPay,
          status: 'pending'
        });
        debts.push(newPayment);
      }


      debtor.amount = roundToTwoDecimals(debtor.amount + amountToPay);
      creditor.amount = roundToTwoDecimals(creditor.amount - amountToPay);
    }
  }

  return debts;
};

const Group = mongoose.model('Group', GroupSchema);
module.exports = Group;
const crypto = require('crypto');
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
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    members: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      }],
    balance: [
      {
        member: { type: mongoose.Schema.Types.ObjectId, required: true },
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

GroupSchema.statics.newInviteCode = function () {
  return crypto.randomBytes(16).toString('base64url');
};

GroupSchema.pre('validate', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = this.constructor.newInviteCode();
  }
  next();
});

GroupSchema.methods.updateBalance = async function () {
  const expenses = await Expense.find({ group: this._id });

  const completedPayments = await Payment.find({
    group: this._id,
    status: 'paid'
  });

  const balance = {};
  const entryFor = (memberId) => {
    const key = memberId.toString();
    balance[key] = balance[key] ?? { member: memberId, amount: 0 };
    return balance[key];
  };

  this.members.forEach((member) => entryFor(member._id));

  expenses.forEach((expense) => {
    const { paidBy, participants, totalAmount } = expense;
    const payer = entryFor(paidBy);
    payer.amount = roundToTwoDecimals(payer.amount + totalAmount);

    participants.forEach((participant) => {
      const { member, amountOwed } = participant;
      const debtor = entryFor(member);
      debtor.amount = roundToTwoDecimals(debtor.amount - amountOwed);
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

  this.balance = Object.values(balance);
  await this.save();
  return this.balance;
}

GroupSchema.methods.generateDebts = async function () {
  await Payment.deleteMany({
    group: this._id,
    status: 'pending'
  });

  const balanceCopy = this.balance.map(({ member, amount }) => ({ member, amount }));
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
          from: debtor.member,
          to: creditor.member,
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

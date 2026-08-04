const crypto = require('crypto');
const Decimal = require('decimal.js');
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

const toStoredAmount = (amount) => amount.toDecimalPlaces(2).toNumber();

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
    balance[key] = balance[key] ?? { member: memberId, amount: new Decimal(0) };
    return balance[key];
  };

  this.members.forEach((member) => entryFor(member._id));

  expenses.forEach((expense) => {
    const { paidBy, participants, totalAmount } = expense;
    const payer = entryFor(paidBy);
    payer.amount = payer.amount.plus(totalAmount);

    participants.forEach((participant) => {
      const { member, amountOwed } = participant;
      const debtor = entryFor(member);
      debtor.amount = debtor.amount.minus(amountOwed);
    });
  });

  completedPayments.forEach((payment) => {
    const { from, to, amount } = payment;
    if (balance[from]) {
      balance[from].amount = balance[from].amount.plus(amount);
    }

    if (balance[to]) {
      balance[to].amount = balance[to].amount.minus(amount);
    }
  });

  this.balance = Object.values(balance).map(({ member, amount }) => ({
    member,
    amount: toStoredAmount(amount),
  }));
  await this.save();
  return this.balance;
}

GroupSchema.methods.generateDebts = async function () {
  await Payment.deleteMany({
    group: this._id,
    status: 'pending'
  });

  const balanceCopy = this.balance.map(({ member, amount }) => ({ member, amount: new Decimal(amount) }));
  let debts = [];
  let debtors = balanceCopy.filter(person => person.amount.lessThan(0));
  let creditors = balanceCopy.filter(person => person.amount.greaterThan(0));

  for (let debtor of debtors) {
    for (let creditor of creditors) {
      if (debtor.amount.isZero()) break;

      const amountToPay = Decimal.min(debtor.amount.abs(), creditor.amount);

      if (amountToPay.greaterThan(0)) {
        const newPayment = await Payment.create({
          group: this._id,
          from: debtor.member,
          to: creditor.member,
          amount: toStoredAmount(amountToPay),
          status: 'pending'
        });
        debts.push(newPayment);
      }


      debtor.amount = debtor.amount.plus(amountToPay);
      creditor.amount = creditor.amount.minus(amountToPay);
    }
  }

  return debts;
};

const Group = mongoose.model('Group', GroupSchema);
module.exports = Group;

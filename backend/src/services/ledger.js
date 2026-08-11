import mongoose from 'mongoose';
import Decimal from 'decimal.js';

const toStoredAmount = (amount) => amount.toDecimalPlaces(2).toNumber();

export const updateBalance = async (group) => {
  const Expense = mongoose.model('Expense');
  const Payment = mongoose.model('Payment');

  const expenses = await Expense.find({ group: group._id });
  const completedPayments = await Payment.find({ group: group._id, status: 'paid' });

  const balance = {};
  const entryFor = (memberId) => {
    const key = memberId.toString();
    balance[key] = balance[key] ?? { member: memberId, amount: new Decimal(0) };
    return balance[key];
  };

  group.members.forEach((member) => entryFor(member._id));

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

  group.balance = Object.values(balance).map(({ member, amount }) => ({
    member,
    amount: toStoredAmount(amount),
  }));
  await group.save();
  return group.balance;
};

export const generateDebts = async (group) => {
  const Payment = mongoose.model('Payment');

  await Payment.deleteMany({ group: group._id, status: 'pending' });

  const balanceCopy = group.balance.map(({ member, amount }) => ({ member, amount: new Decimal(amount) }));
  const debts = [];
  const debtors = balanceCopy.filter((person) => person.amount.lessThan(0));
  const creditors = balanceCopy.filter((person) => person.amount.greaterThan(0));

  for (const debtor of debtors) {
    for (const creditor of creditors) {
      if (debtor.amount.isZero()) break;

      const amountToPay = Decimal.min(debtor.amount.abs(), creditor.amount);

      if (amountToPay.greaterThan(0)) {
        const newPayment = await Payment.create({
          group: group._id,
          from: debtor.member,
          to: creditor.member,
          amount: toStoredAmount(amountToPay),
          status: 'pending',
        });
        debts.push(newPayment);
      }

      debtor.amount = debtor.amount.plus(amountToPay);
      creditor.amount = creditor.amount.minus(amountToPay);
    }
  }

  return debts;
};

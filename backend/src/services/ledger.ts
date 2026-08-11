import mongoose, { Types } from 'mongoose';
import { Decimal } from 'decimal.js';
import Payment from '../schemas/payment.schema.js';
import type { GroupHydrated } from '../schemas/group.schema.js';
import type { ExpenseDoc } from '../schemas/expense.schema.js';

const toStoredAmount = (amount: Decimal) => amount.toDecimalPlaces(2).toNumber();

// Expense is reached by name to stay off the expense.schema -> ledger import
// edge (that cycle is real); Payment has no such edge, so it is imported directly.
const expenseModel = () => mongoose.model<ExpenseDoc>('Expense');

export const updateBalance = async (group: GroupHydrated) => {
  const expenses = await expenseModel().find({ group: group._id });
  const completedPayments = await Payment.find({ group: group._id, status: 'paid' });

  const balance: Record<string, { member: Types.ObjectId; amount: Decimal }> = {};
  const entryFor = (memberId: Types.ObjectId) => {
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
    const fromKey = from.toString();
    const toKey = to.toString();
    if (balance[fromKey]) {
      balance[fromKey].amount = balance[fromKey].amount.plus(amount);
    }

    if (balance[toKey]) {
      balance[toKey].amount = balance[toKey].amount.minus(amount);
    }
  });

  group.balance = Object.values(balance).map(({ member, amount }) => ({
    member,
    amount: toStoredAmount(amount),
  })) as typeof group.balance;
  await group.save();
  return group.balance;
};

export const generateDebts = async (group: GroupHydrated) => {
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

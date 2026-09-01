export const formatAmount = (amount: number) =>
    Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

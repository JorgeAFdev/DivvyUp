import { Decimal } from "decimal.js";

const CENT = new Decimal("0.01");

// An even split rarely divides into whole cents, so the shares are floored and
// the leftover cents are handed out one each, from the top of the list. Splitting
// with toFixed(2) instead left the group's balance off by those cents forever.
const splitEvenly = (participants: unknown[], totalAmount: number) => {
    const total = new Decimal(totalAmount);
    const share = total.dividedBy(participants.length).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const leftoverCents = total.minus(share.times(participants.length)).times(100).round().toNumber();

    return participants.map((member, index) => ({
        member,
        amountOwed: (index < leftoverCents ? share.plus(CENT) : share).toNumber(),
    }));
};

export { splitEvenly };

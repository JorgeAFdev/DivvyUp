import type { HydratedPayment } from '@monorepo/shared';
import ListSection from "../listSection/listSection";
import Debt from "./debt/debt";

const DebtsList = ({ groupDebts, groupId }: { groupDebts?: HydratedPayment[]; groupId: string }) => {
    return (
        <ListSection title="Debts">
            {groupDebts?.map((debt) => (
                <Debt key={debt._id} debt={debt} groupId={groupId} />
            ))}
        </ListSection>
    )
}

export default DebtsList;

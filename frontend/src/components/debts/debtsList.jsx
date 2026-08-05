import ListSection from "../listSection/listSection";
import Debt from "./debt/debt";

const DebtsList = ({ groupDebts, groupId }) => {
    return (
        <ListSection title="Debts">
            {groupDebts?.map((debt) => (
                <Debt key={debt._id} debt={debt} groupId={groupId} />
            ))}
        </ListSection>
    )
}

export default DebtsList;

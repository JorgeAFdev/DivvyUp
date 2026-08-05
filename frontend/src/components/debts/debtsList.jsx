import ListSection from "../listSection/listSection";
import Debt from "./debt/debt";

const DebtsList = ({ groupDebts, refreshGroupDetails }) => {
    return (
        <ListSection title="Debts" isEmpty={!groupDebts?.length}>
            {groupDebts?.map((debt) => (
                <Debt key={debt._id} debt={debt} refreshGroupDetails={refreshGroupDetails} />
            ))}
        </ListSection>
    )
}

export default DebtsList;

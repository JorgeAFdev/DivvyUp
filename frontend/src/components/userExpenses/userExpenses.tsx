import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserExpenses } from "../../hooks/useExpenses";
import ExpenseList from "../expense/expenseList/expenseList";
import { toast } from "react-toastify";
import { apiErrorMessage } from "../../utils/apiError";
import styles from './userExpenses.module.css';
import { Tooltip } from 'react-tooltip';


const UserExpenses = () => {
    const navigate = useNavigate();

    const { data, isLoading, isError, error } = useUserExpenses();

    useEffect(() => {
        if (isError) {
            toast.error(apiErrorMessage(error, 'Something went wrong'));
        }
    }, [isError, error]);

    if (isLoading) {
        return <div className={styles.text}>Loading your expenses...</div>;
    }

    if (data?.length === 0) {
        return <div className={styles.text}>You don't have any expenses</div>;
    }

    return (
        <div>
            {data?.map((group) => (
                <div key={group.groupId}>
                    <h2 className={styles.title} onClick={() => navigate(`/groups/${group.groupId}/expenses`)} data-tooltip-id={group.groupId}>{group.groupName}</h2>
                    <Tooltip id={group.groupId} content="Click to view group details" />
                    <ExpenseList groupExpenses={group.expenses} groupId={group.groupId} groupMembers={group.members} variant="grid" showTitle={false} />
                </div>
            ))}
        </div>
    );
};

export default UserExpenses;

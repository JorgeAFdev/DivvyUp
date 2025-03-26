import { useQuery, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/userContextAuth";
import { getAllUserExpenses } from "../../utils/expenseApi";
import ExpenseList from "../expense/expenseList/expenseList";
import { toast } from "react-toastify";
import styles from './userExpenses.module.css';
import { Tooltip } from 'react-tooltip';


const UserExpenses = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { token } = useAuth();

    const { data, isLoading, isError, error } = useQuery(['myExpenses'], () => getAllUserExpenses(token));

    if (isLoading) {
        return <div>Loading your expenses...</div>;
    }

    if (isError) {
        if (error.response.status === 404) {
            return <div>You don't have any expenses</div>;
        } else {
            toast.error(error?.response?.data.error || 'Something went wrong')
        }
    }

    const refreshExpenses = () => {
        queryClient.invalidateQueries(['myExpenses']);
    };

    return (
        <div>
            {data?.map((group) => (
                <div key={group.groupId}>
                    <h2 className={styles.title} onClick={() => navigate(`/groups/${group.groupId}/expenses`)} data-tooltip-id={group.groupId}>{group.groupName}</h2>
                    <Tooltip id={group.groupId} content="Click to view group details" />
                    <ExpenseList groupExpenses={group.expenses} refreshGroupDetails={refreshExpenses} className='list' title={false} />
                </div>
            ))}
        </div>
    );
};

export default UserExpenses;
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['myExpenses'],
        queryFn: () => getAllUserExpenses(token),
        retry: 0,
    });

    useEffect(() => {
        if (isError) {
            toast.error(error?.response?.data?.error || 'Something went wrong');
        }
    }, [isError, error]);

    if (isLoading) {
        return <div className={styles.text}>Loading your expenses...</div>;
    }

    if (data?.length === 0) {
        return <div className={styles.text}>You don't have any expenses</div>;
    }

    const refreshExpenses = () => {
        queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
    };

    return (
        <div>
            {data?.map((group) => (
                <div key={group.groupId}>
                    <h2 className={styles.title} onClick={() => navigate(`/groups/${group.groupId}/expenses`)} data-tooltip-id={group.groupId}>{group.groupName}</h2>
                    <Tooltip id={group.groupId} content="Click to view group details" />
                    <ExpenseList groupExpenses={group.expenses} groupId={group.groupId} groupMembers={group.members} refreshGroupDetails={refreshExpenses} variant="grid" showTitle={false} />
                </div>
            ))}
        </div>
    );
};

export default UserExpenses;
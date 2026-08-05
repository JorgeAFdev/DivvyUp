import ListSection from '../../listSection/listSection';
import styles from './expenseList.module.css'
import Expense from '../expense/expense';

const ExpenseList = ({ groupExpenses, groupId, groupMembers, refreshGroupDetails, variant = 'column', showTitle = true }) => {
    return (
        <ListSection
            title={showTitle ? 'Expenses' : undefined}
            isEmpty={!groupExpenses?.length}
            emptyMessage="There are no expenses in this group"
            listClassName={styles[variant]}
        >
            {groupExpenses?.map((item) => (
                <Expense key={item._id} expense={item} groupId={groupId} groupMembers={groupMembers} refreshGroupDetails={refreshGroupDetails} />
            ))}
        </ListSection>
    );
};

export default ExpenseList;

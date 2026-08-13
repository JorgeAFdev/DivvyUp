import type { HydratedExpense, Member } from '@monorepo/shared';
import ListSection from '../../listSection/listSection';
import styles from './expenseList.module.css'
import Expense from '../expense/expense';

const LAYOUTS = {
    column: styles.column,
    grid: styles.grid,
};

type LayoutVariant = keyof typeof LAYOUTS;

interface ExpenseListProps {
    groupExpenses?: HydratedExpense[];
    groupId: string;
    groupMembers: Member[];
    variant?: LayoutVariant;
    showTitle?: boolean;
}

const ExpenseList = ({ groupExpenses, groupId, groupMembers, variant = 'column', showTitle = true }: ExpenseListProps) => {
    return (
        <ListSection
            title={showTitle ? 'Expenses' : undefined}
            emptyMessage="There are no expenses in this group"
            listClassName={LAYOUTS[variant]}
        >
            {groupExpenses?.map((item) => (
                <Expense key={item._id} expense={item} groupId={groupId} groupMembers={groupMembers} />
            ))}
        </ListSection>
    );
};

export default ExpenseList;

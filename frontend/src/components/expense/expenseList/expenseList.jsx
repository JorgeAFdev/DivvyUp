import styles from './expenseList.module.css'
import Expense from '../expense/expense';

const ExpenseList = ({ groupExpenses, groupId, groupMembers, refreshGroupDetails, className, title = true }) => {

    return (
        <section className={styles.expenses}>
            <div>
                {groupExpenses?.length === 0 ? (<p className={styles.text} >There are no expenses in this group</p>) : (
                    <>
                        {title && <h2 className={styles.title}>Expenses</h2>}
                        <ul className={className ? [styles[className]] : styles.detailsList}>
                            {groupExpenses?.map((item) => (
                                <Expense key={item._id} expense={item} groupId={groupId} groupMembers={groupMembers} refreshGroupDetails={refreshGroupDetails} />
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </section>
    );
};

export default ExpenseList;
import styles from './expenseList.module.css'
import Expense from '../expense/expense';

const ExpenseList = ({ groupExpenses, refreshGroupDetails, className }) => {
    return (
        <section className={styles.expenses}>
            <div>
                {groupExpenses?.length === 0 ? (<p>There are no expenses in this group</p>) : (
                    <ul className={className ? [styles[className]] : styles.detailsList}>
                        {groupExpenses?.map((item) => (
                            <Expense key={item._id} expense={item} refreshGroupDetails={refreshGroupDetails} />
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default ExpenseList;
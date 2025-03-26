import styles from './expenseList.module.css'
import Expense from '../expense/expense';
import { useDarkMode } from '../../../context/darkModeContext';

const ExpenseList = ({ groupExpenses, refreshGroupDetails, className, title = true }) => {
    const { darkMode } = useDarkMode();

    return (
        <section className={styles.expenses}>
            <div>
                {groupExpenses?.length === 0 ? (<p className={darkMode ? styles.text : ''} >There are no expenses in this group</p>) : (
                    <>
                        {title && <h2 className={styles.title}>Expenses</h2>}
                        <ul className={className ? [styles[className]] : styles.detailsList}>
                            {groupExpenses?.map((item) => (
                                <Expense key={item._id} expense={item} refreshGroupDetails={refreshGroupDetails} />
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </section>
    );
};

export default ExpenseList;
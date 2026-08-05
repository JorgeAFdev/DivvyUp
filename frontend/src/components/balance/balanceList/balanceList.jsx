import Balance from "../balance/balance";
import ListSection from "../../listSection/listSection";
import styles from './balanceList.module.css';

const BalanceList = ({ groupBalance }) => {
    return (
        <ListSection
            title="Balance"
            isEmpty={!groupBalance?.length}
            className={styles.balanceList}
            listClassName={styles.balance}
        >
            {groupBalance?.map((item) => (
                <Balance balance={item} key={item.member?._id ?? item._id} />
            ))}
        </ListSection>
    )
}

export default BalanceList;

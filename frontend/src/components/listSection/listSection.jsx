import styles from './listSection.module.css';

const ListSection = ({ title, isEmpty, emptyMessage, listClassName, className, children }) => {
    if (isEmpty && !emptyMessage) return null;

    return (
        <section className={className}>
            {title && !isEmpty && <h2 className={styles.title}>{title}</h2>}
            {isEmpty ? (
                <p className={styles.empty}>{emptyMessage}</p>
            ) : (
                <ul className={[styles.list, listClassName].filter(Boolean).join(' ')}>
                    {children}
                </ul>
            )}
        </section>
    );
};

export default ListSection;

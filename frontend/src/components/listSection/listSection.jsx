import { Children } from 'react';
import styles from './listSection.module.css';

const ListSection = ({ title, emptyMessage, listClassName, className, children }) => {
    const isEmpty = Children.count(children) === 0;

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

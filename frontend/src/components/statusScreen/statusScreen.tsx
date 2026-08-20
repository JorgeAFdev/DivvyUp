import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import styles from './statusScreen.module.css';

interface StatusScreenProps {
    icon: IconType;
    title: string;
    text: string;
    children: ReactNode;
}

// The centered result landing shared by /email-verified, /email-change and the
// success/invalid-token states of the password flow. The CTA is an open slot
// (children), not a linkTo prop: each landing decides whether it navigates
// (a <Link>) or acts (a <button>).
const StatusScreen = ({ icon: Icon, title, text, children }: StatusScreenProps) => (
    <div className={styles.container}>
        <Icon className={styles.icon} aria-hidden />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        {children}
    </div>
);

export default StatusScreen;

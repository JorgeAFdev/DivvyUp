import { Link } from 'react-router-dom';
import styles from './header.module.css';

const HeaderLogo = () => (
    <Link to="/">
        <img src="/assets/logo.png" alt="Logo DivvyUp" className={styles.logo} />
    </Link>
);

export default HeaderLogo;

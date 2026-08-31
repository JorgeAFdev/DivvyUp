import MemberAvatar from '../../avatar/memberAvatar';
import { Vignette, VignetteLabel } from './vignette';
import styles from './vignettes.module.css';

// The hex is image content (what an uploaded avatar would carry), not a palette
// colour, so it does not belong in App.css.
const FAUX_PICTURE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%230b6ecf'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%23ffffff'/%3E%3Cpath d='M6 40c0-8 6.5-13 14-13s14 5 14 13z' fill='%23ffffff'/%3E%3C/svg%3E";

const MEMBERS = [
    { name: 'javier', picture: FAUX_PICTURE, status: 'joined' },
    { name: 'alex', picture: undefined, status: 'joined' },
    { name: 'marta', picture: undefined, status: 'no account' },
];

const MembersVignette = () => (
    <Vignette>
        <VignetteLabel>Members</VignetteLabel>
        <ul className={styles.members}>
            {MEMBERS.map(({ name, picture, status }) => (
                <li className={styles.member} key={name}>
                    <MemberAvatar name={name} src={picture} size={34} />
                    <span className={styles.memberName}>{name}</span>
                    <span className={styles.status}>{status}</span>
                </li>
            ))}
        </ul>
        <p className={styles.invite}>divvyup.jorgeaf.dev/join/8f3c1a…</p>
    </Vignette>
);

export default MembersVignette;

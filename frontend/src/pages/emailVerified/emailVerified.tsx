import { MdCheckCircleOutline } from 'react-icons/md';
import StatusScreen from '../../components/statusScreen/statusScreen';
import ButtonLink from '../../components/button/buttonLink';

const EmailVerified = () => (
    <StatusScreen
        icon={MdCheckCircleOutline}
        title="Email verified"
        text="Your email address has been confirmed."
    >
        <ButtonLink to="/groups">Go to your groups</ButtonLink>
    </StatusScreen>
);

export default EmailVerified;

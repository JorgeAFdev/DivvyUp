import { useMediaQuery } from '@mui/material';
import { useAuth } from '../../context/userContextAuth';
import GuestHeader from './guestHeader';
import DesktopHeader from './desktopHeader';
import MobileHeader from './mobileHeader';

export const MOBILE_QUERY = '(max-width: 767px)';

const Header = () => {
    const { token } = useAuth();
    const isMobile = useMediaQuery(MOBILE_QUERY);

    if (!token) return <GuestHeader />;

    return isMobile ? <MobileHeader /> : <DesktopHeader />;
};

export default Header;

import { useMediaQuery } from '@mui/material';
import { useAuth } from '../../context/userContextAuth';
import GuestHeader from './guestHeader';
import DesktopHeader from './desktopHeader';
import MobileHeader from './mobileHeader';

export const MOBILE_QUERY = '(max-width: 767px)';

const Header = () => {
    const { user, isPending } = useAuth();
    const isMobile = useMediaQuery(MOBILE_QUERY);

    // Wait for the session cookie check before choosing a header, so a logged-in
    // reload does not flash the guest header before the session resolves.
    if (isPending) return null;

    if (!user) return <GuestHeader />;

    return isMobile ? <MobileHeader /> : <DesktopHeader />;
};

export default Header;

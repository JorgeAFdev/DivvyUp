import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import type { IconType } from 'react-icons';
import Icon from '../icon/icon';

interface FabProps extends Omit<IconButtonProps, 'aria-label'> {
    icon: IconType;
    label: string;
}

const Fab = ({ icon, label, ...rest }: FabProps) => (
    <IconButton
        aria-label={label}
        {...rest}
        sx={{
            position: 'fixed',
            bottom: 15,
            right: 35,
            padding: 0,
            color: 'var(--primary-color-dark)',
            transition: 'color 300ms ease-in-out',
            '&:hover': { color: 'var(--primary-color)', backgroundColor: 'transparent' },
        }}
    >
        <Icon icon={icon} size={45} />
    </IconButton>
);

export default Fab;

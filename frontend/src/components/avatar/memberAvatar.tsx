import { Avatar, type AvatarProps } from '@mui/material';
import { initialsOf } from '../../utils/members';

interface MemberAvatarProps extends AvatarProps {
    name: string;
    src?: string;
    size?: number;
}

// Outlined and monochrome on purpose: the header next to it is text links and a
// stroked icon, and a filled disc breaks that. It also dodges the theme trap
// that a background colour falls into, since both surfaces are near white in
// light mode and near black in dark.
const MemberAvatar = ({ name, src, size, sx = {}, ...props }: MemberAvatarProps) => (
    <Avatar
        src={src || undefined}
        alt={name}
        sx={[
            {
                backgroundColor: 'transparent',
                color: 'text.primary',
                border: '1.5px solid',
                borderColor: 'text.primary',
                fontSize: '0.9rem',
            },
            size ? { width: size, height: size, fontSize: size / 2.5 } : {},
            ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...props}
    >
        {initialsOf(name)}
    </Avatar>
);

export default MemberAvatar;

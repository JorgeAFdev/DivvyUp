import IconButton from '@mui/material/IconButton';
import { IoCloseOutline } from 'react-icons/io5';

const CloseButton = ({ onClick }: { onClick: () => void }) => (
    <IconButton aria-label="Close" type="button" onClick={onClick} sx={{ padding: 0, color: 'text.primary' }}>
        <IoCloseOutline size={25} />
    </IconButton>
);

export default CloseButton;

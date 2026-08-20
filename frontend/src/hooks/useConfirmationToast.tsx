import { toast } from 'react-toastify';
import { Button, type ButtonProps } from '@mui/material';

const baseButtonSx = { borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' } as const;

interface ConfirmationToastOptions {
    message?: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmButtonProps?: ButtonProps;
    cancelButtonProps?: ButtonProps;
}

export const useConfirmationToast = () => {
    const showConfirmationToast = ({
        message = "Are you sure?",
        onConfirm,
        confirmText = "Confirm",
        cancelText = "Cancel",
        confirmButtonProps = {},
        cancelButtonProps = {}
    }: ConfirmationToastOptions) => {
        const { sx: confirmSx, ...confirmRest } = confirmButtonProps;
        const { sx: cancelSx, ...cancelRest } = cancelButtonProps;
        toast.info(
            <div>
                <p>{message}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => {
                            toast.dismiss();
                            onConfirm();
                        }}
                        {...confirmRest}
                        sx={[
                            {
                                backgroundColor: "var(--primary-color-strong)",
                                "&:hover": { backgroundColor: "var(--primary-color-strong-hover)" },
                                ...baseButtonSx,
                            },
                            ...(confirmSx ? (Array.isArray(confirmSx) ? confirmSx : [confirmSx]) : []),
                        ]}
                    >
                        {confirmText}
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => {
                            toast.dismiss();
                        }}
                        {...cancelRest}
                        sx={[
                            baseButtonSx,
                            ...(cancelSx ? (Array.isArray(cancelSx) ? cancelSx : [cancelSx]) : []),
                        ]}
                    >
                        {cancelText}
                    </Button>
                </div>
            </div>,
            {
                autoClose: false,
                closeOnClick: false,
                draggable: false,
                closeButton: true
            }
        );
    };

    return { showConfirmationToast };
};

import { toast } from 'react-toastify';
import { Button } from '@mui/material';

export const useConfirmationToast = () => {
    const showConfirmationToast = ({
        message = "Are you sure?",
        onConfirm,
        confirmText = "Confirm",
        cancelText = "Cancel",
        confirmButtonProps = {},
        cancelButtonProps = {}
    }) => {
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
                        {...confirmButtonProps}
                        sx={{
                            backgroundColor: "primary.dark",
                            borderRadius: "8px",
                            textTransform: "none",
                            fontWeight: "bold",
                            "&:hover": { backgroundColor: "primary.main" },
                            ...confirmButtonProps.sx
                        }}
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
                        {...cancelButtonProps}
                        sx={{
                            borderRadius: "8px",
                            textTransform: "none",
                            fontWeight: "bold",
                            ...cancelButtonProps.sx
                        }}
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
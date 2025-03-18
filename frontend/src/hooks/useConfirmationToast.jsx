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
                        sx={{
                            background: "#3c8ccd",
                            borderRadius: "8px",
                            textTransform: "none",
                            fontWeight: "bold",
                            "&:hover": { background: "#1e90ff" },
                            ...confirmButtonProps.sx
                        }}
                        {...confirmButtonProps}
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
                        sx={{
                            borderRadius: "8px",
                            textTransform: "none",
                            fontWeight: "bold",
                            ...cancelButtonProps.sx
                        }}
                        {...cancelButtonProps}
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
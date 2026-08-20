import { forwardRef, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import FormField, { type FormFieldProps } from './formField';

type PasswordInputProps = Omit<FormFieldProps, 'type' | 'trailing'>;

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
    const [visible, setVisible] = useState(false);

    return (
        <FormField
            {...props}
            ref={ref}
            type={visible ? 'text' : 'password'}
            trailing={
                <IconButton
                    type="button"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() => setVisible((shown) => !shown)}
                    sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', color: 'text.secondary' }}
                >
                    {visible ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
                </IconButton>
            }
        />
    );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgetPasswordSchema, type ForgetPasswordInput } from '@monorepo/validation';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MdMarkEmailRead } from 'react-icons/md';
import { useForgetPassword } from '../../hooks/useSession';
import { apiErrorMessage } from '../../utils/apiError';
import styles from '../../components/auth/authForm.module.css';
import Button from '../../components/button/button';
import ButtonLink from '../../components/button/buttonLink';
import FormField from '../../components/formField/formField';
import StatusScreen from '../../components/statusScreen/statusScreen';

const ForgotPassword = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<ForgetPasswordInput>({
        resolver: zodResolver(forgetPasswordSchema),
    });
    const [sent, setSent] = useState(false);
    const forgetPassword = useForgetPassword();

    const onSubmit = ({ email }: ForgetPasswordInput) => {
        forgetPassword.mutate(email, {
            onSuccess: () => setSent(true),
            onError: (error) => {
                toast.error(apiErrorMessage(error, 'Could not send the reset link. Please try again.'));
            },
        });
    };

    // Same confirmation whether or not the address has an account: the request
    // answer never reveals which, so account enumeration stays shut.
    if (sent) {
        return (
            <StatusScreen
                icon={MdMarkEmailRead}
                title="Check your inbox"
                text="If that address has a DivvyUp account, we sent it a link to reset your password."
            >
                <ButtonLink to="/login">Back to login</ButtonLink>
            </StatusScreen>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.container}>
            <h2 className={styles.title}>Reset your password</h2>
            <p className={styles.subtitle}>Enter your email and we will send you a link to choose a new password.</p>

            <FormField
                id="forgot-email"
                label="Email"
                placeholder="Email"
                error={errors.email}
                {...register('email')}
            />

            <Button type="submit" className={styles.submit} loading={forgetPassword.isPending}>Send reset link</Button>

            <p className={styles.switch}>
                Remembered it? <Link to="/login">Back to login</Link>
            </p>
        </form>
    );
};

export default ForgotPassword;

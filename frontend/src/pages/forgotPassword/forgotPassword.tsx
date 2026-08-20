import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgetPasswordSchema, type ForgetPasswordInput } from '@monorepo/validation';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MdMarkEmailRead } from 'react-icons/md';
import { useForgetPassword } from '../../hooks/useSession';
import { apiErrorMessage } from '../../utils/apiError';
import styles from './forgotPassword.module.css';
import landing from '../emailVerified/emailVerified.module.css';
import Button from '../../components/button/button';
import ButtonLink from '../../components/button/buttonLink';

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
            <div className={landing.container}>
                <MdMarkEmailRead className={landing.icon} aria-hidden />
                <h1 className={landing.title}>Check your inbox</h1>
                <p className={landing.text}>
                    If that address has a DivvyUp account, we sent it a link to reset your password.
                </p>
                <ButtonLink to="/login">Back to login</ButtonLink>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.container}>
            <h2 className={styles.title}>Reset your password</h2>
            <p className={styles.subtitle}>Enter your email and we will send you a link to choose a new password.</p>

            <label htmlFor="forgot-email" className={styles.label}>Email</label>
            <input
                id="forgot-email"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                {...register('email')}
                placeholder="Email"
                className={styles.input}
            />
            {errors.email && <p id="forgot-email-error" className={styles.error}>{errors.email.message}</p>}

            <Button type="submit" className={styles.submit} loading={forgetPassword.isPending}>Send reset link</Button>

            <p className={styles.switch}>
                Remembered it? <Link to="/login">Back to login</Link>
            </p>
        </form>
    );
};

export default ForgotPassword;

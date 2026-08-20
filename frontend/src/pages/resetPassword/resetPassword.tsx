import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPasswordSchema } from '@monorepo/validation';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MdErrorOutline } from 'react-icons/md';
import { useResetPassword } from '../../hooks/useSession';
import { apiErrorMessage } from '../../utils/apiError';
import { PASSWORD_HINT, CONFIRM_PASSWORD_MISMATCH } from '../../utils/validation';
import styles from './resetPassword.module.css';
import landing from '../emailVerified/emailVerified.module.css';
import Button from '../../components/button/button';
import ButtonLink from '../../components/button/buttonLink';

// confirmPassword is a client-only field (Better Auth never receives it), so the
// base contract schema is extended locally to keep the resolver from stripping it.
const resetFormSchema = resetPasswordSchema
    .extend({ confirmPassword: z.string() })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: CONFIRM_PASSWORD_MISMATCH,
        path: ['confirmPassword'],
    });

type ResetFormValues = z.infer<typeof resetFormSchema>;

const ResetPassword = () => {
    const [params] = useSearchParams();
    const token = params.get('token');
    const navigate = useNavigate();
    const resetPassword = useResetPassword();

    const { register, handleSubmit, formState: { errors } } = useForm<ResetFormValues>({
        resolver: zodResolver(resetFormSchema),
    });

    if (!token) {
        return (
            <div className={landing.container}>
                <MdErrorOutline className={landing.icon} aria-hidden />
                <h1 className={landing.title}>Invalid reset link</h1>
                <p className={landing.text}>This link is missing or has expired. Request a new one to continue.</p>
                <ButtonLink to="/forgot-password">Request a new link</ButtonLink>
            </div>
        );
    }

    const onSubmit = ({ newPassword }: ResetFormValues) => {
        resetPassword.mutate(
            { newPassword, token },
            {
                onSuccess: () => {
                    toast.success('Password updated. Please log in.');
                    navigate('/login');
                },
                onError: (error) => {
                    toast.error(apiErrorMessage(error, 'Could not reset your password. The link may have expired.'));
                },
            },
        );
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.container}>
            <h2 className={styles.title}>Choose a new password</h2>

            <label htmlFor="reset-password" className={styles.label}>New password</label>
            <input
                id="reset-password"
                type="password"
                placeholder="********"
                aria-invalid={errors.newPassword ? 'true' : 'false'}
                aria-describedby={
                    errors.newPassword ? 'reset-password-hint reset-password-error' : 'reset-password-hint'
                }
                {...register('newPassword')}
                className={styles.input}
            />
            <p id="reset-password-hint" className={styles.hint}>{PASSWORD_HINT}</p>
            {errors.newPassword && <p id="reset-password-error" className={styles.error}>{errors.newPassword.message}</p>}

            <label htmlFor="reset-confirm" className={styles.label}>Confirm password</label>
            <input
                id="reset-confirm"
                type="password"
                placeholder="********"
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
                {...register('confirmPassword')}
                className={styles.input}
            />
            {errors.confirmPassword && <p id="reset-confirm-error" className={styles.error}>{errors.confirmPassword.message}</p>}

            <Button type="submit" className={styles.submit} loading={resetPassword.isPending}>Reset password</Button>

            <p className={styles.switch}>
                <Link to="/login">Back to login</Link>
            </p>
        </form>
    );
};

export default ResetPassword;

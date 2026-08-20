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
import styles from '../../components/auth/authForm.module.css';
import Button from '../../components/button/button';
import ButtonLink from '../../components/button/buttonLink';
import PasswordInput from '../../components/formField/passwordInput';
import StatusScreen from '../../components/statusScreen/statusScreen';

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
            <StatusScreen
                icon={MdErrorOutline}
                title="Invalid reset link"
                text="This link is missing or has expired. Request a new one to continue."
            >
                <ButtonLink to="/forgot-password">Request a new link</ButtonLink>
            </StatusScreen>
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

            <PasswordInput
                id="reset-password"
                label="New password"
                placeholder="********"
                hint={PASSWORD_HINT}
                error={errors.newPassword}
                {...register('newPassword')}
            />

            <PasswordInput
                id="reset-confirm"
                label="Confirm password"
                placeholder="********"
                error={errors.confirmPassword}
                {...register('confirmPassword')}
            />

            <Button type="submit" className={styles.submit} loading={resetPassword.isPending}>Reset password</Button>

            <p className={styles.switch}>
                <Link to="/login">Back to login</Link>
            </p>
        </form>
    );
};

export default ResetPassword;

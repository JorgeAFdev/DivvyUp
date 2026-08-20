import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registerSchema } from '@monorepo/validation';
import styles from './registerForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegister } from '../../hooks/useSession';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { apiErrorMessage } from '../../utils/apiError';
import { PASSWORD_HINT, CONFIRM_PASSWORD_MISMATCH } from '../../utils/validation';
import SocialAuth from '../auth/socialAuth';

// confirmPassword is a client-only field (Better Auth never receives it), so the
// shared contract schema is extended locally to keep the resolver from stripping it.
const registerFormSchema = registerSchema
    .extend({ confirmPassword: z.string() })
    .refine((data) => data.password === data.confirmPassword, {
        message: CONFIRM_PASSWORD_MISMATCH,
        path: ['confirmPassword'],
    });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

const RegisterForm = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerFormSchema),
    });

    const navigate = useNavigate();
    const { search } = useLocation();
    const mutation = useRegister();

    const onSubmit = ({ confirmPassword: _confirmPassword, ...credentials }: RegisterFormValues) => {
        mutation.mutate(credentials, {
            onSuccess: () => {
                navigate(nextDestination(search));
            },
            onError: (error) => {
                toast.error(apiErrorMessage(error, 'Registration failed. Please try again.'));
            },
        });
    };

    return (
        <form className={styles.registerContainer} onSubmit={handleSubmit(onSubmit)}>
            <h2 className={styles.registerTitle}>Register</h2>

            <SocialAuth />

            <label className={styles.registerLabel} htmlFor="register-name">
                Name
            </label>

            <input
                id="register-name"
                className={styles.registerInput}
                type="text"
                placeholder="Enter your name.."
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'register-name-error' : undefined}
                {...register('name')}
            />
            {errors.name && <p id="register-name-error" className={styles.registerErrorMessage}>{errors.name.message}</p>}

            <label
                className={styles.registerLabel} htmlFor="register-email">
                Email
            </label>

            <input
                id="register-email"
                className={styles.registerInput}
                type="text"
                placeholder="example@example.com"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
                {...register('email')}
            />
            {errors.email && <p id="register-email-error" className={styles.registerErrorMessage}>{errors.email.message}</p>}

            <label
                className={styles.registerLabel} htmlFor="register-password">
                Password
            </label>

            <input
                id="register-password"
                className={styles.registerInput}
                type="password"
                placeholder="********"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={
                    errors.password ? 'register-password-hint register-password-error' : 'register-password-hint'
                }
                {...register('password')}
            />
            <p id="register-password-hint" className={styles.registerHint}>
                {PASSWORD_HINT}
            </p>
            {errors.password && <p id="register-password-error" className={styles.registerErrorMessage}>{errors.password.message}</p>}

            <label
                className={styles.registerLabel} htmlFor="register-confirm-password">
                Confirm password
            </label>

            <input
                id="register-confirm-password"
                className={styles.registerInput}
                type="password"
                placeholder="********"
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={errors.confirmPassword ? 'register-confirm-password-error' : undefined}
                {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p id="register-confirm-password-error" className={styles.registerErrorMessage}>{errors.confirmPassword.message}</p>}

            <button type="submit" className={styles.registerSubmitButton} disabled={mutation.isPending}>Register</button>

            <p className={styles.registerSwitch}>
                Already have an account? <Link to={`/login${search}`}>Login</Link>
            </p>
        </form>
    );
};

export default RegisterForm;

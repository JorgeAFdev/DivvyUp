import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registerSchema } from '@monorepo/validation';
import styles from '../auth/authForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegister } from '../../hooks/useSession';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { apiErrorMessage } from '../../utils/apiError';
import { PASSWORD_HINT, CONFIRM_PASSWORD_MISMATCH } from '../../utils/validation';
import SocialAuth from '../auth/socialAuth';
import Button from '../button/button';
import FormField from '../formField/formField';
import PasswordInput from '../formField/passwordInput';

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
        <form className={styles.container} onSubmit={handleSubmit(onSubmit)}>
            <h2 className={styles.title}>Register</h2>

            <SocialAuth />

            <FormField
                id="register-name"
                label="Name"
                placeholder="Enter your name.."
                error={errors.name}
                {...register('name')}
            />

            <FormField
                id="register-email"
                label="Email"
                placeholder="example@example.com"
                error={errors.email}
                {...register('email')}
            />

            <PasswordInput
                id="register-password"
                label="Password"
                placeholder="********"
                hint={PASSWORD_HINT}
                error={errors.password}
                {...register('password')}
            />

            <PasswordInput
                id="register-confirm-password"
                label="Confirm password"
                placeholder="********"
                error={errors.confirmPassword}
                {...register('confirmPassword')}
            />

            <Button type="submit" className={styles.submit} loading={mutation.isPending}>Register</Button>

            <p className={styles.switch}>
                Already have an account? <Link to={`/login${search}`}>Login</Link>
            </p>
        </form>
    );
};

export default RegisterForm;

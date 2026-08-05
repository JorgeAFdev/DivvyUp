import { useForm } from 'react-hook-form';
import styles from './registerForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegister } from '../../hooks/useSession';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { PASSWORD_HINT, PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../../utils/validation';

const RegisterForm = () => {
    const { register, handleSubmit, watch, formState: { errors } } = useForm();

    const navigate = useNavigate();
    const { search } = useLocation();
    const mutation = useRegister();

    const onSubmit = (data) => {
        mutation.mutate(
            { ...data, profilePicture: data.profilePicture?.[0] },
            {
                onSuccess: () => {
                    toast.success('Registration successful 🎉');
                    navigate(nextDestination(search));
                },
                onError: (error) => {
                    toast.error(error.response?.data?.error || 'Registration failed. Please try again.');
                },
            },
        );
    };

    const profilePicture = watch('profilePicture');

    return (
        <form className={styles.registerContainer} onSubmit={handleSubmit(onSubmit)}>
            <h2 className={styles.registerTitle}>Register</h2>

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
                {...register('name', {
                    required: 'Name is required',
                    maxLength: { value: 20, message: 'Name is too long' },
                })}
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
                {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' },
                })}
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
                {...register('password', {
                    required: 'Password is required',
                    pattern: { value: PASSWORD_PATTERN, message: PASSWORD_MESSAGE },
                })}
            />
            <p id="register-password-hint" className={styles.registerHint}>
                {PASSWORD_HINT}
            </p>
            {errors.password && <p id="register-password-error" className={styles.registerErrorMessage}>{errors.password.message}</p>}

            <label className={styles.registerLabel} htmlFor="register-profile-picture">
                Profile Picture <span className={styles.registerOptional}>(optional)</span>
            </label>

            <input
                id="register-profile-picture"
                className={styles.registerInputFile}
                type="file"
                aria-invalid={errors.profilePicture ? 'true' : 'false'}
                aria-describedby={errors.profilePicture ? 'register-profile-picture-error' : undefined}
                {...register('profilePicture')}
            />
            {errors.profilePicture && <p id="register-profile-picture-error" className={styles.registerErrorMessage}>{errors.profilePicture.message}</p>}

            <button type="submit" className={styles.registerSubmitButton} disabled={mutation.isPending}>Register</button>

            <p className={styles.registerSwitch}>
                Already have an account? <Link to={`/login${search}`}>Login</Link>
            </p>

            <p>
                {profilePicture?.[0] ? (
                    <img className={styles.registerPreviewImage} src={URL.createObjectURL(profilePicture[0])} alt="Preview" />
                ) : (
                    ''
                )}
            </p>
        </form>
    );
};

export default RegisterForm;

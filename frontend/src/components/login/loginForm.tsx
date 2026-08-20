import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@monorepo/validation';
import styles from '../auth/authForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLogin, type LoginCredentials } from '../../hooks/useSession';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { apiErrorMessage } from '../../utils/apiError';
import SocialAuth from '../auth/socialAuth';
import Button from '../button/button';


const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
  });
  const navigate = useNavigate();
  const { search } = useLocation();

  const login = useLogin();

  const onSubmit = (data: LoginCredentials) => {
    login.mutate(data, {
      onSuccess: () => {
        navigate(nextDestination(search));
      },
      onError: (error) => {
        toast.error(apiErrorMessage(error, 'Login failed. Please try again.'));
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.container} >
      <h2 className={styles.title}>Login</h2>

      <SocialAuth />

      <label htmlFor="email" className={styles.label}>Email</label>
      <input
        id="email"
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'login-email-error' : undefined}
        {...register('email')}
        placeholder="Email"
        className={styles.input}
      />
      {errors.email && <p id="login-email-error" className={styles.error}>{errors.email.message}</p>}

      <label htmlFor="password" className={styles.label}>Password</label>
      <input
        id="password"
        aria-invalid={errors.password ? 'true' : 'false'}
        aria-describedby={errors.password ? 'login-password-error' : undefined}
        {...register('password')}
        placeholder="Password"
        type="password"
        className={styles.input}
      />
      {errors.password && <p id="login-password-error" className={styles.error}>{errors.password.message}</p>}

      <Link to="/forgot-password" className={styles.forgot}>Forgot password?</Link>

      <Button type="submit" className={styles.submit} loading={login.isPending}>Login</Button>

      <p className={styles.switch}>
        No account yet? <Link to={`/register${search}`}>Register</Link>
      </p>
    </form>
  );
};

export default Login;

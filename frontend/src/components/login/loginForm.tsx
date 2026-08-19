import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@monorepo/validation';
import styles from './loginForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLogin, type LoginCredentials } from '../../hooks/useSession';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { apiErrorMessage } from '../../utils/apiError';
import SocialAuth from '../auth/socialAuth';


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
    <form onSubmit={handleSubmit(onSubmit)} className={styles.loginContainer} >
      <h2 className={styles.loginTitle}>Login</h2>

      <SocialAuth />

      <label htmlFor="email" className={styles.loginLabel}>Email</label>
      <input
        id="email"
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'login-email-error' : undefined}
        {...register('email')}
        placeholder="Email"
        className={styles.loginInput}
      />
      {errors.email && <p id="login-email-error" className={styles.loginError}>{errors.email.message}</p>}

      <label htmlFor="password" className={styles.loginLabel}>Password</label>
      <input
        id="password"
        aria-invalid={errors.password ? 'true' : 'false'}
        aria-describedby={errors.password ? 'login-password-error' : undefined}
        {...register('password')}
        placeholder="Password"
        type="password"
        className={styles.loginInput}
      />
      {errors.password && <p id="login-password-error" className={styles.loginError}>{errors.password.message}</p>}

      <button type="submit" className={styles.loginSubmitBtn} disabled={login.isPending}>Login</button>

      <p className={styles.loginSwitch}>
        No account yet? <Link to={`/register${search}`}>Register</Link>
      </p>
    </form>
  );
};

export default Login;

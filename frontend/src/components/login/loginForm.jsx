import { useForm } from 'react-hook-form';
import api from '../../utils/axios';
import { setStorageObject } from '../../utils/localStorage';
import styles from './loginForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/userContextAuth';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../../utils/validation';


const Login = ({ forceUpdate }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();

  const onSubmit = async (data) => {
    try {
      const response = await api.post('/auth/login', data);

      if (response?.data.token) {
        login(response.data);
        toast.success('Login successfully 🎉');
        navigate(nextDestination(search));
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.loginContainer} >
      <h2 className={styles.loginTitle}>Login</h2>

      <label htmlFor="email" className={styles.loginLabel}>Email</label>
      <input
        id="email"
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'login-email-error' : undefined}
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' }
        })}
        placeholder="Email"
        className={styles.loginInput}
      />
      {errors.email && <p id="login-email-error" className={styles.loginError}>{errors.email.message}</p>}

      <label htmlFor="password" className={styles.loginLabel}>Password</label>
      <input
        id="password"
        aria-invalid={errors.password ? 'true' : 'false'}
        aria-describedby={errors.password ? 'login-password-error' : undefined}
        {...register('password', {
          required: 'Password is required',
          pattern: { value: PASSWORD_PATTERN, message: PASSWORD_MESSAGE }
        })}
        placeholder="Password"
        type="password"
        className={styles.loginInput}
      />
      {errors.password && <p id="login-password-error" className={styles.loginError}>{errors.password.message}</p>}

      <button type="submit" className={styles.loginSubmitBtn}>Login</button>

      <p className={styles.loginSwitch}>
        No account yet? <Link to={`/register${search}`}>Register</Link>
      </p>
    </form>
  );
};

export default Login;

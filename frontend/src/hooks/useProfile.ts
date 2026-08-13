import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { updateUser, type UpdateProfileInput } from '../utils/userApi';

export const useUpdateProfile = () => {
    const { token } = useAuth();

    return useMutation({
        mutationFn: (data: UpdateProfileInput) => updateUser(data, token),
    });
};

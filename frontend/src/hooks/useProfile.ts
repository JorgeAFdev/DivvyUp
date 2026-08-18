import { useMutation } from '@tanstack/react-query';
import { updateUser, type UpdateProfileInput } from '../utils/userApi';

export const useUpdateProfile = () =>
    useMutation({
        mutationFn: (data: UpdateProfileInput) => updateUser(data),
    });

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import {
    createGroup,
    deleteGroup,
    getGroupByUserId,
    regenerateInviteCode,
    updateGroup,
    type GroupInput,
} from '../utils/groupApi';
import { queryKeys } from './queryKeys';

export const useGroups = () => {
    const { token } = useAuth();

    return useQuery({
        queryKey: queryKeys.groups(),
        queryFn: () => getGroupByUserId(token),
        enabled: Boolean(token),
    });
};

export const useCreateGroup = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: GroupInput) => createGroup(data, token),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
    });
};

export const useUpdateGroup = (groupId: string) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: GroupInput) => updateGroup(groupId, data, token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.groups() });
            queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails(groupId) });
        },
    });
};

export const useDeleteGroup = (groupId: string) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => deleteGroup(groupId, token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.groups() });
            queryClient.removeQueries({ queryKey: queryKeys.groupDetails(groupId) });
        },
    });
};

export const useRegenerateInviteCode = (groupId: string) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => regenerateInviteCode(groupId, token),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
    });
};

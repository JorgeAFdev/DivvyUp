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
    const { user } = useAuth();

    return useQuery({
        queryKey: queryKeys.groups(),
        queryFn: () => getGroupByUserId(),
        enabled: Boolean(user),
    });
};

export const useCreateGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: GroupInput) => createGroup(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
    });
};

export const useUpdateGroup = (groupId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: GroupInput) => updateGroup(groupId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.groups() });
            queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails(groupId) });
        },
    });
};

export const useDeleteGroup = (groupId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => deleteGroup(groupId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.groups() });
            queryClient.removeQueries({ queryKey: queryKeys.groupDetails(groupId) });
        },
    });
};

export const useRegenerateInviteCode = (groupId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => regenerateInviteCode(groupId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
    });
};

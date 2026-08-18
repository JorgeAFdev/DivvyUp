import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import {
    createGroupExpense,
    deleteGroupExpense,
    getAllUserExpenses,
    updateGroupExpense,
    type ExpenseInput,
} from '../utils/expenseApi';
import { queryKeys } from './queryKeys';

// An expense moves the group balance and the debts derived from it, and it also
// shows up in /my-expenses, so every mutation drops both caches.
const useInvalidateExpenses = (groupId: string) => {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.userExpenses() });
    };
};

export const useUserExpenses = () => {
    const { user } = useAuth();

    return useQuery({
        queryKey: queryKeys.userExpenses(),
        queryFn: () => getAllUserExpenses(),
        retry: 0,
        enabled: Boolean(user),
    });
};

export const useCreateExpense = (groupId: string) => {
    const invalidate = useInvalidateExpenses(groupId);

    return useMutation({
        mutationFn: (data: ExpenseInput) => createGroupExpense(groupId, data),
        onSuccess: invalidate,
    });
};

export const useUpdateExpense = (groupId: string, expenseId: string) => {
    const invalidate = useInvalidateExpenses(groupId);

    return useMutation({
        mutationFn: (data: ExpenseInput) => updateGroupExpense(groupId, expenseId, data),
        onSuccess: invalidate,
    });
};

export const useDeleteExpense = (groupId: string, expenseId: string) => {
    const invalidate = useInvalidateExpenses(groupId);

    return useMutation({
        mutationFn: () => deleteGroupExpense(groupId, expenseId),
        onSuccess: invalidate,
    });
};

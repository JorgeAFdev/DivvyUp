import { authHeaders } from "./authHeaders";
import api from "./axios";

export const getAllUserExpenses = async (token) => {
  const response = await api.get(`/user/expenses`, authHeaders(token));
  return response.data;
};

export const getAllGroupExpensesById = async (groupId, token) => {
  const response = await api.get(`/group/${groupId}/expenses`, authHeaders(token));
  return response.data;
};

export const createGroupExpense = async (groupId, data, token) => {
  const response = await api.post(`/group/${groupId}/expenses`, data, authHeaders(token));
  return response.data;
};

export const updateGroupExpense = async (groupId, expenseId, data, token) => {
  const response = await api.patch(`/group/${groupId}/expenses/${expenseId}`, data, authHeaders(token));
  return response.data;
};

export const deleteGroupExpense = async (groupId, expenseId, token) => {
  const response = await api.delete(`/group/${groupId}/expenses/${expenseId}`, authHeaders(token));
  return response.data;
};

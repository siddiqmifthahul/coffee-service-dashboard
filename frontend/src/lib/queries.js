import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';

const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);

export const useProducts = (includeInactive = false) =>
  useQuery({
    queryKey: ['products', includeInactive],
    queryFn: () => get('/products', { includeInactive }).then((d) => d.products),
    staleTime: 5 * 60_000,
  });

export const useDaily = (date) =>
  useQuery({ queryKey: ['daily', date], queryFn: () => get('/reports/daily', { date }), placeholderData: keepPreviousData });

export const useSummary = ({ from, to, groupBy }) =>
  useQuery({
    queryKey: ['summary', from, to, groupBy],
    queryFn: () => get('/reports/summary', { from, to, groupBy }),
    placeholderData: keepPreviousData,
  });

export const useTransactions = (params) =>
  useQuery({
    queryKey: ['transactions', params],
    queryFn: () => get('/transactions', params),
    placeholderData: keepPreviousData,
  });

export const useCashEntries = (params) =>
  useQuery({ queryKey: ['cash', params], queryFn: () => get('/cash-entries', params).then((d) => d.entries) });

export const useCashCategories = () =>
  useQuery({
    queryKey: ['cash-categories'],
    queryFn: () => get('/cash-entries/categories').then((d) => d.categories),
    staleTime: Infinity,
  });

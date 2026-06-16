import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";
import { transferKeys } from "@/hooks/use-transfers";

export const accountKeys = {
  byGroup: (groupId: string, status?: string) =>
    status ? (["accounts", groupId, status] as const) : (["accounts", groupId] as const),
};

export function useAccountList(groupId: string, status?: string, opts?: { enabled?: boolean }) {
  const params = new URLSearchParams({ groupId });
  if (status) params.set("status", status);
  return useQuery({
    queryKey: accountKeys.byGroup(groupId, status),
    queryFn: () => apiFetch(`/api/accounts?${params}`),
    enabled: (opts?.enabled ?? true) && !!groupId,
  });
}

export function useCreateAccount(
  groupId: string,
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => jsonPost("/api/accounts", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: accountKeys.byGroup(groupId) });
      await qc.invalidateQueries({ queryKey: transferKeys.all(groupId) });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useMarkAccountPaid(
  groupId: string,
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/accounts/${id}/mark-paid`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: accountKeys.byGroup(groupId) });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useUnmarkAccountPaid(
  groupId: string,
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/accounts/${id}/unmark-paid`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: accountKeys.byGroup(groupId) });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useDeleteAccount(
  groupId: string,
  opts?: Pick<
    UseMutationOptions<unknown, Error, { id: string; force?: boolean }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      apiFetch(`/api/accounts/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: accountKeys.byGroup(groupId) });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useDeferAccount(
  groupId: string,
  opts?: Pick<
    UseMutationOptions<unknown, Error, { id: string; targetMonth: Date }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetMonth }: { id: string; targetMonth: Date }) =>
      jsonPost(`/api/accounts/${id}/defer`, { targetMonth }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: accountKeys.byGroup(groupId) });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useUpdateAccount(
  groupId: string,
  opts?: Pick<
    UseMutationOptions<unknown, Error, { id: string; data: unknown }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      apiFetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: accountKeys.byGroup(groupId) });
      await qc.invalidateQueries({ queryKey: transferKeys.all(groupId) });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

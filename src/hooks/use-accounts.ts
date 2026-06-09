import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

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
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => jsonPost("/api/accounts", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useMarkAccountPaid(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/accounts/${id}/mark-paid`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useDeleteAccount(
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
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useDeferAccount(
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
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

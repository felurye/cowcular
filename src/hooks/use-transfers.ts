import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export const transferKeys = {
  all: (groupId?: string) =>
    groupId ? (["transfers", groupId] as const) : (["transfers"] as const),
};

export function useTransferList(groupId?: string, opts?: { refetchInterval?: number }) {
  const params = groupId ? `?groupId=${groupId}` : "";
  return useQuery({
    queryKey: transferKeys.all(groupId),
    queryFn: () => apiFetch(`/api/transfers${params}`),
    refetchInterval: opts?.refetchInterval,
  });
}

export function useMarkTransferPaid(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/transfers/${id}/mark-paid`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useConfirmTransfer(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/transfers/${id}/confirm`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

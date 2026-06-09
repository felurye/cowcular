import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export function useBalanceList(groupId: string) {
  return useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => apiFetch(`/api/balances?groupId=${groupId}`),
    enabled: !!groupId,
  });
}

export function useCloseBalance(
  opts?: Pick<
    UseMutationOptions<unknown, Error, { groupId: string; month: number; year: number }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { groupId: string; month: number; year: number }) =>
      jsonPost("/api/balances/close", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["balances"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export type BalancePreview = {
  totalExpense: number;
  totalIncome: number;
  byMember: {
    memberId: string;
    name: string;
    userId: string | null;
    balance: number;
  }[];
  netTransfers: {
    fromMemberId: string;
    fromName: string;
    fromUserId: string | null;
    toMemberId: string;
    toName: string;
    toUserId: string | null;
    amount: number;
  }[];
};

export function useBalancePreview(groupId: string, month?: number, year?: number) {
  const params = new URLSearchParams({ groupId });
  if (month !== undefined) params.set("month", String(month));
  if (year !== undefined) params.set("year", String(year));
  return useQuery<BalancePreview>({
    queryKey: ["balances", "preview", groupId, month, year],
    queryFn: () => apiFetch<BalancePreview>(`/api/balances/preview?${params}`),
    enabled: !!groupId,
  });
}

export function useBalanceList(groupId: string) {
  return useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => apiFetch<unknown[]>(`/api/balances?groupId=${groupId}`),
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

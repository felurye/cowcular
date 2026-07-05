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
  byCategory: {
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    totalExpense: number;
  }[];
  netTransfers: PreviewNetTransfer[];
  settlement: {
    id: string;
    createdAt: string;
    totalAmount: number;
    netTransfers: PreviewNetTransfer[];
    settledBy: { id: string; name: string } | null;
  } | null;
};

export type PreviewNetTransfer = {
  fromMemberId: string;
  fromName: string;
  fromUserId: string | null;
  toMemberId: string;
  toName: string;
  toUserId: string | null;
  amount: number;
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

export function useSettleBalance(
  opts?: Pick<
    UseMutationOptions<unknown, Error, { groupId: string; month?: number; year?: number }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { groupId: string; month?: number; year?: number }) =>
      jsonPost("/api/balances/settle", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["balances"] });
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useRevertSettlement(
  opts?: Pick<
    UseMutationOptions<unknown, Error, { groupId: string; month?: number; year?: number }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { groupId: string; month?: number; year?: number }) =>
      jsonPost("/api/balances/settle/revert", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["balances"] });
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
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

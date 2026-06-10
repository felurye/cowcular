import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export interface CategoryBudget {
  id: string;
  category_id: string;
  month: number;
  year: number;
  limit_amount: number;
}

export function useCategoryBudgets(groupId: string, month: number, year: number) {
  return useQuery({
    queryKey: ["category-budgets", groupId, month, year],
    queryFn: () =>
      apiFetch<CategoryBudget[]>(
        `/api/category-budgets?groupId=${groupId}&month=${month}&year=${year}`,
      ),
    enabled: !!groupId,
  });
}

export function useCreateCategoryBudget(
  opts?: Pick<
    UseMutationOptions<
      CategoryBudget,
      Error,
      { groupId: string; categoryId: string; month: number; year: number; limitAmount: number }
    >,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      groupId: string;
      categoryId: string;
      month: number;
      year: number;
      limitAmount: number;
    }) => jsonPost<CategoryBudget>("/api/category-budgets", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["category-budgets"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useUpdateCategoryBudget(
  opts?: Pick<
    UseMutationOptions<CategoryBudget, Error, { id: string; limitAmount: number }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, limitAmount }: { id: string; limitAmount: number }) =>
      apiFetch<CategoryBudget>(`/api/category-budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limitAmount }),
      }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["category-budgets"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useDeleteCategoryBudget(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch(`/api/category-budgets/${id}`, { method: "DELETE" }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["category-budgets"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

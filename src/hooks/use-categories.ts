import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export interface CategoryItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
}

export function useCategoryList(groupId: string) {
  return useQuery({
    queryKey: ["categories", groupId],
    queryFn: () => apiFetch<CategoryItem[]>(`/api/categories?groupId=${groupId}`),
    staleTime: 5 * 60_000,
    enabled: !!groupId,
  });
}

export function useCreateCategory(
  opts?: Pick<
    UseMutationOptions<CategoryItem, Error, { name: string; icon?: string; groupId: string }>,
    "onSuccess" | "onError"
  >,
) {
  const qc = useQueryClient();
  return useMutation<CategoryItem, Error, { name: string; icon?: string; groupId: string }>({
    mutationFn: (data) => jsonPost<CategoryItem>("/api/categories", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useDeleteCategory(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiFetch(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

export function useCategoryList() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/api/categories"),
    staleTime: 5 * 60_000,
  });
}

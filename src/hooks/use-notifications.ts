import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export function useNotificationList(opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    refetchInterval: opts?.refetchInterval,
  });
}

export function useMarkNotificationRead(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/notifications/${id}/read`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useMarkAllNotificationsRead(
  opts?: Pick<UseMutationOptions<unknown, Error, void>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jsonPost("/api/notifications/mark-all-read", {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

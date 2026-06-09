import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: () => apiFetch("/api/auth/profile") });
}

export function useUpdateProfile(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      apiFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useChangePassword(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  return useMutation({
    mutationFn: (data: unknown) => jsonPost("/api/auth/change-password", data),
    ...opts,
  });
}

import {
  type UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

export const groupKeys = {
  all: ["groups"] as const,
  byId: (id: string) => ["groups", id] as const,
  byCode: (code: string) => ["groups", "code", code] as const,
};

export function useGroupList() {
  return useQuery({ queryKey: groupKeys.all, queryFn: () => apiFetch<unknown[]>("/api/groups") });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.byId(id),
    queryFn: () => apiFetch(`/api/groups/${id}`),
    enabled: !!id,
  });
}

export function useFindGroupByCode(code: string) {
  return useQuery({
    queryKey: groupKeys.byCode(code),
    queryFn: () => apiFetch(`/api/groups/find-by-code?code=${encodeURIComponent(code)}`),
    enabled: !!code,
    retry: false,
  });
}

export function useCreateGroup(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => jsonPost("/api/groups", data),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: groupKeys.all });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useCloseGroup(
  opts?: Pick<UseMutationOptions<unknown, Error, { id: string }>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => jsonPost(`/api/groups/${id}/close`, {}),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: groupKeys.all });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useJoinGroup(
  opts?: Pick<
    UseMutationOptions<{ groupId: string }, Error, { code: string }>,
    "onSuccess" | "onError"
  >,
) {
  return useMutation({
    mutationFn: (data: { code: string }) => jsonPost<{ groupId: string }>("/api/groups/join", data),
    ...opts,
  });
}

export function useInviteByUsername(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { groupId: string; username: string }) =>
      jsonPost(`/api/groups/${data.groupId}/invite`, { mode: "username", value: data.username }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: groupKeys.all });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useInviteByEmail(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { groupId: string; email: string }) =>
      jsonPost(`/api/groups/${data.groupId}/invite`, { mode: "email", value: data.email }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: groupKeys.all });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useAddExternalMember(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { groupId: string; externalName: string; externalContact?: string }) =>
      jsonPost(`/api/groups/${data.groupId}/add-external`, {
        externalName: data.externalName,
        externalContact: data.externalContact,
      }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: groupKeys.all });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

export function useRemoveMember(
  opts?: Pick<UseMutationOptions<unknown, Error, unknown>, "onSuccess" | "onError">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      apiFetch(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: async (...args) => {
      await qc.invalidateQueries({ queryKey: groupKeys.all });
      opts?.onSuccess?.(...args);
    },
    onError: opts?.onError,
  });
}

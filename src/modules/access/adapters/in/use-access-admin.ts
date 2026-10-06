import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUserInput, UpdateProfileInput, UpdateUserInput, UserStatus } from "../../domain/entities/access.ts";
import { useAccessModule } from "../../access.module.tsx";

export const USERS_KEY = ["access-users"];
export const PROFILES_KEY = ["access-profiles"];
export const MY_ACCESS_KEY = ["my-access"];

export function useUsers() {
  const { api } = useAccessModule();
  return useQuery({ queryKey: USERS_KEY, queryFn: () => api.listUsers() });
}

export function useUser(userId: string | undefined) {
  const { api } = useAccessModule();
  return useQuery({ queryKey: [...USERS_KEY, userId], queryFn: () => api.getUser(userId!), enabled: !!userId });
}

export function useProfiles() {
  const { api } = useAccessModule();
  return useQuery({ queryKey: PROFILES_KEY, queryFn: () => api.listProfiles() });
}

export function useEmployeeOptions(enabled = true) {
  const { api } = useAccessModule();
  return useQuery({ queryKey: ["access-employee-options"], queryFn: () => api.listEmployeeOptions(), enabled });
}

/** Catálogo (rótulos de módulos/funcionalidades) — vem com o acesso do próprio utilizador. */
export function useCatalog() {
  const { api } = useAccessModule();
  return useQuery({ queryKey: MY_ACCESS_KEY, queryFn: () => api.getMyAccess(), select: (a) => a.catalog, staleTime: 60_000 });
}

/** Depois de qualquer escrita: lista, perfis (contagens) e o próprio acesso podem ter mudado. */
function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: USERS_KEY });
    void qc.invalidateQueries({ queryKey: PROFILES_KEY });
    void qc.invalidateQueries({ queryKey: MY_ACCESS_KEY });
    void qc.invalidateQueries({ queryKey: ["access-employee-options"] });
  };
}

export function useUserMutations(userId?: string) {
  const { api } = useAccessModule();
  const refresh = useRefresh();
  return {
    create: useMutation({ mutationFn: (input: CreateUserInput) => api.createUser(input), onSuccess: refresh }),
    update: useMutation({ mutationFn: (input: UpdateUserInput) => api.updateUser(userId!, input), onSuccess: refresh }),
    setStatus: useMutation({ mutationFn: (v: { status: UserStatus; version: number }) => api.setUserStatus(userId!, v.status, v.version), onSuccess: refresh }),
    resetPassword: useMutation({ mutationFn: () => api.resetPassword(userId!) }),
  };
}

export function useProfileMutations() {
  const { api } = useAccessModule();
  const refresh = useRefresh();
  return {
    create: useMutation({ mutationFn: (input: { name: string; description: string | null; baseProfileId: string | null }) => api.createProfile(input), onSuccess: refresh }),
    update: useMutation({ mutationFn: (v: { profileId: string; input: UpdateProfileInput }) => api.updateProfile(v.profileId, v.input), onSuccess: refresh }),
    setActive: useMutation({ mutationFn: (v: { profileId: string; active: boolean; version: number }) => api.setProfileActive(v.profileId, v.active, v.version), onSuccess: refresh }),
  };
}

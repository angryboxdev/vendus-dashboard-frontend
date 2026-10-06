import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrganizationFormValues, OrganizationProfile } from "../../domain/entities/organization-profile.ts";
import { useOrganizationModule } from "../../organization.module.tsx";

const PROFILE_KEY = ["organization-profile"];
const HISTORY_KEY = ["organization-history"];

/** Liga os use cases do módulo ao react-query — os componentes nunca falam com HTTP. */
export function useOrganizationProfile() {
  const { getProfile, updateProfile, uploadLogo } = useOrganizationModule();
  const qc = useQueryClient();

  const profileQuery = useQuery({ queryKey: PROFILE_KEY, queryFn: () => getProfile.execute() });

  function onSaved(profile: OrganizationProfile) {
    qc.setQueryData(PROFILE_KEY, profile);
    void qc.invalidateQueries({ queryKey: HISTORY_KEY });
  }

  const updateMutation = useMutation({
    mutationFn: ({ current, values }: { current: OrganizationProfile; values: OrganizationFormValues }) =>
      updateProfile.execute(current, values),
    onSuccess: onSaved,
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadLogo.execute(file),
    onSuccess: onSaved,
  });

  return { profileQuery, updateMutation, logoMutation };
}

export function useOrganizationHistory(enabled: boolean) {
  const { listHistory } = useOrganizationModule();
  return useQuery({ queryKey: HISTORY_KEY, queryFn: () => listHistory.execute(), enabled });
}

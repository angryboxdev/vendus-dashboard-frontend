import { useMutation, useQuery } from "@tanstack/react-query";
import type { LocationDTO, LocationFormValues } from "../../domain/entities/location.ts";
import { useLocationsModule, useLocationsState } from "../../locations.module.tsx";

/**
 * Escritas da gestão de Locais. Depois de cada escrita recarrega o estado
 * global do `LocationsProvider`, para todos os seletores da aplicação verem
 * logo o Local novo/inativado.
 */
export function useManageLocations() {
  const { createLocation, updateLocation, setLocationActive } = useLocationsModule();
  const { reload } = useLocationsState();

  const createMutation = useMutation({
    mutationFn: (values: LocationFormValues) => createLocation.execute(values),
    onSuccess: () => reload(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ current, values }: { current: LocationDTO; values: LocationFormValues }) => updateLocation.execute(current, values),
    onSuccess: () => reload(),
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setLocationActive.execute(id, active),
    onSuccess: () => reload(),
  });

  return { createMutation, updateMutation, setActiveMutation };
}

export function useLocationHistory(locationId: string | null) {
  const { listLocationHistory } = useLocationsModule();
  return useQuery({
    queryKey: ["location-history", locationId],
    queryFn: () => listLocationHistory.execute(locationId!),
    enabled: locationId !== null,
  });
}

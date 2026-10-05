import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarFilter, EventInput, HolidayInput } from "../../domain/entities/calendar-item.ts";
import { useCalendarModule } from "../../calendar.module.tsx";

const ROOT = ["calendar"];

/** React-query sobre os use cases — os componentes nunca falam com HTTP. */
export function useCalendarItems(from: string, to: string, filter: CalendarFilter) {
  const { calendar } = useCalendarModule();
  return useQuery({ queryKey: [...ROOT, "items", from, to, filter], queryFn: () => calendar.list(from, to, filter) });
}

export function useUpcomingImportant() {
  const { calendar } = useCalendarModule();
  return useQuery({ queryKey: [...ROOT, "upcoming"], queryFn: () => calendar.upcoming() });
}

export function useCalendarMutations() {
  const { calendar } = useCalendarModule();
  const qc = useQueryClient();
  const onSuccess = () => void qc.invalidateQueries({ queryKey: ROOT });

  return {
    saveEvent: useMutation({ mutationFn: ({ id, input }: { id: string | null; input: EventInput }) => calendar.saveEvent(id, input), onSuccess }),
    cancelEvent: useMutation({ mutationFn: (id: string) => calendar.cancelEvent(id), onSuccess }),
    saveHoliday: useMutation({ mutationFn: ({ id, input }: { id: string | null; input: HolidayInput }) => calendar.saveHoliday(id, input), onSuccess }),
    deleteHoliday: useMutation({ mutationFn: (id: string) => calendar.deleteHoliday(id), onSuccess }),
    importHolidays: useMutation({ mutationFn: (year: number) => calendar.importHolidays(year), onSuccess }),
  };
}

export function useHolidayImportPreview(year: number | null) {
  const { calendar } = useCalendarModule();
  return useQuery({
    queryKey: [...ROOT, "import-preview", year],
    queryFn: () => calendar.previewHolidayImport(year!),
    enabled: year !== null,
  });
}

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Multi-select for the current list page only — whatever thread ids are visible right now,
 * not the whole folder across unloaded cursor pages.
 */
export function useThreadSelection(visibleThreadIds: string[], listScopeKey: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listScopeKey]);

  const toggle = useCallback((threadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const allOnPage = visibleThreadIds.every((id) => prev.has(id));
      if (allOnPage) {
        const next = new Set(prev);
        for (const id of visibleThreadIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleThreadIds) next.add(id);
      return next;
    });
  }, [visibleThreadIds]);

  const allVisibleSelected = useMemo(
    () => visibleThreadIds.length > 0 && visibleThreadIds.every((id) => selectedIds.has(id)),
    [visibleThreadIds, selectedIds],
  );

  const someVisibleSelected = useMemo(
    () => visibleThreadIds.some((id) => selectedIds.has(id)) && !allVisibleSelected,
    [visibleThreadIds, selectedIds, allVisibleSelected],
  );

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    toggleAllVisible,
    clear,
    allVisibleSelected,
    someVisibleSelected,
    isSelected,
  };
}

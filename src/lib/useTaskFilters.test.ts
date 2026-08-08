import { describe, it, expect } from "vitest";
import { useTaskFilters, type TaskFilterCriteria } from "./useTaskFilters";
import { makeTask } from "./taskFixtures";

const noFilter: TaskFilterCriteria = {
  activeListId: null,
  activeTagFilter: null,
  priorityFilter: null,
  searchQuery: "",
};

describe("useTaskFilters", () => {
  it("returns everything unfiltered when no criteria are active", () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2 })];
    expect(useTaskFilters(tasks, noFilter).map((t) => t.id)).toEqual([1, 2]);
  });

  it("list filter pulls in a matching task's descendants even with a different listId", () => {
    const tasks = [
      makeTask({ id: 1, listId: 10 }),
      makeTask({ id: 2, parentId: 1, listId: null }),
      makeTask({ id: 3, listId: 20 }),
    ];
    const result = useTaskFilters(tasks, { ...noFilter, activeListId: 10 });
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  it("tag filter matches direct or inherited tags", () => {
    const tag = { id: 5, name: "errands", color: "#000" };
    const tasks = [
      makeTask({ id: 1, tags: [tag] }),
      makeTask({ id: 2, inheritedTags: [tag] }),
      makeTask({ id: 3, tags: [] }),
    ];
    const result = useTaskFilters(tasks, { ...noFilter, activeTagFilter: 5 });
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  it("priority filter pulls in a matching task's descendants regardless of the descendant's own priority", () => {
    const tasks = [
      makeTask({ id: 1, priority: "high" }),
      makeTask({ id: 2, parentId: 1, priority: "low" }),
      makeTask({ id: 3, priority: "high" }),
    ];
    // The priority filter runs *after* the list filter has already narrowed
    // the pool, so its own descendant walk operates on that narrowed set —
    // task 3 (unrelated, also high priority) should still match on its own.
    const result = useTaskFilters(tasks, { ...noFilter, priorityFilter: "high" });
    expect(result.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("search matches title or description, case-insensitively", () => {
    const tasks = [
      makeTask({ id: 1, title: "Buy milk" }),
      makeTask({ id: 2, title: "Unrelated", description: "contains milk word" }),
      makeTask({ id: 3, title: "Nothing relevant" }),
    ];
    const result = useTaskFilters(tasks, { ...noFilter, searchQuery: "MILK" });
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  it("chains list, tag, priority, and search together", () => {
    const tag = { id: 5, name: "errands", color: "#000" };
    const tasks = [
      makeTask({ id: 1, listId: 10, tags: [tag], priority: "high", title: "Buy milk" }),
      makeTask({ id: 2, listId: 10, tags: [tag], priority: "high", title: "Buy eggs" }),
      makeTask({ id: 3, listId: 10, tags: [], priority: "high", title: "Buy milk but untagged" }),
      makeTask({ id: 4, listId: 99, tags: [tag], priority: "high", title: "Buy milk, wrong list" }),
    ];
    const result = useTaskFilters(tasks, {
      activeListId: 10,
      activeTagFilter: 5,
      priorityFilter: "high",
      searchQuery: "milk",
    });
    expect(result.map((t) => t.id)).toEqual([1]);
  });
});

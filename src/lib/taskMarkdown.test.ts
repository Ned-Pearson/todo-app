import { describe, it, expect } from "vitest";
import { taskToMarkdown, listToMarkdown } from "./taskMarkdown";
import { makeTask } from "./taskFixtures";

describe("taskToMarkdown", () => {
  it("renders just a title heading when there's nothing else set", () => {
    const task = makeTask({ id: 1, title: "Simple task" });
    expect(taskToMarkdown(task, new Map())).toBe("# Simple task\n");
  });

  it("renders due date/priority/tags as a bullet list, plus the description", () => {
    const task = makeTask({
      id: 1,
      title: "Buy milk",
      dueDate: "2026-08-05",
      dueTime: "14:30",
      priority: "high",
      tags: [{ id: 1, name: "errands", color: "#000" }],
      inheritedTags: [{ id: 2, name: "home", color: "#111" }],
      description: "Get the 2% kind",
    });
    expect(taskToMarkdown(task, new Map())).toBe(
      "# Buy milk\n\n- **Due:** 2026-08-05 14:30\n- **Priority:** High\n- **Tags:** errands, home\n\nGet the 2% kind\n"
    );
  });

  it("renders the subtask subtree as a nested checklist", () => {
    const task = makeTask({ id: 1, title: "Plan trip" });
    const childrenByParent = new Map([
      [
        1,
        [
          makeTask({ id: 2, title: "Book flights", parentId: 1 }),
          makeTask({ id: 3, title: "Book hotel", parentId: 1, completed: true }),
        ],
      ],
    ]);
    expect(taskToMarkdown(task, childrenByParent)).toBe(
      "# Plan trip\n\n## Subtasks\n\n- [ ] Book flights\n- [x] Book hotel\n"
    );
  });
});

describe("listToMarkdown", () => {
  it("renders a placeholder line for an empty list", () => {
    expect(listToMarkdown("Groceries", null, [])).toBe("# Groceries\n\n_No tasks in this list yet._\n");
  });

  it("renders a flat list with inline metadata and an optional description", () => {
    const tasks = [
      makeTask({
        id: 1,
        title: "Buy milk",
        dueDate: "2026-08-10",
        priority: "high",
        tags: [{ id: 1, name: "errands", color: "#000" }],
      }),
      makeTask({ id: 2, title: "Buy eggs", completed: true }),
    ];
    expect(listToMarkdown("Groceries", "Weekly shop", tasks)).toBe(
      "# Groceries\n\nWeekly shop\n\n- [ ] Buy milk (Due: 2026-08-10 · High priority · tags: errands)\n- [x] Buy eggs\n"
    );
  });

  it("nests a subtask under its parent instead of listing it twice", () => {
    const tasks = [
      makeTask({ id: 1, title: "Plan trip" }),
      makeTask({ id: 2, title: "Book flights", parentId: 1 }),
      makeTask({ id: 3, title: "Book hotel", parentId: 1, completed: true }),
    ];
    expect(listToMarkdown("Trip", null, tasks)).toBe(
      "# Trip\n\n- [ ] Plan trip\n  - [ ] Book flights\n  - [x] Book hotel\n"
    );
  });

  it("promotes a subtask to a top-level root when its parent isn't part of the export", () => {
    // Parent (id 1) deliberately not included — simulates a subtask that
    // belongs to this list while its parent belongs to a different one.
    const tasks = [makeTask({ id: 2, title: "Standalone-in-list subtask", parentId: 1 })];
    expect(listToMarkdown("Misc", null, tasks)).toBe("# Misc\n\n- [ ] Standalone-in-list subtask\n");
  });
});

import { describe, it, expect } from "vitest";
import { buildTaskTree, withDescendants } from "./tree";
import { makeTask } from "./taskFixtures";

describe("buildTaskTree", () => {
  it("puts every parentless task at the top level", () => {
    const list = [makeTask({ id: 1 }), makeTask({ id: 2 })];
    const { topLevel, childrenByParent } = buildTaskTree(list);
    expect(topLevel.map((t) => t.id)).toEqual([1, 2]);
    expect(childrenByParent.size).toBe(0);
  });

  it("buckets a child under its parent instead of the top level", () => {
    const list = [makeTask({ id: 1 }), makeTask({ id: 2, parentId: 1 })];
    const { topLevel, childrenByParent } = buildTaskTree(list);
    expect(topLevel.map((t) => t.id)).toEqual([1]);
    expect(childrenByParent.get(1)?.map((t) => t.id)).toEqual([2]);
  });

  it("promotes a task to the top level when its parent isn't in the given list", () => {
    // Parent (id 1) filtered out of this list entirely — its child should
    // still render, just as a root instead of vanishing.
    const list = [makeTask({ id: 2, parentId: 1 })];
    const { topLevel, childrenByParent } = buildTaskTree(list);
    expect(topLevel.map((t) => t.id)).toEqual([2]);
    expect(childrenByParent.size).toBe(0);
  });

  it("handles multiple levels of nesting", () => {
    const list = [
      makeTask({ id: 1 }),
      makeTask({ id: 2, parentId: 1 }),
      makeTask({ id: 3, parentId: 2 }),
    ];
    const { topLevel, childrenByParent } = buildTaskTree(list);
    expect(topLevel.map((t) => t.id)).toEqual([1]);
    expect(childrenByParent.get(1)?.map((t) => t.id)).toEqual([2]);
    expect(childrenByParent.get(2)?.map((t) => t.id)).toEqual([3]);
  });
});

describe("withDescendants", () => {
  const pool = [
    makeTask({ id: 1, listId: 10 }),
    makeTask({ id: 2, parentId: 1, listId: null }), // child of 1, different listId
    makeTask({ id: 3, parentId: 2, listId: 20 }), // grandchild of 1, yet another listId
    makeTask({ id: 4, listId: 20 }), // unrelated, matches listId 20 directly
    makeTask({ id: 5, parentId: 4, listId: null }), // child of 4
    makeTask({ id: 6, listId: 99 }), // unrelated, no match
  ];

  it("includes a match plus every descendant regardless of the descendant's own attributes", () => {
    const result = withDescendants(pool, (t) => t.listId === 10);
    expect(result.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("expands multiple independent matches at once, each with its own descendants", () => {
    const result = withDescendants(pool, (t) => t.listId === 20);
    expect(result.map((t) => t.id)).toEqual([3, 4, 5]);
  });

  it("returns just the match itself when it has no descendants", () => {
    const result = withDescendants(pool, (t) => t.listId === 99);
    expect(result.map((t) => t.id)).toEqual([6]);
  });

  it("returns nothing when nothing matches", () => {
    expect(withDescendants(pool, (t) => t.listId === 12345)).toEqual([]);
  });
});

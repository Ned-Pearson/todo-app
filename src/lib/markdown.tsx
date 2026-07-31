import { Fragment, type ReactNode } from "react";

// Deliberately not a full CommonMark implementation — just the handful of
// patterns useful in a task description: bold, italic, inline code, links,
// and bullet/numbered lists. Builds real React elements rather than parsing
// to an HTML string, so there's no dangerouslySetInnerHTML/sanitization
// surface at all.

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

export function renderInlineMarkdown(text: string, keyPrefix = "i"): ReactNode {
  const parts = text.split(INLINE_PATTERN).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code
          key={key}
          style={{
            background: "var(--color-surface-sunken)",
            padding: "1px 4px",
            borderRadius: 3,
            fontSize: "0.9em",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: "var(--color-accent)" }}
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const BULLET_LINE = /^\s*[-*]\s+/;
const NUMBERED_LINE = /^\s*\d+\.\s+/;

export function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (BULLET_LINE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_LINE.test(lines[i])) {
        items.push(lines[i].replace(BULLET_LINE, ""));
        i++;
      }
      const key = blockKey++;
      blocks.push(
        <ul key={`b${key}`} style={{ margin: "4px 0", paddingLeft: 20 }}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item, `ul${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (NUMBERED_LINE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED_LINE.test(lines[i])) {
        items.push(lines[i].replace(NUMBERED_LINE, ""));
        i++;
      }
      const key = blockKey++;
      blocks.push(
        <ol key={`b${key}`} style={{ margin: "4px 0", paddingLeft: 20 }}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item, `ol${key}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: consume consecutive non-blank, non-list lines, joined with <br/>.
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !BULLET_LINE.test(lines[i]) && !NUMBERED_LINE.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    const key = blockKey++;
    blocks.push(
      <p key={`b${key}`} style={{ margin: "4px 0" }}>
        {paraLines.map((l, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInlineMarkdown(l, `p${key}-${idx}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  return <>{blocks}</>;
}

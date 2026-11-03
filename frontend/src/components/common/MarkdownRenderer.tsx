import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-3 font-sans text-sm leading-relaxed text-gray-200 ${className}`}>
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{renderBlock(block, idx)}</React.Fragment>
      ))}
    </div>
  );
};

// ─── Block Types ───────────────────────────────────────────────────────────────

type BlockType =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(markdown: string): BlockType[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: BlockType[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        language: lang || 'text',
        code: codeLines.join('\n'),
      });
      i++;
      continue;
    }

    // 2. Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 3. Horizontal Rule (---, ***, ___)
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 4. Markdown Table (| Col 1 | Col 2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
        const headers = parseRow(tableLines[0]);
        // line 1 is usually separator (|---|---|)
        const dataLines = tableLines.slice(1).filter((l) => !/^\|(\s*:?-+:?\s*\|)+$/.test(l));
        const rows = dataLines.map(parseRow);
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
    }

    // 5. Blockquote (> ...)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // 6. Unordered List (- , * , + )
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 7. Ordered List (1. , 2. )
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 8. Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // 9. Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !/^(\s*[-*_]\s*){3,}$/.test(lines[i].trim()) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return blocks;
}

// ─── Block Renderer ───────────────────────────────────────────────────────────

function renderBlock(block: BlockType, key: number) {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${Math.min(block.level, 6)}` as keyof JSX.IntrinsicElements);
      const classes = {
        1: 'text-xl font-bold text-offWhite tracking-tight pt-2 pb-1 border-b border-charcoal/60',
        2: 'text-lg font-bold text-offWhite tracking-tight pt-2 pb-1 border-b border-charcoal/40',
        3: 'text-base font-semibold text-offWhite pt-1.5',
        4: 'text-sm font-semibold text-gray-200 pt-1',
        5: 'text-xs font-semibold text-gray-300 pt-1 uppercase tracking-wider',
        6: 'text-xs font-semibold text-gray-400 pt-0.5 uppercase tracking-wider',
      }[block.level] || 'text-base font-semibold text-offWhite';

      return (
        <Tag key={key} className={classes}>
          {renderInline(block.text)}
        </Tag>
      );
    }

    case 'code':
      return <CodeBlock key={key} language={block.language} code={block.code} />;

    case 'table':
      return (
        <div key={key} className="overflow-x-auto my-3 rounded-xl border border-charcoal shadow-sm">
          <table className="w-full text-left text-xs font-mono border-collapse bg-obsidian/70">
            <thead>
              <tr className="bg-charcoal/60 border-b border-charcoal text-offWhite font-semibold">
                {block.headers.map((h, idx) => (
                  <th key={idx} className="px-4 py-2.5">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/60">
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-gray-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'hr':
      return <hr key={key} className="border-charcoal/80 my-4" />;

    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-neonGreen/60 pl-3.5 py-1 text-xs italic text-gray-300 bg-obsidian/40 rounded-r-lg my-2"
        >
          {block.lines.map((l, lIdx) => (
            <p key={lIdx} className="mb-1 last:mb-0">
              {renderInline(l)}
            </p>
          ))}
        </blockquote>
      );

    case 'ul':
      return (
        <ul key={key} className="list-disc list-inside space-y-1 my-2 pl-1 text-gray-300 text-xs">
          {block.items.map((it, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={key} className="list-decimal list-inside space-y-1 my-2 pl-1 text-gray-300 text-xs font-mono">
          {block.items.map((it, idx) => (
            <li key={idx} className="leading-relaxed font-sans">
              {renderInline(it)}
            </li>
          ))}
        </ol>
      );

    case 'paragraph':
      return (
        <p key={key} className="text-gray-200 text-xs sm:text-sm leading-relaxed mb-2 last:mb-0">
          {renderInline(block.text)}
        </p>
      );
  }
}

// ─── Inline Formatter ─────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Split tokens for inline code (`...`), bold (**...**), italic (*...* or _..._), links ([text](url))
  // Regex that captures all 4 token types
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    // 1. Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-charcoal/90 border border-charcoal font-mono text-[11px] text-neonGreen font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // 2. Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-offWhite">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }

    // 3. Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-gray-300">
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }

    // 4. Link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      // Sanitize: allow only http, https, mailto or relative paths (prevent javascript: XSS)
      const isSafe = /^(https?:|\/|mailto:)/i.test(url.trim());
      if (!isSafe) {
        return <span key={idx}>{label}</span>;
      }
      return (
        <a
          key={idx}
          href={url.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-neonGreen underline hover:text-white transition-colors"
        >
          <span>{label}</span>
          <ExternalLink className="w-2.5 h-2.5 inline" />
        </a>
      );
    }

    return part;
  });
}

// ─── Code Block Component with Copy Button ────────────────────────────────────

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-charcoal bg-obsidian/95 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-charcoal/70 border-b border-charcoal text-xs font-mono text-gray-400">
        <span className="uppercase text-[11px] font-semibold text-gray-300">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-obsidian hover:bg-charcoal text-gray-400 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-neonGreen" />
              <span className="text-[10px] text-neonGreen">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono text-gray-200 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};


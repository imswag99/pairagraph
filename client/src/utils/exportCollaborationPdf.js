import { jsPDF } from 'jspdf';

function stripTags(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// The editor only ever produces <p>/<strong>/<em> (see RichTextEditor's
// trimmed StarterKit config), so a full HTML parser isn't needed — but a
// real DOM walk (via the browser's own DOMParser) is still more robust than
// a regex for pulling out which spans of text are bold/italic.
function parseStyledRuns(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const runs = [];

  function walk(node, bold, italic) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) runs.push({ text: node.textContent, bold, italic });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    const nextBold = bold || tag === 'strong' || tag === 'b';
    const nextItalic = italic || tag === 'em' || tag === 'i';
    node.childNodes.forEach((child) => walk(child, nextBold, nextItalic));
  }

  parsed.body.childNodes.forEach((node) => walk(node, false, false));
  return runs;
}

// Splits each run on whitespace boundaries while keeping the style attached
// to every resulting word/space token, so wrapping can happen word-by-word
// without losing track of which words were bold/italic.
function tokenize(runs) {
  const tokens = [];
  for (const run of runs) {
    for (const part of run.text.split(/(\s+)/).filter(Boolean)) {
      tokens.push({ text: part, bold: run.bold, italic: run.italic });
    }
  }
  return tokens;
}

function fontStyle(bold, italic) {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

// jsPDF has no HTML/rich-text layout of its own — this greedily packs styled
// word tokens into lines under maxWidth, measuring each token in its own
// font style since bold/italic glyphs are wider than normal ones.
function layoutTokensIntoLines(doc, tokens, maxWidth) {
  const lines = [];
  let current = [];
  let currentWidth = 0;

  for (const token of tokens) {
    doc.setFont('times', fontStyle(token.bold, token.italic));
    const width = doc.getTextWidth(token.text);
    const isSpace = token.text.trim() === '';

    if (isSpace && current.length === 0) continue; // never start a line with whitespace

    if (!isSpace && currentWidth + width > maxWidth && current.length > 0) {
      lines.push(current);
      current = [];
      currentWidth = 0;
    }

    current.push(token);
    currentWidth += width;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

// PDF reads as one continuous piece — no per-turn labels or dividers, unlike
// the on-screen EntryList which attributes each entry to its author.
export function buildCollaborationPdfDoc(collaboration) {
  const isPoem = collaboration.writingType === 'poem';
  const entries = collaboration.entries.filter((entry) => stripTags(entry.content));
  const authors = collaboration.participants.map((p) => p.user.displayName);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 20;
  let y = margin;

  function ensureSpace() {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text(isPoem ? 'A Poem' : 'A Story', pageWidth / 2, y, { align: 'center' });
  y += 32;

  doc.setFontSize(13);

  entries.forEach((entry, index) => {
    const tokens = tokenize(parseStyledRuns(entry.content));
    const wrappedLines = layoutTokensIntoLines(doc, tokens, maxWidth);

    wrappedLines.forEach((line) => {
      ensureSpace();
      let x = margin;
      for (const token of line) {
        doc.setFont('times', fontStyle(token.bold, token.italic));
        doc.text(token.text, x, y);
        x += doc.getTextWidth(token.text);
      }
      y += lineHeight;
    });

    if (!isPoem && index < entries.length - 1) {
      y += lineHeight * 0.6;
    }
  });

  y += lineHeight * 1.5;
  ensureSpace();
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.text(`— Written by ${authors.join(' & ')}`, pageWidth / 2, y, { align: 'center' });

  return doc;
}

export function downloadCollaborationPdf(collaboration) {
  const doc = buildCollaborationPdfDoc(collaboration);
  const isPoem = collaboration.writingType === 'poem';
  const authors = collaboration.participants.map((p) => p.user.displayName);
  const slug = authors.join('-and-').toLowerCase().replace(/[^a-z0-9-]+/g, '');
  doc.save(`${isPoem ? 'poem' : 'story'}-${slug}.pdf`);
}

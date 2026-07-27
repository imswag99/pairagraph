import { jsPDF } from 'jspdf';

function stripTags(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// PDF reads as one continuous piece — no per-turn labels or dividers, unlike
// the on-screen EntryList which attributes each entry to its author.
export function buildCollaborationPdfDoc(collaboration) {
  const isPoem = collaboration.writingType === 'poem';
  const lines = collaboration.entries.map((entry) => stripTags(entry.content)).filter(Boolean);
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

  doc.setFont('times', 'normal');
  doc.setFontSize(13);

  lines.forEach((line, index) => {
    doc.splitTextToSize(line, maxWidth).forEach((wrapped) => {
      ensureSpace();
      doc.text(wrapped, margin, y);
      y += lineHeight;
    });
    if (!isPoem && index < lines.length - 1) {
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

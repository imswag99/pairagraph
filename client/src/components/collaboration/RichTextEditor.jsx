import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

export function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      // One line (poem) / one paragraph (story) is enforced by never letting
      // Enter create a second block or a line break in the first place.
      handleKeyDown: (_view, event) => event.key === 'Enter',
      attributes: {
        class:
          'min-h-[3rem] px-4 py-3 font-serif text-base leading-relaxed text-charcoal focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-charcoal/15 bg-white/70 transition focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/15">
      <div className="flex gap-1 border-b border-charcoal/10 px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
          className={`rounded px-2 py-1 text-xs font-semibold transition ${
            editor.isActive('bold')
              ? 'bg-indigo-tint text-indigo-dark'
              : 'text-charcoal/50 hover:text-charcoal'
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
          className={`rounded px-2 py-1 text-xs italic transition ${
            editor.isActive('italic')
              ? 'bg-indigo-tint text-indigo-dark'
              : 'text-charcoal/50 hover:text-charcoal'
          }`}
        >
          I
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

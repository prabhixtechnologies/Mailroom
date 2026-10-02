import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ComposeToolbar } from "./ComposeToolbar";

export function RichTextEditor({
  html,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
}: {
  html: string;
  onChange: (html: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: false }),
    ],
    content: html || "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "mr-rich-editor__surface",
        role: "textbox",
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        "data-placeholder": placeholder ?? "",
      },
      handlePaste: (_view, event) => {
        const plain = event.clipboardData?.getData("text/plain");
        if (plain != null) {
          event.preventDefault();
          editorRef.current?.chain().focus().insertContent(plain).run();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (html !== current && html !== normalizeEmpty(current)) {
      editor.commands.setContent(html || "<p></p>", false);
    }
  }, [html, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return <div className="mr-rich-editor mr-rich-editor--loading" aria-busy="true" />;
  }

  return (
    <div className="mr-rich-editor">
      <ComposeToolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

function normalizeEmpty(html: string): string {
  return html === "<p></p>" ? "" : html;
}

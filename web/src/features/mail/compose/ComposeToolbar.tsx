import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ComposeToolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const item = (active: boolean) =>
    cn("size-8 shrink-0", active && "bg-surface-muted text-text");

  return (
    <div className="mr-rich-editor__toolbar" role="toolbar" aria-label="Formatting">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={item(editor.isActive("bold"))}
        disabled={disabled}
        aria-pressed={editor.isActive("bold")}
        aria-label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={item(editor.isActive("italic"))}
        disabled={disabled}
        aria-pressed={editor.isActive("italic")}
        aria-label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={item(editor.isActive("underline"))}
        disabled={disabled}
        aria-pressed={editor.isActive("underline")}
        aria-label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </Button>
      <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={item(editor.isActive("bulletList"))}
        disabled={disabled}
        aria-pressed={editor.isActive("bulletList")}
        aria-label="Bulleted list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={item(editor.isActive("orderedList"))}
        disabled={disabled}
        aria-pressed={editor.isActive("orderedList")}
        aria-label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={item(editor.isActive("link"))}
        disabled={disabled}
        aria-label="Insert link"
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", previous ?? "https://");
          if (url == null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <LinkIcon className="size-4" />
      </Button>
      <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled || !editor.can().undo()}
        aria-label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled || !editor.can().redo()}
        aria-label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="size-4" />
      </Button>
    </div>
  );
}

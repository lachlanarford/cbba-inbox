'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minRows?: number
  className?: string
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here...',
  minRows = 4,
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[inherit]',
      },
    },
  })

  // Sync external value changes (e.g. inserting a canned response)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  if (!editor) return null

  const btn = (active: boolean, title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${
        active
          ? 'bg-white/15 text-white'
          : 'text-gray-500 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 flex-shrink-0">
        {btn(editor.isActive('bold'), 'Bold', () => editor.chain().focus().toggleBold().run(),
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 010 8H6V4zm0 8h9a4 4 0 010 8H6v-8z"/></svg>
        )}
        {btn(editor.isActive('italic'), 'Italic', () => editor.chain().focus().toggleItalic().run(),
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4h4l-4 16H6l4-16zm2 0h4l-4 16h-4l4-16z"/></svg>
        )}
        <div className="w-px h-3.5 bg-white/10 mx-1" />
        {btn(editor.isActive('bulletList'), 'Bullet list', () => editor.chain().focus().toggleBulletList().run(),
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
        )}
        {btn(editor.isActive('orderedList'), 'Numbered list', () => editor.chain().focus().toggleOrderedList().run(),
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 113.056 1.026 1.125 1.125 0 01-3.056-1.026zm0 0H2.99m1.125 5.124a1.125 1.125 0 01-2.25 0H2.99m1.125 0v-3.375m0 0H2.99" /></svg>
        )}
        <div className="w-px h-3.5 bg-white/10 mx-1" />
        {btn(false, 'Add link', () => {
          const url = window.prompt('Enter URL')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        },
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
        )}
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        style={{ minHeight: `${minRows * 1.625}rem` }}
        className="flex-1 px-3 py-2.5 text-sm text-white overflow-y-auto"
      />
    </div>
  )
}

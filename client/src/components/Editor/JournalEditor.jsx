import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import VoiceInput from './VoiceInput';
import { useGhostText } from './GhostCanvas';

export default function JournalEditor({ onSave, initialContent = '', loading = false }) {
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [currentText, setCurrentText] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: 'What\'s on your mind today? Let your thoughts flow freely...'
      })
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none font-journal focus:outline-none min-h-[300px] text-gray-700'
      }
    },
    onUpdate: ({ editor }) => {
      setCurrentText(editor.getText());
    }
  });

  // Ghost text hook
  const { ghostText, isLoading: ghostLoading, acceptGhostText, clearGhostText } = useGhostText(
    currentText, 
    ghostEnabled && currentText.length > 30
  );

  // Handle Tab key to accept ghost text
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' && ghostText && editor) {
        e.preventDefault();
        const accepted = acceptGhostText();
        if (accepted) {
          editor.commands.insertContent(' ' + accepted);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ghostText, editor, acceptGhostText]);

  // Clear ghost text when editor changes significantly
  useEffect(() => {
    if (!ghostText) return;
    clearGhostText();
  }, [currentText.length > 50 ? currentText.slice(-50) : currentText]);

  const handleVoiceTranscript = useCallback((transcript, isInterim) => {
    if (!editor) return;
    
    if (!isInterim) {
      // Insert final transcript with space
      editor.commands.insertContent(' ' + transcript);
    }
  }, [editor]);

  const handleSave = () => {
    if (!editor || !editor.getText().trim()) return;

    onSave({
      content: editor.getText(),
      contentHtml: editor.getHTML(),
      isDiscoverable
    });

    // Clear editor after save
    editor.commands.clearContent();
    setIsDiscoverable(false);
    setCurrentText('');
  };

  const wordCount = editor?.getText().split(/\s+/).filter(Boolean).length || 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-panel-lg overflow-hidden">
        {/* Editor Toolbar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/20 bg-white/20">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold')}
            title="Bold"
          >
            <strong className="font-system">B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic')}
            title="Italic"
          >
            <em className="font-system">I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive('heading', { level: 2 })}
            title="Heading"
          >
            <span className="font-system">H</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive('bulletList')}
            title="Bullet List"
          >
            <span className="font-system">•</span>
          </ToolbarButton>
          
          <div className="h-4 w-px bg-white/30 mx-1" />
          
          {/* Voice Input */}
          <VoiceInput 
            onTranscript={handleVoiceTranscript}
            disabled={loading}
          />
          
          {/* Ghost Text Toggle */}
          <button
            onClick={() => setGhostEnabled(!ghostEnabled)}
            className={`p-2 rounded-xl text-sm transition-all duration-200 font-system ${
              ghostEnabled 
                ? 'bg-honeydew/40 text-green-700 shadow-md' 
                : 'bg-white/20 text-gray-500 hover:bg-white/30'
            }`}
            title={ghostEnabled ? 'AI suggestions enabled' : 'AI suggestions disabled'}
          >
            ✨
          </button>
          
          <div className="flex-1" />
          <span className="text-sm text-gray-500 font-system">{wordCount} words</span>
        </div>

        {/* Editor Content with Ghost Text */}
        <div className="p-8 relative min-h-[400px]">
          <EditorContent editor={editor} />
          
          {/* Ghost Text Suggestion - AI Prompt Style */}
          {ghostText && (
            <div className="mt-4 ai-suggestion">
              <div className="flex items-start gap-3">
                <span className="text-gray-600 italic flex-1 font-system">{ghostText}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500 font-system">Press</span>
                  <kbd className="px-2 py-1 bg-white/60 border border-white/40 rounded text-xs font-mono shadow-sm">Tab</kbd>
                  <span className="text-xs text-gray-500 font-system">to accept</span>
                </div>
              </div>
            </div>
          )}
          
          {ghostLoading && (
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 flex items-center gap-1 font-system">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              thinking...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/20 bg-white/10 flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={isDiscoverable}
                onChange={(e) => setIsDiscoverable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-white/40 peer-checked:bg-blue-eyes rounded-full transition-all duration-200 shadow-sm" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-md peer-checked:translate-x-4" />
            </div>
            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition font-system">
              Allow AI to find resonant thinkers
            </span>
          </label>

          <button
            onClick={handleSave}
            disabled={loading || !editor?.getText().trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>

      {isDiscoverable && (
        <p className="mt-4 text-sm text-gray-600 text-center flex items-center justify-center gap-2 font-system">
          <span>✨</span>
          <span>Your thoughts may connect you with kindred spirits</span>
        </p>
      )}
    </div>
  );
}

function ToolbarButton({ children, onClick, active, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-blue-eyes text-white shadow-md scale-110' 
          : 'text-gray-600 hover:bg-white/40 hover:backdrop-blur-sm hover:scale-105'
      }`}
    >
      {children}
    </button>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import VoiceInput from './VoiceInput';
import { useGhostText } from './GhostCanvas';
import api from '../../services/api';

// Detect if the user is on a touch device (to adapt ghost text hint)
const isTouch = () => ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function JournalEditor({ onSave, onImageUpload, initialContent = '', loading = false }) {
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [ghostEnabled,   setGhostEnabled]   = useState(true);
  const [currentText,    setCurrentText]    = useState('');
  const [touch,          setTouch]          = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError,     setImageError]     = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { setTouch(isTouch()); }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "What's on your mind today? Let your thoughts flow freely..." }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-h-[500px] w-auto max-w-full object-contain my-4 shadow-sm border border-gray-100',
        },
      })
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-base sm:prose-lg max-w-none font-journal focus:outline-none text-gray-700'
      }
    },
    onUpdate: ({ editor }) => setCurrentText(editor.getText()),
  });

  const { ghostText, isLoading: ghostLoading, acceptGhostText, clearGhostText } = useGhostText(
    currentText,
    ghostEnabled && currentText.length > 30
  );

  // Tab key accepts ghost text on desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' && ghostText && editor && !touch) {
        e.preventDefault();
        const accepted = acceptGhostText();
        if (accepted) editor.commands.insertContent(' ' + accepted);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ghostText, editor, acceptGhostText, touch]);

  useEffect(() => {
    if (!ghostText) return;
    clearGhostText();
  }, [currentText.length > 50 ? currentText.slice(-50) : currentText]);

  const handleVoiceTranscript = useCallback((transcript, isInterim) => {
    if (!editor || isInterim) return;
    editor.commands.insertContent(' ' + transcript);
  }, [editor]);

  // V1 Flow: Attach image directly to the journal entry visual editor
  const handleImageUpload_V1 = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    setImageError('');
    setImageProcessing(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Upload file to local static server
      const { data } = await api.post('/entries/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success && data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (err) {
      const msg = (typeof err === 'string' ? err : err?.response?.data?.message || err?.message || '') || '';
      setImageError(msg.toLowerCase().includes('size') ? '⚠️ Image is too large. Please use an image under 10MB.' : '⚠️ Image upload failed.');
      setTimeout(() => setImageError(''), 6000);
    } finally {
      setImageProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [editor]);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;

    setImageError('');
    setImageProcessing(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('isDiscoverable', isDiscoverable);
      await onImageUpload(formData);
    } catch (err) {
      // err can be an Error object or a plain string (from Redux rejectWithValue)
      const msg = (typeof err === 'string' ? err : err?.message || '') || '';
      const lower = msg.toLowerCase();
      let friendlyMsg;
      if (lower.includes('no ai provider') || lower.includes('configure') || lower.includes('api key') || lower.includes('hf_token') || lower.includes('openai_api_key')) {
        friendlyMsg = '⚠️ Image OCR needs an AI key. Add OPENAI_API_KEY or HF_TOKEN to your server .env, then restart the server.';
      } else if (lower.includes('extract') || lower.includes('no text') || lower.includes('readable')) {
        friendlyMsg = '⚠️ Could not extract text from the image. Try a clearer, higher-contrast photo.';
      } else if (lower.includes('size') || lower.includes('5mb') || lower.includes('limit')) {
        friendlyMsg = '⚠️ Image is too large. Please use an image under 5MB.';
      } else if (lower.includes('type') || lower.includes('format')) {
        friendlyMsg = '⚠️ Invalid file type. Please upload a JPG, PNG, or WEBP image.';
      } else {
        friendlyMsg = `⚠️ Image upload failed${msg ? ': ' + msg : '. Please try again.'}`;
      }
      setImageError(friendlyMsg);
      // Auto-clear error after 8s
      setTimeout(() => setImageError(''), 8000);
    } finally {
      setImageProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onImageUpload, isDiscoverable]);

  const handleAcceptGhost = () => {
    if (!editor || !ghostText) return;
    const accepted = acceptGhostText();
    if (accepted) editor.commands.insertContent(' ' + accepted);
  };

  const handleSave = () => {
    if (!editor || !editor.getText().trim()) return;
    onSave({ content: editor.getText(), contentHtml: editor.getHTML(), isDiscoverable });
    editor.commands.clearContent();
    setIsDiscoverable(false);
    setCurrentText('');
  };

  const wordCount = editor?.getText().split(/\s+/).filter(Boolean).length || 0;

  return (
    <div className="w-full">
      <div className="glass-panel-lg overflow-hidden flex flex-col">

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 sm:px-6 sm:py-3 border-b border-white/20 bg-white/20">
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()}    active={editor?.isActive('bold')}             title="Bold">
            <strong className="font-system text-sm">B</strong>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()}  active={editor?.isActive('italic')}           title="Italic">
            <em className="font-system text-sm">I</em>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading">
            <span className="font-system text-sm font-bold">H</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')}    title="Bullet List">
            <span className="font-system text-sm">•—</span>
          </ToolbarButton>

          <div className="h-5 w-px bg-white/30 mx-0.5 hidden sm:block" />

          {/* Voice input */}
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={loading} />

          {/* Image upload V1 (Direct Attachment) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload_V1}
            className="hidden"
            id="image-upload-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || imageProcessing}
            title={imageProcessing ? 'Uploading image…' : 'Attach an image'}
            className={[
              'touch-target rounded-xl text-sm transition-all duration-200 font-system px-2',
              imageProcessing
                ? 'bg-blue-eyes/20 text-blue-600 animate-pulse'
                : 'bg-white/20 text-gray-500 hover:bg-white/30',
            ].join(' ')}
          >
            {imageProcessing ? '⏳' : '🖼️'}
          </button>

          {/* 
            HIDDEN DEV FEATURE: Image Upload V2 (OCR Text Extraction) 
            Do not delete this code per requested requirements.
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload-input-ocr"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || imageProcessing}
              title="Upload image (OCR) [V2]"
              className="touch-target rounded-xl text-sm transition-all duration-200 font-system px-2"
            >
              📷
            </button>
          */}

          {/* Ghost text toggle */}
          <button
            onClick={() => setGhostEnabled(!ghostEnabled)}
            title={ghostEnabled ? 'AI suggestions on' : 'AI suggestions off'}
            className={[
              'touch-target rounded-xl text-sm transition-all duration-200 font-system px-2',
              ghostEnabled ? 'bg-honeydew/40 text-green-700 shadow-md' : 'bg-white/20 text-gray-500 hover:bg-white/30',
            ].join(' ')}
          >
            ✨
          </button>

          {/* Word count */}
          <div className="flex-1" />
          <span className="text-xs text-gray-400 font-system hidden sm:inline">{wordCount} words</span>
          <span className="text-xs text-gray-400 font-system sm:hidden">{wordCount}w</span>
        </div>

        {/* ── Image error banner ─────────────────────────────────────────── */}
        {imageError && (
          <div className="mx-4 sm:mx-6 mt-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <span className="text-sm text-red-700 font-system flex-1">{imageError}</span>
            <button onClick={() => setImageError('')} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
          </div>
        )}

        <div className="p-4 sm:p-8 relative">
          <EditorContent editor={editor} />

          {/* Ghost text suggestion */}
          {ghostText && (
            <div className="mt-4 ai-suggestion">
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-gray-600 italic flex-1 font-system text-sm">{ghostText}</span>

                {/* Desktop: keyboard hint / Mobile: tap button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {touch ? (
                    <button
                      onClick={handleAcceptGhost}
                      className="px-3 py-1.5 bg-honeydew/60 text-green-700 text-xs font-medium rounded-lg hover:bg-honeydew/80 transition-colors"
                    >
                      ✓ Accept
                    </button>
                  ) : (
                    <>
                      <span className="text-xs text-gray-400 font-system">Press</span>
                      <kbd className="px-2 py-1 bg-white/60 border border-white/40 rounded text-xs font-mono shadow-sm">Tab</kbd>
                      <span className="text-xs text-gray-400 font-system">to accept</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {ghostLoading && (
            <div className="absolute bottom-3 right-3 text-xs text-gray-400 flex items-center gap-1 font-system">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              thinking…
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-4 border-t border-white/20 bg-white/10">
          {/*
            Mobile: stack vertically (toggle on top, save button full-width below)
            Desktop: side by side
          */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Selective Discovery toggle */}
            <label className="flex items-center gap-3 cursor-pointer group min-h-[44px]">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isDiscoverable}
                  onChange={(e) => setIsDiscoverable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/40 peer-checked:bg-blue-eyes rounded-full transition-all duration-300 shadow-sm" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md peer-checked:translate-x-5" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 font-system block">Allow AI to find resonant thinkers</span>
                {isDiscoverable && (
                  <span className="text-xs text-blue-eyes font-system animate-fade-in">✨ Entry will be discoverable</span>
                )}
              </div>
            </label>

            {/* Save button — full width on mobile */}
            <button
              onClick={handleSave}
              disabled={loading || !editor?.getText().trim()}
              className="btn-primary w-full sm:w-auto"
            >
              {loading ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ children, onClick, active, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'touch-target rounded-lg transition-all duration-200 px-2',
        active
          ? 'bg-blue-eyes text-white shadow-md scale-105'
          : 'text-gray-600 hover:bg-white/40 hover:scale-105',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

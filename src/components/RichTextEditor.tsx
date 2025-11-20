import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic,
  Underline, 
  Strikethrough, 
  Highlighter, 
  List, 
  ListOrdered,
  Type,
  Eraser,
  CaseLower,
  Pilcrow,
  Minus,
  Plus,
  Code,
  Indent,
  Outdent,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  className,
  rows = 3,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState(3);

  const FONT_SIZE_MAP: Record<number, string> = {
    1: "12px",
    2: "13px",
    3: "14px",
    4: "16px",
    5: "18px",
    6: "20px",
    7: "24px",
  };
  const MIN_FONT_LEVEL = 1;
  const MAX_FONT_LEVEL = 6;

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      // If value is plain text without HTML tags, wrap it in paragraph tags
      if (value && !value.trim().match(/^<[^>]+>/)) {
        // Plain text - wrap in paragraph tags for proper formatting
        const paragraphs = value.split('\n').filter(p => p.trim());
        if (paragraphs.length > 0) {
          editorRef.current.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
        } else {
          editorRef.current.innerHTML = '';
        }
      } else {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const normalizeFontTags = () => {
    if (!editorRef.current) return;
    const fonts = editorRef.current.querySelectorAll("font[size]");
    fonts.forEach((font) => {
      const size = font.getAttribute("size");
      if (!size) return;
      const span = document.createElement("span");
      span.style.fontSize = FONT_SIZE_MAP[parseInt(size, 10)] || FONT_SIZE_MAP[3];
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  };

  const applyFontSize = (level: number) => {
    const clamped = Math.max(MIN_FONT_LEVEL, Math.min(MAX_FONT_LEVEL, level));
    execCommand("fontSize", clamped.toString());
    normalizeFontTags();
    setFontSizeLevel(clamped);
  };

  const transformSelection = (transformer: (input: string) => string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText) {
        const transformed = transformer(selectedText);
        range.deleteContents();
        const textNode = document.createTextNode(transformed);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        handleInput();
      }
    }
  };

  const formatText = (format: string) => {
    switch (format) {
      case 'bold':
        execCommand('bold');
        break;
      case 'italic':
        execCommand('italic');
        break;
      case 'underline':
        execCommand('underline');
        break;
      case 'strikethrough':
        execCommand('strikethrough');
        break;
      case 'highlight':
        execCommand('backColor', '#fef08a'); // Yellow highlight
        break;
      case 'code':
        // Wrap selection in code tags
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (selectedText) {
            const codeNode = document.createElement('code');
            codeNode.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            codeNode.style.padding = '2px 4px';
            codeNode.style.borderRadius = '3px';
            codeNode.style.fontFamily = 'monospace';
            codeNode.textContent = selectedText;
            range.deleteContents();
            range.insertNode(codeNode);
            handleInput();
          }
        }
        break;
      case 'uppercase':
        transformSelection((text) => text.toUpperCase());
        break;
      case 'lowercase':
        transformSelection((text) => text.toLowerCase());
        break;
      case 'bullet':
        // Toggle unordered list - execCommand automatically toggles
        execCommand('insertUnorderedList');
        // Ensure focus and update
        setTimeout(() => {
          editorRef.current?.focus();
          handleInput();
        }, 0);
        break;
      case 'numbered':
        // Toggle ordered list - execCommand automatically toggles
        execCommand('insertOrderedList');
        // Ensure focus and update
        setTimeout(() => {
          editorRef.current?.focus();
          handleInput();
        }, 0);
        break;
      case 'indent':
        execCommand('indent');
        break;
      case 'outdent':
        execCommand('outdent');
        break;
      case 'paragraph':
        // Convert current block to paragraph with proper formatting
        execCommand('formatBlock', '<p>');
        break;
      case 'alignLeft':
        execCommand('justifyLeft');
        break;
      case 'alignCenter':
        execCommand('justifyCenter');
        break;
      case 'alignRight':
        execCommand('justifyRight');
        break;
      case 'alignJustify':
        execCommand('justifyFull');
        break;
      case 'clear':
        // Remove all formatting from selection
        execCommand('removeFormat');
        execCommand('unlink'); // Remove links too
        setFontSizeLevel(3);
        break;
    }
  };

  const isFormatActive = (format: string): boolean => {
    if (!editorRef.current) return false;
    
    try {
      switch (format) {
        case 'bold':
          return document.queryCommandState('bold');
        case 'italic':
          return document.queryCommandState('italic');
        case 'underline':
          return document.queryCommandState('underline');
        case 'strikethrough':
          return document.queryCommandState('strikethrough');
        case 'bullet':
          return document.queryCommandState('insertUnorderedList');
        case 'numbered':
          return document.queryCommandState('insertOrderedList');
        case 'alignLeft':
          return document.queryCommandState('justifyLeft');
        case 'alignCenter':
          return document.queryCommandState('justifyCenter');
        case 'alignRight':
          return document.queryCommandState('justifyRight');
        case 'alignJustify':
          return document.queryCommandState('justifyFull');
        default:
          return false;
      }
    } catch (error) {
      // Fallback for browsers that don't support queryCommandState
      return false;
    }
  };

  return (
    <div 
      className={cn(
        "border rounded-xl bg-white/80 dark:bg-gray-900/70 backdrop-blur-sm shadow-sm",
        "border-primary/10",
        className
      )}
    >
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-primary/10 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 rounded-t-xl">
        {/* Text Formatting Group */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('bold') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('italic') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('underline') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('strikethrough') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('strikethrough')}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Highlight & Code */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('highlight')}
          title="Highlight"
        >
          <Highlighter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('code')}
          title="Code"
        >
          <Code className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('bullet') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('bullet')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('numbered') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('numbered')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Text Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('alignLeft') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignLeft')}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('alignCenter') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignCenter')}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('alignRight') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignRight')}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('alignJustify') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignJustify')}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Paragraph Format */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('paragraph')}
          title="Paragraph (Press Enter for new paragraph)"
        >
          <Pilcrow className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Indentation */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('outdent')}
          title="Decrease Indent"
        >
          <Outdent className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('indent')}
          title="Increase Indent"
        >
          <Indent className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Text Transform */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('uppercase')}
          title="Uppercase"
        >
          <Type className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('lowercase')}
          title="Lowercase"
        >
          <CaseLower className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Font Size */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => applyFontSize(fontSizeLevel - 1)}
            disabled={fontSizeLevel <= MIN_FONT_LEVEL}
            title="Decrease font size"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-[11px] font-semibold text-muted-foreground w-6 text-center">
            A
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => applyFontSize(fontSizeLevel + 1)}
            disabled={fontSizeLevel >= MAX_FONT_LEVEL}
            title="Increase font size"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Clear Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => formatText('clear')}
          title="Clear Formatting"
        >
          <Eraser className="w-4 h-4" />
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "min-h-[60px] p-3 outline-none text-sm rounded-b-xl",
          "focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
          !value && "text-muted-foreground",
          rows === 3 && "min-h-[60px]",
          rows === 4 && "min-h-[80px]",
          rows === 5 && "min-h-[100px]",
          // List styling - ensure lists are visible and properly formatted
          "[&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-1 [&_ul]:space-y-1 [&_ul]:block",
          "[&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:my-1 [&_ol]:space-y-1 [&_ol]:block",
          "[&_li]:ml-2 [&_li]:leading-relaxed [&_li]:block",
          // Paragraph and indentation styling
          "[&_p]:my-2 [&_p]:leading-relaxed [&_p]:block [&_p:empty]:hidden",
          "[&_p+p]:mt-2",
          // Text alignment support - preserve alignment styles
          "[&_p[style*='text-align:left']]:text-left",
          "[&_p[style*='text-align:center']]:text-center",
          "[&_p[style*='text-align:right']]:text-right",
          "[&_p[style*='text-align:justify']]:text-justify",
          "[&_div[style*='text-align:left']]:text-left",
          "[&_div[style*='text-align:center']]:text-center",
          "[&_div[style*='text-align:right']]:text-right",
          "[&_div[style*='text-align:justify']]:text-justify",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:ml-2 [&_blockquote]:italic [&_blockquote]:my-1",
          // Code styling
          "[&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block",
          // Ensure proper display of formatted text
          "[&_strong]:font-bold [&_b]:font-bold",
          "[&_em]:italic [&_i]:italic",
          "[&_u]:underline",
          "[&_s]:line-through [&_strike]:line-through",
        )}
        style={{
          minHeight: `${rows * 20}px`,
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      
      {/* Placeholder and list styling */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] ul,
        [contenteditable] ol {
          display: block;
          list-style-position: outside;
          margin-left: 1rem;
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        [contenteditable] ul {
          list-style-type: disc;
        }
        [contenteditable] ol {
          list-style-type: decimal;
        }
        [contenteditable] li {
          display: list-item;
          margin-left: 0.5rem;
        }
      `}</style>
    </div>
  );
}


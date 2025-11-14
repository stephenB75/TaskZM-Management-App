import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Underline, 
  Strikethrough, 
  Highlighter, 
  List, 
  Type,
  Eraser
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

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
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

  const formatText = (format: string) => {
    switch (format) {
      case 'bold':
        execCommand('bold');
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
      case 'uppercase':
        // Convert selected text to uppercase
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (selectedText) {
            const uppercaseText = selectedText.toUpperCase();
            // Delete selected text and insert uppercase
            range.deleteContents();
            const textNode = document.createTextNode(uppercaseText);
            range.insertNode(textNode);
            // Move cursor after inserted text
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            handleInput();
          } else {
            // If no selection, wrap current word or apply to next typed text
            // For simplicity, just set a flag that will be handled on next input
            execCommand('styleWithCSS', 'true');
          }
        }
        break;
      case 'bullet':
        execCommand('insertUnorderedList');
        break;
      case 'clear':
        // Remove all formatting from selection
        execCommand('removeFormat');
        execCommand('unlink'); // Remove links too
        break;
    }
  };

  const isFormatActive = (format: string): boolean => {
    if (!editorRef.current) return false;
    
    switch (format) {
      case 'bold':
        return document.queryCommandState('bold');
      case 'underline':
        return document.queryCommandState('underline');
      case 'strikethrough':
        return document.queryCommandState('strikethrough');
      default:
        return false;
    }
  };

  return (
    <div className={cn("border border-primary/20 rounded-md bg-white dark:bg-gray-800/80", className)}>
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-primary/10 bg-gray-50 dark:bg-gray-900/50 rounded-t-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isFormatActive('bold') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('bold')}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
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
          title="Underline"
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
        <div className="w-px h-5 bg-border mx-1" />
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
          onClick={() => formatText('bullet')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
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
          "min-h-[60px] p-3 outline-none text-sm",
          "focus:ring-2 focus:ring-primary/20 focus:border-primary",
          !value && "text-muted-foreground",
          rows === 3 && "min-h-[60px]",
          rows === 4 && "min-h-[80px]",
          rows === 5 && "min-h-[100px]",
        )}
        style={{
          minHeight: `${rows * 20}px`,
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      
      {/* Placeholder styling */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}


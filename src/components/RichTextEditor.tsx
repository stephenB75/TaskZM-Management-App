import React, { useRef, useEffect, useState } from 'react';
// Icons migrated to Icon component
import { Icon } from './Icon';
import { COMPONENT_DIMENSIONS, ICON_SIZE_MD } from '../lib/layout-constants';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { UI_RICH_TEXT_COLORS } from '../lib/ui-colors';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  /** Notes field: editor only, formatting stays in task settings. */
  compact?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  className,
  rows = 3,
  disabled = false,
  compact = false,
}: RichTextEditorProps) {
  const { actualTheme } = useTheme();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Standard font size: 12pt (12px)
  const STANDARD_FONT_SIZE = '12px';

  // Normalize font sizes to 12pt
  const normalizeFontSizes = (element: HTMLElement) => {
    // Remove all font size styles and set to 12pt
    const allElements = element.querySelectorAll('*');
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style.fontSize) {
        htmlEl.style.fontSize = STANDARD_FONT_SIZE;
      }
    });
    
    // Also handle font tags with size attribute
    const fontTags = element.querySelectorAll('font[size]');
    fontTags.forEach((font) => {
      const span = document.createElement('span');
      span.style.fontSize = STANDARD_FONT_SIZE;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  };

  // Initialize editor content
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Get current content (strip HTML tags for comparison)
    const currentText = editorRef.current.innerText || editorRef.current.textContent || '';
    const newText = value ? (value.replace(/<[^>]*>/g, '') || value) : '';
    
    // Only update if content actually changed (compare text content, not HTML)
    if (currentText.trim() !== newText.trim()) {
      // If value is plain text without HTML tags, wrap it in paragraph tags
      if (value && !value.trim().match(/^<[^>]+>/)) {
        // Plain text - wrap in paragraph tags for proper formatting
        // Trim leading/trailing whitespace and ensure sentences start at first line
        const paragraphs = value.split('\n').map(p => p.trim()).filter(p => p.length > 0);
        if (paragraphs.length > 0) {
          editorRef.current.innerHTML = paragraphs.map((p, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === paragraphs.length - 1;
            const marginTop = isFirst ? '0' : '0.5rem';
            const marginBottom = isLast ? '0' : '0';
            return `<p style="font-size: ${STANDARD_FONT_SIZE}; margin-top: ${marginTop}; margin-bottom: ${marginBottom}; padding: 0; text-align: left; text-indent: 0;">${p.trim()}</p>`;
          }).join('');
        } else {
          editorRef.current.innerHTML = '';
        }
      } else {
        // HTML content - ensure proper formatting with no leading whitespace
        let htmlContent = value || '';
        // Remove leading/trailing whitespace from HTML content
        htmlContent = htmlContent.trim();
        // Ensure paragraphs don't have leading whitespace and start at first line
        // Improved spacing: normalize paragraph margins (will be handled by CSS classes)
        htmlContent = htmlContent.replace(/<p[^>]*>\s+/g, '<p style="font-size: ' + STANDARD_FONT_SIZE + '; margin-top: 0; margin-bottom: 0; padding: 0; text-align: left; text-indent: 0;">');
        htmlContent = htmlContent.replace(/\s+<\/p>/g, '</p>');
        // Remove text-indent from all paragraphs
        htmlContent = htmlContent.replace(/text-indent[^;]*;?/g, 'text-indent: 0;');
        editorRef.current.innerHTML = htmlContent;
        // Normalize font sizes after setting HTML
        normalizeFontSizes(editorRef.current);
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      // Normalize font sizes on input
      normalizeFontSizes(editorRef.current);
      
      // Ensure all paragraphs have 12pt font size
      const paragraphs = editorRef.current.querySelectorAll('p');
      paragraphs.forEach((p) => {
        (p as HTMLElement).style.fontSize = STANDARD_FONT_SIZE;
      });
      
      // Ensure the editor itself has 12pt font size
      editorRef.current.style.fontSize = STANDARD_FONT_SIZE;
      
      // Auto-expand editor height based on content (up to max height)
      // Defer scrollHeight read to prevent forced reflow
      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        const contentHeight = editorRef.current.scrollHeight;
        const minHeight = rows * 20; // rows * 20px per row
        const maxHeight = COMPONENT_DIMENSIONS.taskDialog.descriptionTextarea.maxHeight;
        const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
        editorRef.current.style.height = 'auto';
        editorRef.current.style.minHeight = `${newHeight}px`;
      });
      
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    
    // Convert plain text to paragraphs with 12pt font size, ensuring sentences start at first line
    // Improved spacing: first paragraph no top margin, consistent spacing between paragraphs
    const paragraphs = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const formattedText = paragraphs.length > 0
      ? paragraphs.map((p, idx) => {
          const isFirst = idx === 0;
          const marginTop = isFirst ? '0' : '0.5rem';
          return `<p style="font-size: ${STANDARD_FONT_SIZE}; margin-top: ${marginTop}; margin-bottom: 0; padding: 0; text-align: left; text-indent: 0;">${p}</p>`;
        }).join('')
      : `<p style="font-size: ${STANDARD_FONT_SIZE}; margin-top: 0; margin-bottom: 0; padding: 0; text-align: left; text-indent: 0;">${text.trim()}</p>`;
    
    // Insert the formatted text
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = formattedText;
      
      const fragment = document.createDocumentFragment();
      while (tempContainer.firstChild) {
        fragment.appendChild(tempContainer.firstChild);
      }
      
      range.insertNode(fragment);
      
      // Move cursor to end of inserted content
      range.setStartAfter(fragment.lastChild || fragment);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When Enter is pressed, ensure new paragraphs have 12pt font size
    if (e.key === 'Enter') {
      setTimeout(() => {
        if (editorRef.current) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            
            // Find the paragraph element
            let paragraph: HTMLElement | null = null;
            if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
              paragraph = container.parentElement.closest('p') as HTMLElement;
            } else if (container.nodeType === Node.ELEMENT_NODE) {
              paragraph = (container as HTMLElement).closest('p') as HTMLElement;
            }
            
            // Set font size to 12pt for the new paragraph
            if (paragraph) {
              paragraph.style.fontSize = STANDARD_FONT_SIZE;
            }
          }
        }
      }, 0);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
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
        execCommand('backColor', UI_RICH_TEXT_COLORS.highlight);
        break;
      case 'code':
        // Wrap selection in code tags
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (selectedText) {
            const codeNode = document.createElement('code');
            codeNode.style.backgroundColor = actualTheme === 'dark' 
              ? UI_RICH_TEXT_COLORS.codeBackground.dark 
              : UI_RICH_TEXT_COLORS.codeBackground.light;
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
        // Ensure font size is reset to 12pt
        if (editorRef.current) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (!range.collapsed) {
              const selectedElement = range.commonAncestorContainer;
              if (selectedElement.nodeType === Node.TEXT_NODE && selectedElement.parentElement) {
                selectedElement.parentElement.style.fontSize = STANDARD_FONT_SIZE;
              } else if (selectedElement.nodeType === Node.ELEMENT_NODE) {
                (selectedElement as HTMLElement).style.fontSize = STANDARD_FONT_SIZE;
              }
            }
          }
        }
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
        "border rounded-xl bg-white/80 dark:bg-background/70 backdrop-blur-sm shadow-sm",
        "border-primary/10",
        className
      )}
    >
      {/* Formatting Toolbar */}
      {!compact && (
      <div className={cn(
        "flex flex-nowrap items-center gap-1 overflow-x-auto p-1 border-b border-primary/10 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 rounded-t-xl",
        disabled && "opacity-60 pointer-events-none"
      )}>
        {/* Text Formatting Group */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('bold') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('bold')}
          title="Bold (Ctrl+B)"
        >
          <Icon name="bold" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('italic') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('italic')}
          title="Italic (Ctrl+I)"
        >
          <Icon name="italic" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('underline') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('underline')}
          title="Underline (Ctrl+U)"
        >
          <Icon name="underline" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('strikethrough') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('strikethrough')}
          title="Strikethrough"
        >
          <Icon name="strikethrough" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Highlight & Code */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('highlight')}
          title="Highlight"
        >
          <Icon name="highlighter" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('code')}
          title="Code"
        >
          <Icon name="code" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('bullet') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('bullet')}
          title="Bullet List"
        >
          <Icon name="list" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('numbered') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('numbered')}
          title="Numbered List"
        >
          <Icon name="list-ordered" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Text Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('alignLeft') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignLeft')}
          title="Align Left"
        >
          <Icon name="align-left" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('alignCenter') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignCenter')}
          title="Align Center"
        >
          <Icon name="align-center" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('alignRight') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignRight')}
          title="Align Right"
        >
          <Icon name="align-right" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 rounded-full p-0 leading-none",
            isFormatActive('alignJustify') && "bg-primary/10 text-primary"
          )}
          onClick={() => formatText('alignJustify')}
          title="Justify"
        >
          <Icon name="align-justify" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Paragraph Format */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('paragraph')}
          title="Paragraph (Press Enter for new paragraph)"
        >
          <Icon name="pilcrow" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Indentation */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('outdent')}
          title="Decrease Indent"
        >
          <Icon name="outdent" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('indent')}
          title="Increase Indent"
        >
          <Icon name="indent" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Text Transform */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('uppercase')}
          title="Uppercase"
        >
          <Icon name="type" size={ICON_SIZE_MD} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('lowercase')}
          title="Lowercase"
        >
          <Icon name="type" size={ICON_SIZE_MD} />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        
        {/* Clear Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 leading-none"
          onClick={() => formatText('clear')}
          title="Clear Formatting"
        >
          <Icon name="eraser" size={ICON_SIZE_MD} />
        </Button>
      </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={disabled ? undefined : handleInput}
        onPaste={disabled ? undefined : handlePaste}
        onKeyDown={disabled ? undefined : handleKeyDown}
        onFocus={() => !disabled && setIsFocused(true)}
        onBlur={() => !disabled && setIsFocused(false)}
        className={cn(
          "min-h-[60px] p-3 outline-none",
          compact ? "rounded-xl" : "rounded-b-xl",
          "focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
          !value && "text-muted-foreground",
          disabled && "cursor-not-allowed opacity-60",
          rows === 3 && "min-h-[60px]",
          rows === 4 && "min-h-[80px]",
          rows === 5 && "min-h-[100px]",
          // Allow content to expand and wrap naturally
          "overflow-y-auto",
          "break-words whitespace-pre-wrap",
          // List styling - ensure lists are visible and properly formatted
          "[&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-1 [&_ul]:space-y-1 [&_ul]:block",
          "[&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:my-1 [&_ol]:space-y-1 [&_ol]:block",
          "[&_li]:ml-2 [&_li]:leading-relaxed [&_li]:block",
          // Paragraph and indentation styling - ensure sentences start at first line
          // Improved spacing: first paragraph no top margin, last paragraph no bottom margin, consistent spacing between
          "[&_p]:leading-relaxed [&_p]:block [&_p]:empty:hidden [&_p]:pl-0 [&_p]:ml-0 [&_p]:text-left [&_p]:mt-0 [&_p]:mb-0",
          "[&_p:not(:first-child)]:mt-2 [&_p:not(:last-child)]:mb-0",
          "[&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
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
          "[&_code]:bg-muted [&_code]:dark:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:inline-block",
          // Ensure proper display of formatted text
          "[&_strong]:font-bold [&_b]:font-bold",
          "[&_em]:italic [&_i]:italic",
          "[&_u]:underline",
          "[&_s]:line-through [&_strike]:line-through",
        )}
        style={{
          minHeight: `${rows * 20}px`,
          maxHeight: `${COMPONENT_DIMENSIONS.taskDialog.descriptionTextarea.maxHeight}px`,
          fontSize: STANDARD_FONT_SIZE,
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      
      {/* Placeholder and list styling */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: ${UI_RICH_TEXT_COLORS.muted};
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


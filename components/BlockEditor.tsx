
import React, { useState, useRef, useEffect } from 'react';
import { ContentBlock, BlockType } from '../types';
import { Icons } from './Icons';
import { generateBlogContent } from '../services/geminiService';

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  readOnly?: boolean;
}

// Robust ContentEditable component
const RichText = ({ 
  html, 
  tagName, 
  className, 
  onChange, 
  placeholder, 
  onKeyDown, 
  onPaste,
  readOnly,
  autoFocus,
  onFocus,
  style
}: any) => {
  const contentEditableRef = useRef<HTMLElement>(null);

  // Sync Content: Prop -> DOM
  // Crucial: Only update DOM if we are NOT focused on it, to prevent cursor jumping.
  useEffect(() => {
    if (contentEditableRef.current && html !== contentEditableRef.current.innerHTML) {
        if (document.activeElement !== contentEditableRef.current) {
            contentEditableRef.current.innerHTML = html;
        }
    }
  }, [html]);

  // Initial Render Sync
  useEffect(() => {
    if (contentEditableRef.current) {
        if (contentEditableRef.current.innerHTML !== html) {
            contentEditableRef.current.innerHTML = html;
        }
    }
  }, []);

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  useEffect(() => {
      if(autoFocus && contentEditableRef.current) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(contentEditableRef.current);
          range.collapse(false);
          if(sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          contentEditableRef.current.focus();
      }
  }, [autoFocus]);

  return React.createElement(tagName, {
    ref: contentEditableRef,
    className: `${className} empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 cursor-text outline-none`,
    contentEditable: !readOnly,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    onInput: handleInput,
    onBlur: handleInput,
    onFocus: onFocus,
    onKeyDown: onKeyDown,
    onPaste: onPaste,
    style: style
  });
};

const TEXT_COLORS = [
    { label: 'Default', value: '#292524' }, // Stone 800
    { label: 'Rose', value: '#be185d' },
    { label: 'Emerald', value: '#059669' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Amber', value: '#d97706' },
    { label: 'Purple', value: '#7e22ce' },
    { label: 'Gray', value: '#78716c' },
];

export const BlockEditor: React.FC<BlockEditorProps> = ({ blocks, onChange, readOnly = false }) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null); // Focused block (cursor inside)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null); // Hovered block (for controls)
  const [menuOpenBlockId, setMenuOpenBlockId] = useState<string | null>(null); // Open menu dropdown
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [showAiModal, setShowAiModal] = useState<string | null>(null);
  
  // Selection state for Floating Toolbar
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuOpenBlockId && !(event.target as Element).closest('.block-menu-trigger')) {
              setMenuOpenBlockId(null);
          }
          // Close floating toolbar if clicking elsewhere
          if (showToolbar && editorRef.current && !editorRef.current.contains(event.target as Node)) {
              setShowToolbar(false);
              setShowColorPicker(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenBlockId, showToolbar]);

  // --- Block Management ---

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    if (readOnly) return;
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    onChange(newBlocks);
    setMenuOpenBlockId(null); // Close menu after selection
  };

  const addBlock = (afterId: string, type: BlockType = BlockType.Paragraph) => {
    if (readOnly) return;
    const newBlock: ContentBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      width: 100,
      align: 'left'
    };
    const index = blocks.findIndex(b => b.id === afterId);
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
    // Use a timeout to ensure DOM is ready before focusing
    setTimeout(() => setActiveBlockId(newBlock.id), 10);
  };

  const removeBlock = (id: string) => {
    if (readOnly || blocks.length <= 1) return;
    const index = blocks.findIndex(b => b.id === id);
    const newBlocks = blocks.filter(b => b.id !== id);
    onChange(newBlocks);
    if (index > 0) {
        setActiveBlockId(newBlocks[index - 1].id);
    }
  };

  // --- Rich Text Handling ---

  const execCommand = (command: string, value: any = null) => {
    document.execCommand(command, false, value);
    if (activeBlockId) {
        const el = document.getElementById(`block-${activeBlockId}`);
        if (el) {
            updateBlock(activeBlockId, { content: el.innerHTML });
        }
    }
  };

  const checkSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowToolbar(false);
      setShowColorPicker(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current?.getBoundingClientRect();

    if (editorRect && editorRef.current?.contains(selection.anchorNode)) {
      setToolbarPosition({
        top: rect.top - editorRect.top - 50,
        left: rect.left - editorRect.left + (rect.width / 2) - 140
      });
      setShowToolbar(true);
    }
  };

  useEffect(() => {
    if (!readOnly) {
        document.addEventListener('selectionchange', checkSelection);
        return () => document.removeEventListener('selectionchange', checkSelection);
    }
  }, [readOnly]);

  // --- Media Handlers ---

  const handlePaste = (e: React.ClipboardEvent, id: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    updateBlock(id, { type: BlockType.Image, src: event.target?.result as string, content: '' });
                };
                reader.readAsDataURL(blob);
            }
            return;
        }
    }
  };

  // --- AI Generation ---

  const handleAiGenerate = async (targetBlockId: string) => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    
    const prevIndex = blocks.findIndex(b => b.id === targetBlockId) - 1;
    const context = prevIndex >= 0 ? blocks[prevIndex].content : '';

    const generatedText = await generateBlogContent(aiPrompt, context);
    const cleanText = generatedText.replace(/```html/g, '').replace(/```/g, '');

    updateBlock(targetBlockId, { content: cleanText });
    setIsGenerating(false);
    setShowAiModal(null);
    setAiPrompt('');
  };

  // --- Rendering Helpers ---

  const renderBlockContent = (block: ContentBlock) => {
    const commonClasses = `w-full bg-transparent resize-none placeholder:text-stone-300 ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left'}`;
    const isFocused = activeBlockId === block.id;

    const commonProps = {
        html: block.content,
        onChange: (val: string) => updateBlock(block.id, { content: val }),
        onFocus: () => setActiveBlockId(block.id),
        onKeyDown: (e: any) => {
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addBlock(block.id, BlockType.Paragraph);
            }
            if (e.key === 'Backspace' && !block.content) {
                e.preventDefault();
                removeBlock(block.id);
            }
        },
        onPaste: (e: any) => handlePaste(e, block.id),
        readOnly,
        className: commonClasses,
        autoFocus: isFocused // Only auto-focus if this block is explicitly active
    };

    switch (block.type) {
      case BlockType.Heading1:
        // Explicit styles to ensure visual hierarchy
        return <RichText tagName="h1" style={{ fontSize: '3.75rem', lineHeight: '1.1', fontWeight: 700 }} className={`font-serif mb-6 mt-10 text-stone-900 ${commonClasses}`} placeholder="Heading 1" {...commonProps} />;
      case BlockType.Heading2:
        return <RichText tagName="h2" style={{ fontSize: '2.5rem', lineHeight: '1.2', fontWeight: 700 }} className={`font-serif mb-4 mt-8 text-stone-800 ${commonClasses}`} placeholder="Heading 2" {...commonProps} />;
      case BlockType.Heading3:
        return <RichText tagName="h3" style={{ fontSize: '1.75rem', lineHeight: '1.3', fontWeight: 600 }} className={`font-serif mb-3 mt-6 text-stone-800 ${commonClasses}`} placeholder="Heading 3" {...commonProps} />;
      case BlockType.Quote:
        return (
             <div className="flex gap-4 border-l-4 border-rose-300 pl-4 py-2 bg-stone-50/50 rounded-r-lg my-4">
                <Icons.Quote className="text-stone-300 flex-shrink-0" size={24} />
                <RichText tagName="div" className={`text-xl font-serif italic text-stone-700 ${commonClasses}`} placeholder="Empty quote..." {...commonProps} />
             </div>
        );
      case BlockType.Code:
        return (
            <div className="bg-stone-900 rounded-lg p-4 my-4 relative group">
                <div className="absolute right-2 top-2 text-xs text-stone-500">{block.language || 'Code'}</div>
                <RichText tagName="pre" className={`font-mono text-sm text-stone-200 ${commonClasses}`} placeholder="Write code..." {...commonProps} />
            </div>
        );
      case BlockType.List:
        return (
            <div className="flex gap-3 items-start my-2">
                <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-stone-800 flex-shrink-0" />
                <RichText tagName="div" className={`text-lg leading-relaxed ${commonClasses}`} placeholder="List item" {...commonProps} />
            </div>
        );
      case BlockType.OrderedList:
         return (
            <div className="flex gap-3 items-start my-2">
                <span className="mt-1 font-bold text-stone-400 select-none">1.</span>
                <RichText tagName="div" className={`text-lg leading-relaxed ${commonClasses}`} placeholder="List item" {...commonProps} />
            </div>
        );
      case BlockType.Image:
        return <MediaBlock block={block} updateBlock={updateBlock} readOnly={readOnly} isVideo={false} />;
      case BlockType.Video:
        return <MediaBlock block={block} updateBlock={updateBlock} readOnly={readOnly} isVideo={true} />;
      case BlockType.Divider:
        return <hr className="border-stone-200 my-8" />;
      default: 
        return <RichText tagName="div" className={`text-lg leading-relaxed min-h-[1.5em] text-stone-700 ${commonClasses}`} placeholder="Type '/' for commands..." {...commonProps} />;
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto pb-32" ref={editorRef}>
      
      {/* Floating Formatting Toolbar */}
      {showToolbar && !readOnly && (
        <div 
            className="absolute z-50 bg-stone-900 text-white rounded-lg shadow-xl flex items-center p-1 gap-1 -translate-x-1/2 animate-fade-in"
            style={{ top: toolbarPosition.top, left: '50%' }}
        >
            <ToolbarBtn icon={Icons.Bold} onClick={() => execCommand('bold')} />
            <ToolbarBtn icon={Icons.Italic} onClick={() => execCommand('italic')} />
            <ToolbarBtn icon={Icons.Underline} onClick={() => execCommand('underline')} />
            <ToolbarBtn icon={Icons.Link} onClick={() => {
                const url = prompt('Enter link URL:');
                if (url) execCommand('createLink', url);
            }} />
            
            {/* Color Picker */}
            <div className="relative">
                <ToolbarBtn icon={Icons.Palette} onClick={() => setShowColorPicker(!showColorPicker)} />
                {showColorPicker && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white p-2 rounded-lg shadow-xl border border-stone-200 flex gap-2 z-50 animate-fade-in">
                        {TEXT_COLORS.map(c => (
                            <button
                                key={c.value}
                                className="w-6 h-6 rounded-full border border-stone-200 hover:scale-110 transition-transform"
                                style={{ backgroundColor: c.value }}
                                title={c.label}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent losing focus on editor
                                    execCommand('foreColor', c.value);
                                    setShowColorPicker(false);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-4 bg-stone-700 mx-1"></div>
            <ToolbarBtn icon={Icons.AlignLeft} onClick={() => execCommand('justifyLeft')} />
            <ToolbarBtn icon={Icons.AlignCenter} onClick={() => execCommand('justifyCenter')} />
            <ToolbarBtn icon={Icons.AlignRight} onClick={() => execCommand('justifyRight')} />
        </div>
      )}

      {blocks.map((block) => (
        <div 
          key={block.id} 
          id={`block-${block.id}`}
          className="group relative flex items-start -ml-12 pl-12 mb-2"
          onMouseEnter={() => !readOnly && setHoveredBlockId(block.id)}
          onMouseLeave={() => !readOnly && setHoveredBlockId(null)}
        >
          {/* Controls Gutter */}
          {!readOnly && (
            <div className={`absolute left-0 top-1.5 flex gap-1 transition-opacity duration-200 ${hoveredBlockId === block.id || menuOpenBlockId === block.id ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={() => addBlock(block.id)} className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-600 transition-colors">
                    <Icons.Plus size={16} />
                </button>
                <div className="relative">
                    <button 
                        className={`p-1 rounded text-stone-400 hover:text-stone-600 cursor-pointer block-menu-trigger transition-colors ${menuOpenBlockId === block.id ? 'bg-stone-100 text-stone-900' : 'hover:bg-stone-100'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            // Toggle Menu
                            setMenuOpenBlockId(menuOpenBlockId === block.id ? null : block.id);
                        }}
                    >
                        <Icons.MoreHorizontal size={16} />
                    </button>
                    
                    {/* Block Type Switcher */}
                    {menuOpenBlockId === block.id && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-stone-100 shadow-xl rounded-xl overflow-hidden z-20 py-1 animate-fade-in block-menu-trigger">
                            <div className="px-4 py-2 text-xs font-bold text-stone-400 uppercase tracking-wider bg-stone-50 border-b border-stone-50">Turn into</div>
                            <TypeOption label="Text" icon={Icons.Type} onClick={() => updateBlock(block.id, { type: BlockType.Paragraph })} />
                            {/* Visualized Headings in Menu */}
                            <TypeOption label="Heading 1" icon={Icons.Type} style={{ fontSize: '1.5rem', fontWeight: 'bold' }} onClick={() => updateBlock(block.id, { type: BlockType.Heading1 })} />
                            <TypeOption label="Heading 2" icon={Icons.Type} style={{ fontSize: '1.25rem', fontWeight: 'bold' }} onClick={() => updateBlock(block.id, { type: BlockType.Heading2 })} />
                            <TypeOption label="Heading 3" icon={Icons.Type} style={{ fontSize: '1.1rem', fontWeight: 'bold' }} onClick={() => updateBlock(block.id, { type: BlockType.Heading3 })} />
                            <TypeOption label="Bullet List" icon={Icons.List} onClick={() => updateBlock(block.id, { type: BlockType.List })} />
                            <TypeOption label="Numbered List" icon={Icons.ListOrdered} onClick={() => updateBlock(block.id, { type: BlockType.OrderedList })} />
                            <TypeOption label="Quote" icon={Icons.Quote} onClick={() => updateBlock(block.id, { type: BlockType.Quote })} />
                            <TypeOption label="Code Block" icon={Icons.Code} onClick={() => updateBlock(block.id, { type: BlockType.Code })} />
                            <div className="px-4 py-2 text-xs font-bold text-stone-400 uppercase tracking-wider bg-stone-50 border-b border-stone-50 border-t mt-1">Insert</div>
                            <TypeOption label="Image" icon={Icons.Image} onClick={() => updateBlock(block.id, { type: BlockType.Image })} />
                            <TypeOption label="Video Embed" icon={Icons.Video} onClick={() => updateBlock(block.id, { type: BlockType.Video })} />
                            <TypeOption label="Divider" icon={Icons.Minus} onClick={() => updateBlock(block.id, { type: BlockType.Divider })} />
                            <div className="h-px bg-stone-100 my-1"></div>
                            <button onClick={() => removeBlock(block.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                <Icons.Trash2 size={14}/> Delete Block
                            </button>
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* Block Content */}
          <div className="w-full relative">
             {/* AI Prompt Button */}
             {activeBlockId === block.id && block.type === BlockType.Paragraph && !block.content && !readOnly && (
                <button 
                    onClick={() => setShowAiModal(block.id)}
                    className="absolute -top-7 left-0 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-100 transition-colors"
                >
                    <Icons.Sparkles size={10} /> AI WRITER
                </button>
            )}

            {renderBlockContent(block)}
          </div>

           {/* AI Modal */}
           {showAiModal === block.id && (
             <div className="absolute top-full left-0 mt-2 z-30 w-full max-w-md bg-white rounded-xl shadow-2xl border border-purple-100 p-4 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                        <Icons.Sparkles size={12}/> Gemini Assistant
                    </span>
                    <button onClick={() => setShowAiModal(null)}><Icons.X size={14} className="text-stone-400"/></button>
                </div>
                <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ask Gemini to write..."
                    className="w-full text-sm border-b border-stone-200 pb-2 mb-3 outline-none focus:border-purple-300"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate(block.id)}
                />
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => handleAiGenerate(block.id)}
                        disabled={isGenerating || !aiPrompt}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGenerating ? 'Thinking...' : 'Generate'}
                    </button>
                </div>
             </div>
          )}
        </div>
      ))}

      {!readOnly && (
          <button 
            onClick={() => addBlock(blocks[blocks.length-1].id, BlockType.Paragraph)} 
            className="w-full py-4 text-stone-300 hover:text-stone-500 text-sm flex items-center justify-center gap-2 transition-colors border-t border-transparent hover:border-stone-100 mt-8"
          >
              <Icons.Plus size={14}/> Add block at end
          </button>
      )}
    </div>
  );
};

// --- Sub Components ---

const ToolbarBtn = ({ icon: Icon, onClick }: { icon: any, onClick: () => void }) => (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} className="p-1.5 hover:bg-stone-700 rounded text-stone-300 hover:text-white transition-colors">
        <Icon size={14} />
    </button>
);

const TypeOption = ({ label, icon: Icon, onClick, style }: { label: string, icon: any, onClick: () => void, style?: React.CSSProperties }) => (
    <button onClick={onClick} className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-3 text-stone-700 transition-colors">
        <Icon size={14} className="text-stone-400 flex-shrink-0"/> <span style={style}>{label}</span>
    </button>
);

const MediaBlock = ({ block, updateBlock, readOnly, isVideo }: { block: ContentBlock, updateBlock: any, readOnly: boolean, isVideo: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleResize = (e: React.MouseEvent) => {
        if (readOnly) return;
        const startX = e.clientX;
        const startWidth = containerRef.current?.offsetWidth || 0;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;

        const onMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startX;
            const newWidthPx = startWidth + diff;
            const newWidthPercent = Math.min(100, Math.max(20, (newWidthPx / parentWidth) * 100));
            updateBlock(block.id, { width: newWidthPercent });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    if (!block.src && !block.content) {
        return (
            <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl p-8 text-center hover:bg-stone-100 transition-colors">
                {isVideo ? <Icons.Video className="mx-auto text-stone-300 mb-2" size={32} /> : <Icons.Image className="mx-auto text-stone-300 mb-2" size={32} />}
                <p className="text-stone-500 text-sm mb-4">{isVideo ? 'Embed Video' : 'Upload Image'}</p>
                {isVideo ? (
                    <input 
                        type="text" 
                        placeholder="Paste YouTube URL..." 
                        className="w-full max-w-sm mx-auto px-4 py-2 border border-stone-300 rounded-lg text-sm"
                        onBlur={(e) => {
                            let url = e.target.value;
                            if(url.includes('youtube.com/watch?v=')) {
                                url = url.replace('watch?v=', 'embed/');
                            } else if (url.includes('youtu.be/')) {
                                url = url.replace('youtu.be/', 'youtube.com/embed/');
                            }
                            updateBlock(block.id, { src: url });
                        }}
                    />
                ) : (
                    <label className="cursor-pointer bg-white border border-stone-300 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium inline-block">
                        Choose File
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                               const reader = new FileReader();
                               reader.onloadend = () => updateBlock(block.id, { src: reader.result });
                               reader.readAsDataURL(file);
                             }
                        }} />
                    </label>
                )}
            </div>
        );
    }

    return (
        <div 
            className={`relative group/media my-6 flex ${block.align === 'center' ? 'justify-center' : block.align === 'right' ? 'justify-end' : 'justify-start'}`}
        >
            <div 
                ref={containerRef}
                className="relative rounded-lg overflow-hidden shadow-sm"
                style={{ width: `${block.width || 100}%` }}
            >
                {isVideo ? (
                    <iframe 
                        src={block.src} 
                        className="w-full aspect-video" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                ) : (
                    <img src={block.src} alt="Block media" className="w-full h-auto" />
                )}
                
                {!readOnly && (
                    <div 
                        onMouseDown={handleResize}
                        className="absolute right-2 bottom-2 w-6 h-6 bg-white rounded-full shadow cursor-ew-resize flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity z-10"
                    >
                        <Icons.Move size={12} />
                    </div>
                )}
                
                {!readOnly && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-lg p-1 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                         <button onClick={() => updateBlock(block.id, { align: 'left' })} className="p-1 hover:bg-stone-100 rounded"><Icons.AlignLeft size={12}/></button>
                         <button onClick={() => updateBlock(block.id, { align: 'center' })} className="p-1 hover:bg-stone-100 rounded"><Icons.AlignCenter size={12}/></button>
                         <button onClick={() => updateBlock(block.id, { align: 'right' })} className="p-1 hover:bg-stone-100 rounded"><Icons.AlignRight size={12}/></button>
                    </div>
                )}
            </div>
        </div>
    );
};

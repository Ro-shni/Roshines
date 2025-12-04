import React, { useState, useRef, useCallback } from 'react';
import { ContentBlock, BlockType } from '../types';
import { Icons } from './Icons';
import { generateBlogContent } from '../services/geminiService';

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ blocks, onChange }) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [showAiModal, setShowAiModal] = useState<string | null>(null); // Block ID to insert after

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    onChange(newBlocks);
  };

  const addBlock = (afterId: string, type: BlockType = BlockType.Paragraph) => {
    const newBlock: ContentBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      width: 100
    };
    const index = blocks.findIndex(b => b.id === afterId);
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
    setActiveBlockId(newBlock.id);
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return;
    onChange(blocks.filter(b => b.id !== id));
  };

  const handleAiGenerate = async (targetBlockId: string) => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    
    // Get context from previous block
    const prevIndex = blocks.findIndex(b => b.id === targetBlockId) - 1;
    const context = prevIndex >= 0 ? blocks[prevIndex].content : '';

    const generatedText = await generateBlogContent(aiPrompt, context);
    
    updateBlock(targetBlockId, { content: generatedText });
    setIsGenerating(false);
    setShowAiModal(null);
    setAiPrompt('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateBlock(id, { src: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      {blocks.map((block, index) => (
        <div 
          key={block.id} 
          className="group relative flex items-start -ml-12 pl-12"
          onMouseEnter={() => setActiveBlockId(block.id)}
        >
          {/* Block Controls (Left Gutter) */}
          <div className={`absolute left-0 top-1.5 flex gap-1 opacity-0 transition-opacity duration-200 ${activeBlockId === block.id ? 'opacity-100' : 'group-hover:opacity-50'}`}>
            <button 
              onClick={() => addBlock(block.id)}
              className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600"
            >
              <Icons.Plus size={16} />
            </button>
            <div className="relative group/menu">
              <button className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 cursor-grab">
                <Icons.MoreHorizontal size={16} />
              </button>
              {/* Type Switcher Dropdown */}
              <div className="absolute left-0 top-full mt-1 w-32 bg-white border border-stone-200 shadow-lg rounded-lg overflow-hidden z-20 hidden group-hover/menu:block">
                 {[
                   { t: BlockType.Paragraph, l: 'Text', i: <Icons.Type size={14}/> },
                   { t: BlockType.Heading1, l: 'Heading 1', i: <Icons.Type size={16} className="font-bold"/> },
                   { t: BlockType.Heading2, l: 'Heading 2', i: <Icons.Type size={14} className="font-semibold"/> },
                   { t: BlockType.Image, l: 'Image', i: <Icons.Image size={14}/> },
                   { t: BlockType.Quote, l: 'Quote', i: <Icons.Quote size={14}/> },
                 ].map(opt => (
                   <button
                    key={opt.t}
                    onClick={() => updateBlock(block.id, { type: opt.t })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                   >
                     {opt.i} {opt.l}
                   </button>
                 ))}
                 <div className="h-px bg-stone-100 my-1"></div>
                 <button 
                  onClick={() => removeBlock(block.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                 >
                   <Icons.Trash2 size={14} /> Delete
                 </button>
              </div>
            </div>
          </div>

          {/* Block Content Renderers */}
          <div className="w-full relative">
            
            {/* AI Assistant Toggle (Floating inside block) */}
            {activeBlockId === block.id && block.type === BlockType.Paragraph && !block.content && (
                <button 
                    onClick={() => setShowAiModal(block.id)}
                    className="absolute -top-8 right-0 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-100 transition-colors"
                >
                    <Icons.Sparkles size={12} /> AI Assist
                </button>
            )}

            {block.type === BlockType.Heading1 && (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                placeholder="Heading 1"
                className="w-full text-4xl font-serif font-bold bg-transparent outline-none resize-none overflow-hidden placeholder:text-stone-300"
                rows={1}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto'; 
                    target.style.height = target.scrollHeight + 'px';
                }}
              />
            )}

            {block.type === BlockType.Heading2 && (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                placeholder="Heading 2"
                className="w-full text-2xl font-serif font-semibold bg-transparent outline-none resize-none overflow-hidden placeholder:text-stone-300 mt-4 mb-2"
                rows={1}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto'; 
                    target.style.height = target.scrollHeight + 'px';
                }}
              />
            )}

            {block.type === BlockType.Paragraph && (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                placeholder="Type '/' for commands or just start writing..."
                className="w-full text-lg font-sans leading-relaxed bg-transparent outline-none resize-none overflow-hidden placeholder:text-stone-300 min-h-[1.5em]"
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto'; 
                    target.style.height = target.scrollHeight + 'px';
                }}
              />
            )}

            {block.type === BlockType.Quote && (
              <div className="flex gap-4 border-l-4 border-rose-300 pl-4 py-2 bg-stone-100/50 rounded-r-lg">
                <Icons.Quote className="text-stone-300 flex-shrink-0" size={24} />
                <textarea
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    placeholder="Enter quote..."
                    className="w-full text-xl font-serif italic bg-transparent outline-none resize-none overflow-hidden placeholder:text-stone-300"
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto'; 
                        target.style.height = target.scrollHeight + 'px';
                    }}
                />
              </div>
            )}

            {block.type === BlockType.Image && (
              <div className="relative group/image rounded-xl overflow-hidden bg-stone-100 min-h-[200px] flex items-center justify-center border border-stone-200">
                {block.src ? (
                  <div className="relative w-full flex flex-col items-center">
                    <img 
                        src={block.src} 
                        alt="Block media" 
                        className="object-cover transition-all duration-300"
                        style={{ width: `${block.width || 100}%` }}
                    />
                    
                    {/* Width Resizer Overlay */}
                    <div className="absolute bottom-4 bg-white/90 backdrop-blur border border-stone-200 rounded-full px-3 py-1 flex gap-2 opacity-0 group-hover/image:opacity-100 transition-opacity shadow-sm">
                        {[25, 50, 75, 100].map(w => (
                            <button
                                key={w}
                                onClick={() => updateBlock(block.id, { width: w })}
                                className={`text-xs font-medium px-2 py-1 rounded hover:bg-stone-200 ${block.width === w ? 'bg-stone-800 text-white hover:bg-stone-700' : 'text-stone-600'}`}
                            >
                                {w}%
                            </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Icons.Image className="mx-auto text-stone-300 mb-2" size={32} />
                    <p className="text-stone-400 text-sm mb-4">Upload an image</p>
                    <label className="cursor-pointer bg-white border border-stone-300 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium">
                      Choose File
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, block.id)}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Modal */}
          {showAiModal === block.id && (
             <div className="absolute top-full left-0 mt-2 z-30 w-full bg-white rounded-xl shadow-xl border border-purple-100 p-4 animate-fade-in">
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
                    placeholder="e.g., Write a paragraph about slow travel..."
                    className="w-full text-sm border-b border-stone-200 pb-2 mb-3 outline-none focus:border-purple-300"
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => handleAiGenerate(block.id)}
                        disabled={isGenerating || !aiPrompt}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
             </div>
          )}
        </div>
      ))}
    </div>
  );
};

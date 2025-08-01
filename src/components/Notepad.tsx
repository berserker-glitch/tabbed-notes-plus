import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Moon, Sun, Eye, Edit3, Save, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Note {
  id: string;
  title: string;
  content: string;
  lastModified: number;
}

const STORAGE_KEY = 'notepad-notes';
const LAST_ACTIVE_KEY = 'notepad-last-active';

export function Notepad() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [isRenamingTab, setIsRenamingTab] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Initialize theme
  useEffect(() => {
    const saved = localStorage.getItem('notepad-theme');
    const dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY);
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    
    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes);
      setNotes(parsedNotes);
      
      if (lastActive && parsedNotes.some((n: Note) => n.id === lastActive)) {
        setActiveNoteId(lastActive);
      } else if (parsedNotes.length > 0) {
        setActiveNoteId(parsedNotes[0].id);
      }
    } else {
      // Create first note
      const firstNote: Note = {
        id: '1',
        title: 'Welcome',
        content: '# Welcome to Smart Notepad\n\nThis is your first note. You can:\n\n- **Add new tabs** with Ctrl+T\n- **Close tabs** with Ctrl+W  \n- **Save** with Ctrl+S\n- **Rename tabs** by double-clicking\n- **Toggle theme** with the button\n- **Preview Markdown** with the eye icon\n\nYour notes are automatically saved!',
        lastModified: Date.now()
      };
      setNotes([firstNote]);
      setActiveNoteId(firstNote.id);
    }
  }, []);

  // Save to localStorage
  const saveNotes = useCallback((notesToSave: Note[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  }, []);

  // Debounced autosave
  const debouncedSave = useCallback((content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (activeNoteId) {
        setNotes(prev => {
          const updated = prev.map(note => 
            note.id === activeNoteId 
              ? { ...note, content, lastModified: Date.now() }
              : note
          );
          saveNotes(updated);
          return updated;
        });
      }
    }, 500);
  }, [activeNoteId, saveNotes]);

  // Get active note
  const activeNote = notes.find(note => note.id === activeNoteId);

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    // Update immediately in state for responsiveness
    setNotes(prev => prev.map(note => 
      note.id === activeNoteId ? { ...note, content } : note
    ));
    // Debounce the localStorage save
    debouncedSave(content);
  };

  // Create new note
  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Untitled',
      content: '',
      lastModified: Date.now()
    };
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    setActiveNoteId(newNote.id);
    saveNotes(updatedNotes);
    localStorage.setItem(LAST_ACTIVE_KEY, newNote.id);
  };

  // Close note
  const closeNote = (noteId: string) => {
    if (notes.length === 1) {
      toast({
        title: "Cannot close last note",
        description: "At least one note must remain open.",
      });
      return;
    }

    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    saveNotes(updatedNotes);

    if (activeNoteId === noteId) {
      const newActive = updatedNotes[0]?.id || null;
      setActiveNoteId(newActive);
      if (newActive) {
        localStorage.setItem(LAST_ACTIVE_KEY, newActive);
      }
    }
  };

  // Switch to note
  const switchToNote = (noteId: string) => {
    setActiveNoteId(noteId);
    localStorage.setItem(LAST_ACTIVE_KEY, noteId);
  };

  // Toggle theme
  const toggleTheme = () => {
    const newDark = !isDarkMode;
    setIsDarkMode(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('notepad-theme', newDark ? 'dark' : 'light');
  };

  // Start tab rename
  const startRename = (noteId: string, currentTitle: string) => {
    setIsRenamingTab(noteId);
    setTempTitle(currentTitle);
  };

  // Save tab rename
  const saveRename = () => {
    if (isRenamingTab && tempTitle.trim()) {
      setNotes(prev => {
        const updated = prev.map(note => 
          note.id === isRenamingTab 
            ? { ...note, title: tempTitle.trim(), lastModified: Date.now() }
            : note
        );
        saveNotes(updated);
        return updated;
      });
    }
    setIsRenamingTab(null);
    setTempTitle('');
  };

  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(notes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setNotes(items);
    saveNotes(items);
  };

  // Manual save
  const manualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (activeNote) {
      saveNotes(notes);
      toast({
        title: "Saved",
        description: `"${activeNote.title}" has been saved.`,
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            createNewNote();
            break;
          case 'w':
            e.preventDefault();
            if (activeNoteId) {
              closeNote(activeNoteId);
            }
            break;
          case 's':
            e.preventDefault();
            manualSave();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNoteId, notes]);

  // Render markdown preview
  const renderMarkdown = (content: string) => {
    return content
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-medium mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="h-screen bg-background flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-card to-background/90 border-b border-border/60 px-6 py-4 shadow-notepad backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <h1 className="text-lg font-semibold text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Smart Notepad
            </h1>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
              className={`gap-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                isMarkdownPreview 
                  ? 'bg-accent/20 text-accent hover:bg-accent/30' 
                  : 'hover:bg-secondary/80'
              }`}
            >
              {isMarkdownPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {isMarkdownPreview ? 'Edit' : 'Preview'}
              </span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={manualSave}
              className="gap-2 rounded-lg hover:bg-secondary/80 hover:scale-105 transition-all duration-200"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {}}
              className="gap-2 rounded-lg hover:bg-secondary/80 hover:scale-105 transition-all duration-200"
            >
              <span className="hidden sm:inline">AI Actions</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewNote}
              className="gap-2 rounded-lg hover:bg-secondary/80 hover:scale-105 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            
            <div className="w-px h-6 bg-border/60 mx-1" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="rounded-lg hover:bg-secondary/80 hover:scale-105 transition-all duration-200"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-gradient-to-b from-background to-notepad-tab-bg border-b border-border/60 px-2 py-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tabs" direction="horizontal">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`flex gap-1 min-w-max transition-all duration-200 ${
                  snapshot.isDraggingOver ? 'bg-accent/10 rounded-lg p-1' : ''
                }`}
              >
                {notes.map((note, index) => (
                  <Draggable key={note.id} draggableId={note.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`group relative flex items-center min-w-0 max-w-48 transition-all duration-300 ease-out ${
                          snapshot.isDragging ? 'rotate-2 scale-105 z-50' : ''
                        } ${
                          activeNoteId === note.id
                            ? 'bg-card shadow-notepad-elevated border border-border/50 rounded-t-lg'
                            : 'bg-notepad-tab-bg hover:bg-notepad-tab-hover hover:shadow-notepad rounded-lg mt-1'
                        }`}
                        style={{
                          ...provided.draggableProps.style,
                          transform: snapshot.isDragging 
                            ? `${provided.draggableProps.style?.transform} rotate(2deg)` 
                            : provided.draggableProps.style?.transform,
                        }}
                      >
                        {/* Drag Handle */}
                        <div
                          {...provided.dragHandleProps}
                          className="flex items-center pl-2 pr-1 py-3 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 min-w-0 flex items-center">
                          {isRenamingTab === note.id ? (
                            <input
                              type="text"
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                              onBlur={saveRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') {
                                  setIsRenamingTab(null);
                                  setTempTitle('');
                                }
                              }}
                              className="bg-transparent border-none outline-none px-2 py-3 text-sm min-w-0 w-full focus:bg-accent/20 rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => switchToNote(note.id)}
                              onDoubleClick={() => startRename(note.id, note.title)}
                              className={`flex-1 px-2 py-3 text-left text-sm truncate transition-all duration-200 rounded ${
                                activeNoteId === note.id
                                  ? 'text-foreground font-medium'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              title={note.title}
                            >
                              {note.title}
                            </button>
                          )}
                        </div>

                        {/* Close Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeNote(note.id);
                          }}
                          className={`mr-2 p-1.5 rounded-full transition-all duration-200 ${
                            activeNoteId === note.id
                              ? 'opacity-60 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive'
                              : 'opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive'
                          }`}
                          aria-label={`Close ${note.title}`}
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {/* Active Tab Indicator */}
                        {activeNoteId === note.id && (
                          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full animate-scale-in" />
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                
                {/* Add New Tab Button */}
                <button
                  onClick={createNewNote}
                  className="flex items-center justify-center w-8 h-8 ml-2 my-1 rounded-lg bg-notepad-tab-bg hover:bg-notepad-tab-hover border border-dashed border-border/60 hover:border-accent/60 transition-all duration-200 hover:scale-105 group"
                  title="Add new note (Ctrl+T)"
                >
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-card relative overflow-hidden">
        {activeNote && (
          <div className="h-full animate-fade-in">
            {isMarkdownPreview ? (
              <div 
                className="h-full p-6 overflow-y-auto prose prose-sm max-w-none font-mono bg-gradient-to-br from-card to-background/50 animate-scale-in"
                dangerouslySetInnerHTML={{ 
                  __html: renderMarkdown(activeNote.content) 
                }}
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={activeNote.content}
                onChange={handleContentChange}
                className="w-full h-full p-6 bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:bg-gradient-to-br focus:from-card focus:to-accent/5 transition-all duration-300"
                placeholder="Start typing your note..."
                spellCheck={false}
                style={{
                  fontFamily: 'Consolas, Menlo, Monaco, "Liberation Mono", "Courier New", monospace',
                  lineHeight: '1.6',
                  letterSpacing: '0.02em'
                }}
              />
            )}
          </div>
        )}
        
        {/* Subtle border gradient for depth */}
        <div className="absolute inset-0 pointer-events-none border border-border/20 rounded-none" />
      </div>

      {/* Status Bar */}
      <footer className="bg-gradient-to-r from-muted to-background/80 border-t border-border/60 px-6 py-3 text-xs text-muted-foreground backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 bg-accent rounded-full" />
              <span className="font-medium">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
            </div>
            {activeNote && (
              <span className="text-muted-foreground/80">
                Last modified: {new Date(activeNote.lastModified).toLocaleString()}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1 text-muted-foreground/70">
            <kbd className="px-1.5 py-0.5 bg-border/40 rounded text-xs">Ctrl+T</kbd>
            <span>New</span>
            <span className="mx-2">•</span>
            <kbd className="px-1.5 py-0.5 bg-border/40 rounded text-xs">Ctrl+W</kbd>
            <span>Close</span>
            <span className="mx-2">•</span>
            <kbd className="px-1.5 py-0.5 bg-border/40 rounded text-xs">Ctrl+S</kbd>
            <span>Save</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
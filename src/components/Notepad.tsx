import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Moon, Sun, Eye, Edit3, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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
      <header className="bg-card border-b border-border px-4 py-3 shadow-notepad">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Smart Notepad</h1>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
              className="gap-2"
            >
              {isMarkdownPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isMarkdownPreview ? 'Edit' : 'Preview'}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={manualSave}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewNote}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-notepad-tab-bg border-b border-border overflow-x-auto">
        <div className="flex min-w-max">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`group flex items-center min-w-0 border-r border-border transition-all duration-200 ${
                activeNoteId === note.id
                  ? 'bg-notepad-tab-active shadow-sm'
                  : 'bg-notepad-tab-bg hover:bg-notepad-tab-hover'
              }`}
            >
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
                  className="bg-transparent border-none outline-none px-4 py-3 text-sm min-w-0 max-w-48"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => switchToNote(note.id)}
                  onDoubleClick={() => startRename(note.id, note.title)}
                  className="flex-1 px-4 py-3 text-left text-sm truncate hover:text-foreground transition-colors"
                  title={note.title}
                >
                  {note.title}
                </button>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeNote(note.id);
                }}
                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-border rounded transition-all"
                aria-label={`Close ${note.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-card">
        {activeNote && (
          <div className="h-full">
            {isMarkdownPreview ? (
              <div 
                className="h-full p-6 overflow-y-auto prose prose-sm max-w-none font-mono"
                dangerouslySetInnerHTML={{ 
                  __html: renderMarkdown(activeNote.content) 
                }}
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={activeNote.content}
                onChange={handleContentChange}
                className="w-full h-full p-6 bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground"
                placeholder="Start typing your note..."
                spellCheck={false}
              />
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <footer className="bg-muted border-t border-border px-4 py-2 text-xs text-muted-foreground flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
          {activeNote && (
            <span>
              Last modified: {new Date(activeNote.lastModified).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Ctrl+T: New • Ctrl+W: Close • Ctrl+S: Save</span>
        </div>
      </footer>
    </div>
  );
}
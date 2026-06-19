import { RecipeNote } from '../types';
import { newId } from './id';
import { readStorage, writeStorage, STORAGE_KEYS } from './storage';

const NOTES_KEY = STORAGE_KEYS.notes;

export function getNotes(): RecipeNote[] {
  return readStorage<RecipeNote[]>(NOTES_KEY, []);
}

export function getRecipeNotes(recipeId: string): RecipeNote[] {
  return getNotes().filter((note) => note.recipeId === recipeId);
}

export function saveNote(note: Omit<RecipeNote, 'id' | 'timestamp'>): RecipeNote {
  const notes = getNotes();
  const newNote: RecipeNote = {
    ...note,
    id: newId(),
    timestamp: Date.now(),
  };
  writeStorage(NOTES_KEY, [...notes, newNote]);
  return newNote;
}

export function deleteNote(id: string) {
  const notes = getNotes();
  writeStorage(
    NOTES_KEY,
    notes.filter((n) => n.id !== id),
  );
}

export function updateNote(id: string, content: string): RecipeNote {
  const notes = getNotes();
  let updatedNote: RecipeNote | undefined;

  const updatedNotes = notes.map((n) => {
    if (n.id === id) {
      updatedNote = { ...n, content, timestamp: Date.now() };
      return updatedNote;
    }
    return n;
  });

  writeStorage(NOTES_KEY, updatedNotes);

  if (!updatedNote) {
    throw new Error(`Note with id ${id} not found`);
  }
  return updatedNote;
}

import { useEffect, useState } from "react";
import Note from "./components/Note";
import type { NoteData } from "./types/notes";
import noteService from "./services/notes";

function App() {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [newNote, setNewNote] = useState<string>("");
  const [showAll, setShowAll] = useState<boolean>(true);

  useEffect(() => {
    console.log("entrando en use effect");
    noteService.getAll().then((data) => {
      console.log("la llamada termino");
      setNotes(data);
    });
  }, []);

  const addNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const noteObject: Omit<NoteData, "id"> = {
      content: newNote,
      important: Math.random() < 0.5,
    };
    noteService.create(noteObject).then((data) => {
      setNotes(notes.concat(data));
      setNewNote("");
    });
  };

  const handleNoteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.value);
    setNewNote(event.target.value);
  };

  const filteredNotes = showAll
    ? notes
    : notes.filter((note) => note.important);

  const toggleImportanceOf = (id: number) => {
    console.log("importance of " + id + " needs to be toggled");

    const note: NoteData | undefined = notes.find((n) => n.id === id);

    if (note) {
      const changedNote = { ...note, important: !note.important };

      noteService
        .update(id, changedNote)
        .then((data) => {
          setNotes(notes.map((n) => (n.id === id ? data : n)));
        })
        .catch((_) => {
          alert(`the note '${note.content}' was already deleted from server`);
          setNotes(notes.filter((n) => n.id !== id));
        });
    }
  };

  return (
    <div>
      <h1>Notes</h1>
      <div>
        <button onClick={() => setShowAll(!showAll)}>
          show {showAll ? "important" : "all"}
        </button>
      </div>
      <ul>
        {filteredNotes.map((note) => (
          <Note
            key={note.id}
            note={note}
            toggleImportance={() => toggleImportanceOf(note.id)}
          />
        ))}
      </ul>
      <form onSubmit={addNote}>
        <input
          type="text"
          value={newNote}
          placeholder="Type your note here..."
          onChange={handleNoteChange}
        />
        <button type="submit">Add Note</button>
      </form>
    </div>
  );
}

export default App;

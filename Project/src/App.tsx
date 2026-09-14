import { useEffect, useState } from "react";
import Meme from "./components/Meme";
import type { MemesData } from "./types/post";
import memeService from "./services/meme";

function App() {
  const [memes, setMemes] = useState<MemesData[]>([]);
  const [newMeme, setNewMeme] = useState<string>("");

  useEffect(() => {
    console.log("entrando en use effect");
    memeService.getAll().then((data) => {
      console.log("la llamada termino");
      setMemes(data);
    });
  }, []);

  const addMeme = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const memeObject: Omit<MemesData, "id"> = {
      content: newMeme,
      author: "Pedro",
      thread: null,
      createdAt: new Date().toISOString(),
      updateAt: new Date().toISOString(),
      image: ""
    };
    memeService.create(memeObject).then((data) => {
      setMemes(memes.concat(data));
      setNewMeme("");
    });
  };

  const handleMemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.value);
    setNewMeme(event.target.value);
  };

  const filteredMemes = memes;

  return (
    <div>
      <h1>Memes</h1>
      <ul>
        {filteredMemes.map((meme) => (
          <Meme
            key={meme.id}
            meme={meme}
          />
        ))}
      </ul>
      <form onSubmit={addMeme}>
        <input
          type="text"
          value={newMeme}
          placeholder="Type your pirulin here..."
          onChange={handleMemeChange}
        />
        <button type="submit">Add Meme nigga</button>
      </form>
    </div>
  );
}

export default App;

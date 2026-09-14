import { useEffect, useState } from "react";
import Meme from "./components/Meme";
import type { MemesData } from "./types/post";
import memeService from "./services/meme";

function App() {
  const [memes, setMemes] = useState<MemesData[]>([]);
  const [newImage, setnewImage] = useState<string>("");
  const [newContent, setnewContent] = useState<string>("");

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
      content: newContent,
      author: "Pedro",
      thread: null,
      createdAt: new Date().toISOString(),
      updateAt: new Date().toISOString(),
      image: newImage
    };
    memeService.create(memeObject).then((data) => {
      setMemes(memes.concat(data));
      setnewContent("");
    });
  };

  const handleMemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.value);
    setnewContent(event.target.value);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.value);
    setnewImage(event.target.value);
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
          value={newContent}
          placeholder="Type your pirulin here..."
          onChange={handleMemeChange}
        />
        <input
          type="text"
          value={newImage}
          placeholder="Type your URL here..."
          onChange={handleImageChange}
        />
        <button type="submit">Add Meme</button>
      </form>
    </div>
  );
}

export default App;

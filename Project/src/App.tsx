import { useEffect, useState } from "react";
import Meme from "./components/Meme";
import MemeModal from "./components/MemeModal";
import type { MemesData } from "./types/post";
import memeService from "./services/meme";
import './App.css';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

function App() {
  const [memes, setMemes] = useState<MemesData[]>([]);
  const [newImage, setNewImage] = useState<string>("");
  const [newContent, setNewContent] = useState<string>("");
  const [modalPostear, setModalPostear] = useState<boolean>(false);
  const [selectedMeme, setSelectedMeme] = useState<MemesData | null>(null);

  useEffect(() => {
    memeService.getAll().then((data) => {
      setMemes(data);
    });
  }, []);

  const addMeme = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newImage.trim() === "" || newContent.trim() === "") return;

    const memeObject: Omit<MemesData, "id"> = {
      content: newContent,
      author: "Pedro",
      thread: null,
      createdAt: new Date().toISOString(),
      updateAt: new Date().toISOString(),
      image: newImage
    };

    memeService.create(memeObject).then((data) => {
      setMemes((prevMemes) => prevMemes.concat(data));
      setNewContent("");
      setNewImage("");
    });
    setModalPostear(false);
  };

  const handleMemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewContent(event.target.value);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewImage(event.target.value);
  };

  const filteredMemes = memes;

  return (
    <div className="bg-[#5a6c8a] min-h-screen py-[60px] relative">
      <div>
        <header className="mb-8 px-6">
          <div className="bg-[#dadada] text-center py-4 px-6 rounded-full max-w-7xl mx-auto shadow-md">
            <h1 className="text-xl md:text-2xl font-bold tracking-wide text-gray-800 uppercase">
              HIJOS DE LA (PUNTO).FOO
            </h1>
          </div>
        </header>
        <main className="columns-1 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6 max-w-[95%] mx-auto px-6">
          {filteredMemes.map((meme) => (
            <div 
              key={meme.id} 
              className="break-inside-avoid"
              onClick={() => setSelectedMeme(meme)}
            >
              <Meme meme={meme} />
            </div>
          ))}
        </main>
        <MemeModal 
          meme={selectedMeme} 
          onClose={() => setSelectedMeme(null)} 
        />
        {modalPostear && (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setModalPostear(false)}
          >
            <div 
              className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[30px] border-4 border-gray-800 w-full max-w-md shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Añada su meme
                </h2>
                <button 
                  onClick={() => setModalPostear(false)} 
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors cursor-pointer flex items-center justify-center"
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>

              <form onSubmit={addMeme} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Link a la imagen
                  </label>
                  <input 
                    type="text"
                    value={newImage}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    onChange={handleImageChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    No hay presupuesto para almacenaje 😉
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción
                  </label>
                  <input 
                    type="text"
                    value={newContent}
                    placeholder="Escribe algo gracioso..."
                    onChange={handleMemeChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                    type="submit"
                    className="bg-[#5a6c8a] hover:bg-[#485770] text-white font-semibold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-md"
                  >
                    Add Meme
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div 
          className="fixed bottom-8 right-8 z-40" 
          onClick={() => setModalPostear(true)}
        >
          <Fab color="primary" aria-label="add">
            <AddIcon />
          </Fab>
        </div>

      </div>
    </div>
  );
}

export default App;
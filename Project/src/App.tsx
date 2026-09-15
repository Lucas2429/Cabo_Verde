import { useEffect, useState } from "react";
import Meme from "./components/Meme";
import type { MemesData } from "./types/post";
import memeService from "./services/meme";
import './App.css';

function App() {
  const [memes, setMemes] = useState<MemesData[]>([]);
  const [newImage, setnewImage] = useState<string>("");
  const [newContent, setnewContent] = useState<string>("");
  const [modalPostear, setModalPostear] = useState(false);

  useEffect(() => {
    console.log("entrando en use effect");
    memeService.getAll().then((data) => {
      console.log("la llamada termino");
      setMemes(data);
    });
  }, []);

  const addMeme = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(newImage == "") return;
    if(newContent == "") return;
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
      setnewImage("");
    });
    setModalPostear(false);
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
    <div style={{backgroundColor: '#5a6c8a', paddingTop: '60px', paddingBottom: '60px'}}>
      <div>
        <div className="top_banner">
          <h1>HIJOS DE LA (PUNTO).FOO</h1>
        </div>
        <div className="container_box_memes">
            {filteredMemes.map((meme) => (
              <Meme
                key={meme.id}
                meme={meme}
              />
            ))}
        </div>
        {modalPostear && (
          <div style={{position: 'fixed', left: '0', top: '0', right: '0', bottom: '0', zIndex: 999, backgroundColor: 'rgba(0, 0, 0, 0.5)', placeItems: 'center', display: 'grid'}}>
            <div style={{backgroundColor: '#ffffff', padding: '20px', borderRadius: '30px', border: 'solid 5px'}}>
              <div>
                <h1 style={{fontSize: '40px', float: 'left'}}>Añada su meme</h1>
                <button onClick={() => {setModalPostear(false)}} style={{cursor: 'pointer', float: 'right', color: '#ffffff', height: '50px', width: '50px',backgroundColor: 'red', padding: '15px', borderRadius: '30px'}} type="submit"><strong>X</strong></button>
              </div>
              <br/>
              <br/>
              <br/>
              <br/>
              <form onSubmit={addMeme}>
                <p>Link a la imagen, que no hay presupuesto para almacenaje</p>
                <input style={{border: 'solid 1px', borderColor: 'gray', width: '100%'}}
                  type="text"
                  value={newImage}
                  placeholder="Type your URL here..."
                  onChange={handleImageChange}
                />
                <br/>
                <br/>
                <p>Descripción</p>
                <input style={{border: 'solid 1px', borderColor: 'gray', width: '100%'}}
                  type="text"
                  value={newContent}
                  placeholder="Type your pirulin here..."
                  onChange={handleMemeChange}
                />
                <br/>
                <br/>
                <button style={{cursor: 'pointer', float: 'right', color: '#ffffff' ,backgroundColor: '#5a6c8a', padding: '15px', borderRadius: '30px'}} type="submit"><strong>Add Meme</strong></button>
              </form>
            </div>
          </div>
        )}
        <div className="boton_postear" onClick={() => {setModalPostear(true)}}>+</div>
      </div>
    </div>
  );
}

export default App;

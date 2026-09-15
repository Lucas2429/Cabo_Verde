import type { MemesData } from "../types/post";

interface Prop {
  meme: MemesData;
}
const Meme = ({ meme }: Prop) => (
  <div className="box_meme">
    <img src={meme.image} alt="No carga el meme" style={{borderRadius: '20px'}}/>
    <h3 style={{padding: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{meme.content}</h3>
  </div>
);

export default Meme;

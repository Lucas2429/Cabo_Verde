import type { MemesData } from "../types/post";

interface Prop {
  meme: MemesData;
}
const Meme = ({ meme }: Prop) => (
  <li>
    {meme.content}
    <link href={meme.image} rel="noopener noreferrer">
      View Image
    </link>
    <img src={meme.image} alt="Hola"/>
  </li>
);

export default Meme;

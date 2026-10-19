interface UserAvatarProps {
  // URL de la foto de perfil; si es null o falta, se muestra la inicial.
  src?: string | null;
  // Nombre del usuario: de aquí sale la inicial cuando no hay foto.
  name: string;
  // Tamaño (y tamaño de la letra) del círculo, p. ej. "w-8 h-8 text-xs".
  className?: string;
}

// Círculo pequeño con la foto de perfil de un usuario (o su inicial). Se usa en
// los comentarios; el perfil y el banner tienen su propio formato.
const UserAvatar = ({ src, name, className = "" }: UserAvatarProps) =>
  src ? (
    // Decorativa: el nombre del usuario ya aparece como texto al lado.
    <img
      src={src}
      alt=""
      className={`${className} rounded-full object-cover shrink-0 bg-indigo-500`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${className} rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0`}
    >
      {name[0]?.toUpperCase()}
    </div>
  );

export default UserAvatar;

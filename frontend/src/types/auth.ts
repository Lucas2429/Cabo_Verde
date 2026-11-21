export type Session = {
  username: string;
  // Token anti-CSRF que el backend exige en el header X-CSRF-Token.
  csrf: string;
};

// "admin" es el único nivel de moderación (administrador/moderador).
export type Role = "user" | "admin";

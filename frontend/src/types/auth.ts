export type Session = {
  username: string;
  // Token anti-CSRF que el backend exige en el header X-CSRF-Token.
  csrf: string;
};

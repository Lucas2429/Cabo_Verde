import CloseIcon from "@mui/icons-material/Close";
import {
  DEPARTMENTS,
  DEPARTMENT_SHORT_NAMES,
  type Department,
} from "../types/departments";
import { MAX_TAGS, MAX_TAG_LENGTH, withPendingTag } from "../utils/tags";

interface Props {
  departments: Department[];
  onDepartmentsChange: (departments: Department[]) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  // Texto escrito en el campo de hashtags y aún sin confirmar. Lo guarda el
  // formulario padre para poder incluirlo al enviar.
  tagInput: string;
  onTagInputChange: (value: string) => void;
  // Avisa un error de validación (o null para limpiarlo) al formulario padre.
  onError: (message: string | null) => void;
  inputId?: string;
}

// Selector de carrera (opcional, varias) y campo de hashtags (opcional, hasta
// MAX_TAGS). Lo usan el modal de subir y el de editar un meme.
function MemeTagsField({
  departments,
  onDepartmentsChange,
  tags,
  onTagsChange,
  tagInput,
  onTagInputChange,
  onError,
  inputId = "meme-tags",
}: Props) {
  const toggleDepartment = (department: Department) => {
    onDepartmentsChange(
      departments.includes(department)
        ? departments.filter((item) => item !== department)
        : [...departments, department]
    );
  };

  // Agrega el hashtag escrito (si es válido y no está repetido).
  const addTag = () => {
    if (tagInput.trim() === "") return;
    const result = withPendingTag(tags, tagInput);
    if ("error" in result) {
      onError(result.error);
      return;
    }
    onError(null);
    onTagsChange(result.tags);
    onTagInputChange("");
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((item) => item !== tag));
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter, coma o espacio cierran el hashtag. Enter se frena para que no
    // envíe el formulario completo.
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Backspace" && tagInput === "" && tags.length > 0) {
      // Backspace con el campo vacío quita el último hashtag.
      onTagsChange(tags.slice(0, -1));
    }
  };

  return (
    <>
      {/* Etiqueta especial de carrera (opcional, se pueden elegir varias). */}
      <div>
        <span className="field-label">Carrera (opcional)</span>
        <div
          role="group"
          aria-label="Carrera del meme"
          className="flex flex-wrap gap-2"
        >
          {DEPARTMENTS.map((department) => (
            <button
              key={department}
              type="button"
              title={department}
              aria-pressed={departments.includes(department)}
              onClick={() => toggleDepartment(department)}
              className="chip"
            >
              {DEPARTMENT_SHORT_NAMES[department]}
            </button>
          ))}
        </div>
      </div>

      {/* Hashtags libres: se escribe y se confirma con Enter, coma o espacio. */}
      <div>
        <label htmlFor={inputId} className="field-label">
          Hashtags (opcional)
        </label>
        {tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="chip">
                #{tag}
                <button
                  type="button"
                  aria-label={`Quitar #${tag}`}
                  onClick={() => removeTag(tag)}
                  className="ml-1 inline-flex items-center"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id={inputId}
          type="text"
          value={tagInput}
          maxLength={MAX_TAG_LENGTH + 1}
          placeholder={tags.length >= MAX_TAGS ? "Máximo alcanzado" : "#parcial"}
          disabled={tags.length >= MAX_TAGS}
          onChange={(event) => onTagInputChange(event.target.value)}
          onKeyDown={handleTagKeyDown}
          className="field"
        />
        <span className="field-hint">
          Enter, coma o espacio para agregar · {tags.length}/{MAX_TAGS}
        </span>
      </div>
    </>
  );
}

export default MemeTagsField;
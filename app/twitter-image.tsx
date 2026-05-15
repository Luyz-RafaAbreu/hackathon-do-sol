// Twitter usa a mesma imagem dinâmica do Open Graph. Não re-exportamos
// `runtime` direto porque o Next 14 só reconhece string literals declaradas
// in-file (re-exports caem em runtime Node e quebram o build do @vercel/og).
import Image, { alt, size, contentType } from "./opengraph-image";

export const runtime = "edge";
export const revalidate = 3600;
export { alt, size, contentType };
export default Image;

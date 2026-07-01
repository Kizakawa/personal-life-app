import DOMPurify from "dompurify";

const sanitizeOptions = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ["img"],
  ADD_ATTR: ["target", "rel", "style", "class", "data-file-id"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta"],
};

function stripBase64Images(html = "") {
  return String(html).replace(/<img\b[^>]*\bsrc=["']data:image\/[^"']+["'][^>]*>/gi, "");
}

export function sanitizeHtml(html = "") {
  const withoutBase64 = stripBase64Images(html || "");
  return DOMPurify.sanitize(withoutBase64, sanitizeOptions);
}

export default sanitizeHtml;

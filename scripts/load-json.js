export async function loadJson(path) {
  let resp;
  try {
    resp = await fetch(path);
  } catch (cause) {
    return { ok: false, path, cause };
  }
  if (!resp.ok) return { ok: false, path, cause: resp };
  try {
    return { ok: true, data: await resp.json() };
  } catch (cause) {
    return { ok: false, path, cause };
  }
}

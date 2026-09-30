export const NO_ID = 'ללא מ"א';

export function personKey({ id, firstName, lastName }) {
  return id && id !== NO_ID
    ? `id:${id}`
    : `name:${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

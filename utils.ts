/** @About Ensures that the given value is not null or undefined. */
const exists = <T>(x: T): x is NonNullable<T> => x !== undefined && x !== null;

/** @About Type casts all the props of the given object as read-only. */
const readonlyObj = <T>(obj: T): Readonly<T> => obj;

/** @About TypeScript doesn't have an easy way to create callable objects with props.
 * This constructs one by converting the "call" prop to the callable function. */
const callable = function <C extends { call: Function }>(
  obj: C,
): C[`call`] & Omit<C, `call`> {
  const func: any = obj.call;
  for (const key in obj) {
    if (key != `call`) func[key] = (obj as any)[key];
  }
  return func;
};

/** @About Since we don't have access to JSX or React, we use this instead as a short hand
 * for creating HTML elements. */
function createHtmlElement(params: {
  tag: string;
  content?: Node[] | Node;
  style?: { [key: string]: string | number | boolean | undefined };
  elementType?: string;
  id?: string;
  class?: string;
}) {
  const element = document.createElement(params.tag);

  // Set style
  if (exists(params.style)) {
    let styleString = ``;
    for (const key in params.style) {
      let adjustedKey = ``;
      for (let i = 0; i < key.length; i++) {
        adjustedKey +=
          key[i] === key[i].toLowerCase() ? key[i] : `-${key[i].toLowerCase()}`;
      }
      styleString += `${adjustedKey}: ${params.style[key]}; `;
    }
    element.setAttribute(`style`, styleString);
  }

  // Set Id and Class
  if (exists(params.id)) element.setAttribute(`id`, params.id as any);
  if (exists(params.class)) element.setAttribute(`class`, params.class as any);
  if (exists(params.elementType))
    element.setAttribute(`type`, params.elementType as any);

  // Add children
  if (exists(params.content)) {
    if (Array.isArray(params.content)) {
      for (const child of params.content) {
        element.appendChild(child);
      }
    } else {
      element.appendChild(params.content);
    }
  }

  return element;
}

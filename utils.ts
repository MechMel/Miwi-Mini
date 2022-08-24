function readonlyObj<T>(obj: T): Readonly<T> {
  return obj;
}

function exists<T>(obj: T): obj is NonNullable<T> {
  return obj !== undefined && obj !== null;
}

function isString(possibleString: any): possibleString is string {
  return typeof possibleString === `string`;
}

/** @About Must be called at the start of a script. */
const getScriptsParent = (document: Document) =>
  document.currentScript?.parentElement;

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

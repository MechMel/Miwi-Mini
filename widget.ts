const isDebugMode = false;
const isDesktopView = Bool<RW>(false);
const debugViewportWidth = ifel(isDesktopView, 75, 40);
const debugViewportHeight = ifel(isDesktopView, 40, 75);

//
//
//
//
//

// SECTION: Contents
type WidgetContent = OneOrMore<R, Str | Bool | Num | Icon | HtmlNode | Widget>;
const isContent = function (
  possibleContent: any,
): possibleContent is WidgetContent {
  let isActuallyContent = false;
  if (Var.toLit(List.is(possibleContent))) {
    isActuallyContent = true;
    for (const i in Var.toLit(possibleContent)) {
      isActuallyContent = isActuallyContent && isContent(possibleContent[i]);
    }
  } else {
    isActuallyContent =
      Var.toLit(Str.is(possibleContent)) ||
      Var.toLit(Bool.is(possibleContent)) ||
      Var.toLit(Num.is(possibleContent)) ||
      Var.toLit(Icon.is(possibleContent)) ||
      Var.toLit(Widget.is(possibleContent));
  }
  return isActuallyContent;
};
type _contentCompiler = {
  isThisType: (contents: WidgetContent) => boolean;
  compile: (params: {
    // We use "any" so that children can specify their own type
    contents: NotVar & any;
    parent: Lit<Widget>;
  }) => _ContentCompilationResults;
};
type _ContentCompilationResults = {
  htmlElements: List<R, VarOrLit<R, Node>>;
  widthGrows: Bool;
  heightGrows: Bool;
};
const _contentCompilers: _contentCompiler[] = [];
const _addNewContentCompiler = (newCompiler: _contentCompiler) =>
  _contentCompilers.push(newCompiler);
const compileContentsToHtml = function (params: {
  contents: WidgetContent;
  parent: Widget;
}): VarOrLit<R, _ContentCompilationResults> {
  return computed(() => {
    for (const compiler of _contentCompilers) {
      if (compiler.isThisType(params.contents)) {
        return compiler.compile({
          contents: Var.toLit(params.contents),
          parent: Var.toLit(params.parent),
        });
      }
    }
    console.log(params.contents.value);
    throw `Encountered an error in "miwi/widget.ts.compileContentsToHtml". Could not find a content compiler for ${JSON.stringify(
      params.contents,
      null,
      2,
    )}`;
  }, [params.contents, params.parent]);
};
_addNewContentCompiler({
  isThisType: (x) => x === undefined || x === null,
  compile: () => ({
    htmlElements: [],
    widthGrows: false,
    heightGrows: false,
  }),
});
_addNewContentCompiler({
  isThisType: (contents: WidgetContent) => Var.toLit(List.is(contents)),
  compile: (params: {
    contents: (Str | Bool | Num | Icon | Widget)[];
    parent: Lit<Widget>;
  }) =>
    params.contents.reduce(
      (prev, cur) => {
        const thisWidgetInfo = compileContentsToHtml({
          contents: cur,
          parent: params.parent,
        });
        return {
          htmlElements: List.concat(
            prev.htmlElements,
            thisWidgetInfo.htmlElements,
          ),
          widthGrows: or(thisWidgetInfo.widthGrows, prev.widthGrows),
          heightGrows: or(thisWidgetInfo.heightGrows, prev.heightGrows),
        };
      },
      {
        htmlElements: List<R, Var<R, Node>>(),
        widthGrows: false,
        heightGrows: false,
      } as _ContentCompilationResults,
    ),
});

/** @About Since we don't have access to JSX or React, we use this instead as a short hand
 * for creating HTML elements. */
function createHtmlElement(params: {
  tag: string;
  content?: VarOrLit<R, Node[] | Node>;
  onClick?: () => void;
  style?: { [key: string]: Str | Num | Bool };
  elementType?: string;
  id?: string;
  class?: string;
  href?: Str;
  target?: Str;
}) {
  const htmlElement = document.createElement(params.tag);

  // Set Id and Class
  if (exists(params.id)) htmlElement.setAttribute(`id`, params.id as any);
  if (exists(params.class))
    htmlElement.setAttribute(`class`, params.class as any);
  if (exists(params.elementType))
    htmlElement.setAttribute(`type`, params.elementType as any);
  if (exists(params.target))
    htmlElement.setAttribute(`target`, params.target as any);

  // Set onClick
  if (exists(params.onClick)) htmlElement.onclick = params.onClick;

  // Set style
  if (exists(params.style)) {
    for (const key in params.style) {
      doOnChange(
        // We need to do "?? ``" because setting a style prop to undefined doesn't clear the old value
        (x) => ((htmlElement.style as any)[key] = Var.toLit(x) ?? ``),
        params.style[key],
      );
    }
  }

  // Set href
  if (exists(params.href)) {
    doOnChange(
      // We need to do "?? ``" because setting a style prop to undefined doesn't clear the old value
      () => {
        htmlElement.setAttribute("href", Var.toLit(params.href!));
      },
      params.href,
    );
  }

  // Add children
  if (exists(params.content)) {
    doOnChange(() => {
      while (htmlElement.firstChild) {
        htmlElement.removeChild(htmlElement.firstChild);
      }
      if (Var.toLit(List.is(params.content))) {
        const litList = Var.toLit(params.content as any);
        (litList as VarOrLit<R, Node>[]).map((node, index) => {
          let litNode: Node | undefined = undefined;
          doOnChange(() => {
            // Find a more permanent way to stop watching when the content changes.
            if (Var.toLit(params.content as any) === litList) {
              const newNode = Var.toLit(node);
              if (exists(litNode) && litNode.parentNode === htmlElement) {
                if (newNode !== litNode) {
                  htmlElement.insertBefore(newNode, litNode);
                  htmlElement.removeChild(litNode);
                }
              } else {
                htmlElement.appendChild(newNode);
              }
              litNode = newNode;
            }
          }, node);
        });
      } else {
        htmlElement.appendChild(Var.toLit(params.content as VarOrLit<R, Node>));
      }
    }, params.content);
  }

  console.log(htmlElement.outerHTML);

  return htmlElement;
}
const _inlineContentOpenTag = `<MiwiElement>`;
const _inlineContentCloseTag = `</MiwiElement>`;

//
//
//
//
//

// SECTION: Widget Styler
/** @About Used to put all widget styling in one spot. */
const widgetStyleBuilders: ((params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: VarOrLit<R, _ContentCompilationResults>;
}) => _WidgetStylePart)[] = [];
type _WidgetStylePart = { [key: string]: Str | Num | Bool };

/** @About Converts a widget to an html element along with some other stats. */
_addNewContentCompiler({
  isThisType: (x) => {
    return Var.toLit(Widget.is(x));
  },
  compile: function (params: {
    contents: Lit<Widget>;
    parent: Lit<Widget>;
  }): _ContentCompilationResults {
    // Compile the children
    const childrenInfo = compileContentsToHtml({
      contents: params.contents.contents as WidgetContent,
      parent: params.contents,
    });

    // Compile the styles
    const parentStyle: any = {};
    for (const i in widgetStyleBuilders) {
      const newProps = widgetStyleBuilders[i]({
        widget: params.contents,
        parent: params.parent,
        childrenInfo: childrenInfo,
      });
      for (const key in newProps) {
        parentStyle[key] = newProps[key];
      }
    }

    // Compile the widget
    return {
      widthGrows: _getSizeGrows(params.contents.width, childrenInfo.widthGrows),
      heightGrows: _getSizeGrows(
        params.contents.height,
        childrenInfo.heightGrows,
      ),
      htmlElements: [
        createHtmlElement({
          tag: Var.toLit(Var.toLit(params.contents).htmlTag),
          onClick: params.contents.onTap,
          style: parentStyle,
          content: childrenInfo.htmlElements,
        }),
      ],
    };
  },
});

//
//
//
//
//

// SECTION: Width & Height
type FlexSize<P extends VarPerms = RW> = Type<P, typeof FlexSize>;
const FlexSize = Var.newType({
  is: (x) => exists(x.flex),
  construct: ({
    flex = 1 as Num<RW>,
    min = -1 as Num<RW>,
    max = Infinity as Num<RW>,
  }) => ({
    flex: flex,
    min: min,
    max: max,
  }),
  flex: 1,
  min: -1,
  max: Infinity,
});
type Size<P extends VarPerms = RW> = Type<P, typeof Size>;
const Size = Var.newType({
  is: (x) =>
    Var.toLit(Num.is(x)) || Var.toLit(Str.is(x)) || Var.toLit(FlexSize.is(x)),
  construct: (x: number | string | Lit<FlexSize>) => x,
  shrink: -1,
  grow: callable({
    call: ({
      flex = 1 as Num<RW>,
      min = -1 as Num<RW>,
      max = Infinity as Num<RW>,
    }) => ({
      flex: flex,
      min: min,
      max: max,
    }),
    flex: 1,
    min: -1,
    max: Infinity,
  }),
});
const _getSizeGrows = (givenSize: Size, childGrows: Bool) =>
  or(FlexSize.is(givenSize), and(equ(givenSize, Size.shrink), childGrows));
widgetStyleBuilders.push(function (params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: _ContentCompilationResults;
}) {
  const computeSizeInfo = (
    isMainAxis: Bool,
    givenSize: Size,
    childGrows: Bool,
  ) => {
    const NONE = ``;
    const sizeGrows = _getSizeGrows(givenSize, childGrows);
    const exactSize = ifel(
      and(not(isMainAxis), sizeGrows),
      `100%`,
      ifel(
        Str.is(givenSize),
        givenSize as Str,
        ifel(
          and(not(equ(givenSize, Size.shrink)), not(sizeGrows)),
          sizeToCss(givenSize as Num),
          `fit-content`,
        ),
      ),
    );
    const minSize = ifel(
      FlexSize.is(givenSize),
      ifel(
        equ(sizeToCss((givenSize as FlexSize).min), Size.shrink),
        `fit-content`,
        sizeToCss((givenSize as FlexSize).min),
      ),
      exactSize,
    );
    const maxSize = ifel(
      FlexSize.is(givenSize),
      ifel(
        equ(sizeToCss((givenSize as FlexSize).max), Size.shrink),
        `fit-content`,
        sizeToCss((givenSize as FlexSize).max),
      ),
      exactSize,
    );
    return [exactSize, minSize, maxSize, sizeGrows] as const;
  };
  const [exactWidth, wMin, wMax, widthGrows] = computeSizeInfo(
    equ(params.parent.contentAxis, Axis.horizontal),
    params.widget.width,
    params.childrenInfo.widthGrows,
  );
  const [exactHeight, hMin, hMax, heightGrows] = computeSizeInfo(
    equ(params.parent.contentAxis, Axis.vertical),
    params.widget.height,
    params.childrenInfo.heightGrows,
  );
  return {
    display: `flex`,
    boxSizing: `border-box`,
    // Using minWidth and maxWidth tells css to not override the size of this element
    width: exactWidth,
    minWidth: wMin,
    maxWidth: wMax,
    height: exactHeight,
    minHeight: hMin,
    maxHeight: hMax,
    flexBasis: ifel(
      equ(params.parent.contentAxis, Axis.vertical),
      ifel(
        FlexSize.is(params.widget.height),
        concat(mul((params.widget.height as FlexSize).flex, 100), `%`),
        ifel(heightGrows, `100%`, ``),
      ),
      ifel(
        FlexSize.is(params.widget.width),
        concat(mul((params.widget.width as FlexSize).flex, 100), `%`),
        ifel(widthGrows, `100%`, ``),
      ),
    ),
  };
});

const sizeToCss = (x: Num | Str) =>
  computed(
    () =>
      ifel(
        Num.is(x),
        ifel(
          isDebugMode,
          concat(
            mul(x as Num, div(debugViewportWidth, ifel(isDesktopView, 72, 24))),
            `vmin`,
          ),
          concat(mul(x as Num, 1 / fontSizeToHtmlUnit), `rem`),
        ),
        x,
      ),
    [x],
  );

//
//
//
//
//

// SECTION: Box Decoration
/** @About Models HSV or hexadecimal color */
type Color<P extends VarPerms = R> = Type<P, typeof Color>;
// Implement HSLA and more constrained strings
const Color = Var.newType({
  is: (x) =>
    typeof x === `string` && (x.startsWith(`#`) || x.startsWith(`hsv`)),
  construct: (
    ...v:
      | [`#${string}`]
      | [number, number, number]
      | [`${number} ${number} ${number}`]
  ): `#${string}` | `hsv(${number}, ${number}, ${number})` => {
    if (v.length === 1 && v[0].startsWith(`#`)) {
      return v[0] as `#${string}`;
    } else {
      const nums =
        v.length === 3
          ? v
          : // We parse the hsv string as floats, so that devs can stringify any type of num into the params.
            v[0].split(` `).map((v) => Math.round(parseFloat(v)));
      return `hsv(${nums[0]}, ${nums[1]}, ${nums[2]})`;
    }
  },
  white: `#ffffffff`,
  almostWhite: `#f9fafdff`,
  pink: `#e91e63ff`,
  red: `#f44336ff`,
  orange: `#ff9800ff`,
  yellow: `#ffea00ff`,
  green: `#4caf50ff`,
  teal: `#009688ff`,
  blue: `#2196f3ff`,
  purple: `#9c27b0ff`,
  brown: `#795548ff`,
  grey: `#9e9e9eff`,
  black: `#000000ff`,
  transparent: `#ffffff00`,
} as const);
const _imageExtensions = [`.ico`, `.svg`, `.png`, `.jpg`, `.jpeg`] as const;
type ImageRef<P extends VarPerms = R> = Type<P, typeof ImageRef>;
const ImageRef = Var.newType({
  is: function (v) {
    if (typeof v === `string`) {
      for (const ext of _imageExtensions) {
        if (v.endsWith(ext)) return true;
      }
    }
    return false;
  },
  construct: (v: `${string}${typeof _imageExtensions[number]}`) => v,
  toString: () => `icon.png`,
});
/** @Note Describes the styling of the background of a widget. */
type Material<P extends VarPerms = R> = Type<P, typeof Material>;
const Material = Var.newType({
  is: (v) => Var.toLit(Color.is(v)) || Var.toLit(ImageRef.is(v)),
  construct: (v: Lit<Color> | Lit<ImageRef>) => v,
});

/** @Note Allows for uniquely styling individual sides of a box. */
type Sides<T extends VarOrLit<R, NotVar>, P extends VarPerms = R> = VarOrLit<
  P,
  {
    top: T;
    right: T;
    bottom: T;
    left: T;
  }
>;
const Sides = callable({
  call: <T extends VarOrLit<R, NotVar>, P extends R | RW = RW>(allSides: T) =>
    Var<P, Lit<Sides<T, P>>>({
      left: allSides,
      top: allSides,
      right: allSides,
      bottom: allSides,
    }),

  fromFuncs: <T extends VarOrLit<R, NotVar>, P extends R | RW = RW>(
    params: VarFromFuncsParams<P, Lit<Sides<T, P>>>,
  ) => Var.fromFuncs<P, Lit<Sides<T, P>>>(params),

  is: (v: any) =>
    exists(v.left) &&
    Var.toLit(Num.is(v.left)) &&
    exists(v.top) &&
    Var.toLit(Num.is(v.top)) &&
    exists(v.right) &&
    Var.toLit(Num.is(v.right)) &&
    exists(v.bottom) &&
    Var.toLit(Num.is(v.bottom)),

  toCss: (sides: Padding) =>
    ifel(
      or(Num.is(sides), Str.is(sides)),
      sizeToCss(sides as Num | Str),
      concat(
        sizeToCss((sides as Sides<Num | Str>).top ?? ``),
        ` `,
        sizeToCss((sides as Sides<Num | Str>).right ?? ``),
        ` `,
        sizeToCss((sides as Sides<Num | Str>).bottom ?? ``),
        ` `,
        sizeToCss((sides as Sides<Num | Str>).left ?? ``),
      ),
    ),

  only: <T extends VarOrLit<R, NotVar>, P extends R | RW = RW>({
    left = 0 as T,
    top = 0 as T,
    right = 0 as T,
    bottom = 0 as T,
  }) =>
    Var<P, Lit<Sides<T, P>>>({
      left: left,
      top: top,
      right: right,
      bottom: bottom,
    }),

  symmetric: <T extends VarOrLit<R, NotVar>, P extends R | RW = RW>({
    horizontal = 0 as T,
    vertical = 0 as T,
  }) =>
    Var<P, Lit<Sides<T, P>>>({
      left: vertical,
      top: horizontal,
      right: vertical,
      bottom: horizontal,
    }),

  all: <T extends VarOrLit<R, NotVar>, P extends R | RW = RW>(allSides: T) =>
    Var<P, Lit<Sides<T, P>>>({
      left: allSides,
      top: allSides,
      right: allSides,
      bottom: allSides,
    }),
});
widgetStyleBuilders.push((params: { widget: Widget }) => {
  const backgroundIsColor = Color.is(params.widget.background);
  return {
    // Corner Radius
    borderRadius: ifel(
      Num.is(params.widget.cornerRadius),
      sizeToCss(params.widget.cornerRadius as Num),
      params.widget.cornerRadius,
    ),

    // Outline
    /*border: concat(`solid `, params.widget.outlineColor),
    borderWidth: ifel(
      Num.is(params.widget.outlineSize),
      numToStandardHtmlUnit(params.widget.outlineSize as Num),
      concat(
        numToStandardHtmlUnit((params.widget.outlineSize as OutlineSize).top),
        ` `,
        numToStandardHtmlUnit((params.widget.outlineSize as OutlineSize).right),
        ` `,
        numToStandardHtmlUnit(
          (params.widget.outlineSize as OutlineSize).bottom,
        ),
        ` `,
        numToStandardHtmlUnit((params.widget.outlineSize as OutlineSize).left),
      ),
    ),
    outline: `none`,*/
    border: `none`,
    outline: concat(
      sizeToCss(params.widget.outlineSize),
      ` solid `,
      params.widget.outlineColor,
    ),

    outlineOffset: concat(`-`, sizeToCss(params.widget.outlineSize)),

    // Background
    backgroundColor: ifel(backgroundIsColor, params.widget.background, ``),
    backgroundImage: ifel(
      backgroundIsColor,
      ``,
      concat(`url(/images/`, params.widget.background, `)`),
    ),
    backgroundPosition: ifel(backgroundIsColor, ``, `center`),
    backgroundSize: ifel(backgroundIsColor, ``, `cover`),
    backgroundRepeat: `no-repeat`,
    backgroundAttachment: `local`,

    // Shadow
    boxShadow: concat(
      sizeToCss(
        mul(0.12, params.widget.shadowSize, params.widget.shadowDirection.x),
      ),
      ` `,
      sizeToCss(
        mul(-0.12, params.widget.shadowSize, params.widget.shadowDirection.y),
      ),
      ` `,
      sizeToCss(mul(0.225, params.widget.shadowSize)),
      ` 0 `,
      Color.grey,
    ),
  };
});

//
//
//
//
//

// SECTION: Padding
type Padding = Str | Num | Sides<Str | Num>;
const Padding = Sides;
widgetStyleBuilders.push((params: { widget: Widget }) => ({
  padding: Sides.toCss(params.widget.padding),
}));

//
//
//
//
//

// SECTION: Content Align
type Align<P extends VarPerms = RW> = Type<P, typeof Align>;
const Align = Var.newType({
  is: (x) => exists(x?.x) && exists(x?.y),
  construct: (v: { x: Num<RW>; y: Num<RW> }) => v,
  topLeft: { x: -1, y: 1 },
  topCenter: { x: 0, y: 1 },
  topRight: { x: 1, y: 1 },
  centerLeft: { x: -1, y: 0 },
  center: { x: 0, y: 0 },
  centerRight: { x: 1, y: 0 },
  bottomLeft: { x: -1, y: -1 },
  bottomCenter: { x: 0, y: -1 },
  bottomRight: { x: 1, y: -1 },
});
widgetStyleBuilders.push(
  (params: {
    widget: Widget;
    parent: Widget;
    childrenInfo: _ContentCompilationResults;
  }) => ({
    // Algin self when in a stack
    position: `relative`,
    margin: 0,

    // Content Alignment: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
    justifyContent:
      // Exact spacing is handled through grid gap
      ifel(
        Num.is(params.widget.contentSpacing),
        ifel(
          equ(params.widget.contentAxis, Axis.vertical),
          ifel(
            equ(params.widget.contentAlign.y, 1),
            `flex-start`,
            ifel(
              equ(params.widget.contentAlign.y, 0),
              `safe center`,
              `flex-end`,
            ),
          ),
          ifel(
            equ(params.widget.contentAlign.x, -1),
            `flex-start`,
            ifel(
              equ(params.widget.contentAlign.x, 0),
              `safe center`,
              `flex-end`,
            ),
          ),
        ),
        // For whatever reason, space-between with one item puts it at the start instead of centering it.
        ifel(
          and(
            equ(params.widget.contentSpacing, Spacing.spaceBetween),
            equ(List.len(params.childrenInfo.htmlElements), 1),
          ),
          Spacing.spaceAround,
          params.widget.contentSpacing,
        ),
      ),
    alignItems: ifel(
      equ(params.widget.contentAxis, Axis.vertical),
      ifel(
        equ(params.widget.contentAlign.x, -1),
        `flex-start`,
        ifel(equ(params.widget.contentAlign.x, 0), `safe center`, `flex-end`),
      ),
      ifel(
        equ(params.widget.contentAlign.y, 1),
        `flex-start`,
        ifel(equ(params.widget.contentAlign.y, 0), `safe center`, `flex-end`),
      ),
    ),
    textAlign: ifel(
      equ(params.widget.contentAlign.x, -1),
      `left`,
      ifel(equ(params.widget.contentAlign.x, 0), `center`, `right`),
    ),
  }),
);

//
//
//
//
//

// SECTION: Content Axis
const _axisOptions = readonlyObj({
  horizontal: `horizontal`,
  vertical: `vertical`,
} as const);
type Axis<P extends VarPerms = R> = Type<P, typeof Axis>;
const Axis = Var.newType({
  is: (x) => Object.values(_axisOptions).includes(x),
  construct: (v: Values<typeof _axisOptions>) => v,
  toString: () => `vertical`,
  ..._axisOptions,
});
widgetStyleBuilders.push((params: { widget: Widget }) => ({
  flexDirection: ifel(
    equ(params.widget.contentAxis, Axis.vertical),
    `column`,
    `row`,
  ),
}));

//
//
//
//
//

// SECTION: Content Is Scrollable
widgetStyleBuilders.push((params: { widget: Widget }) => ({
  overflowX: ifel(
    params.widget.contentIsScrollableX,
    `overlay`, // Scroll when nesscary, and float above contents
    ``, //`hidden`,
  ),
  overflowY: ifel(
    params.widget.contentIsScrollableY,
    `auto`, // Scroll when nesscary, and float above contents
    ``, //`hidden`,
  ),
  scrollbarWidth: `thin`,
  scrollbarColor: `#e3e3e3 transparent`,
}));

//
//
//
//
//

// SECTION: Content Spacing
const _spacingOptions = readonlyObj({
  spaceBetween: `space-between`,
  spaceAround: `space-around`,
  spaceEvenly: `space-evenly`,
});
type Spacing<P extends VarPerms = R> = Type<P, typeof Spacing>;
const Spacing = Var.newType({
  is: (x) =>
    typeof x === `number` || Object.values(_spacingOptions).includes(x),
  construct: (v: number | Values<typeof _spacingOptions>) => v,
  ..._spacingOptions,
});
widgetStyleBuilders.push((params: { widget: Widget }) => ({
  rowGap: ifel(
    and(
      equ(params.widget.contentAxis, Axis.vertical),
      Num.is(params.widget.contentSpacing),
    ),
    sizeToCss(params.widget.contentSpacing as Num),
    ``,
  ),
  columnGap: ifel(
    and(
      equ(params.widget.contentAxis, Axis.horizontal),
      Num.is(params.widget.contentSpacing),
    ),
    sizeToCss(params.widget.contentSpacing as Num),
    ``,
  ),
}));

//
//
//
//
//

// SECTION: Text Style
// TODO: Change textColor to textMaterial. Then use text to mask a backdrop for gradiants or images.
// Also, have mask be a valid material so that the same back drop can be used for several different elements.
const testStyleToCss = (params: { widget: Widget }) => ({
  fontFamily: `Roboto`,
  fontSize: ifel(
    Num.is(params.widget.textSize),
    numToFontSize(params.widget.textSize as Num),
    params.widget.textSize as Str,
  ),
  fontWeight: ifel(params.widget.textIsBold, `bold`, `normal`),
  fontStyle: ifel(params.widget.textIsItalic, `italic`, `normal`),
  textAlign:
    params.widget.contentAlign.x === -1
      ? `left`
      : params.widget.contentAlign.x === 0
      ? `center`
      : `right`,
  color: params.widget.textColor,
});
widgetStyleBuilders.push(testStyleToCss);

const textColorBody = Color<RW>(`#333333`);
const fontSizeToHtmlUnit = 0.825;
const numToFontSize = (num: Num) => sizeToCss(mul(fontSizeToHtmlUnit, num));

//
//
//
//
//

// SECTION: Widget
/** @About Widgets are the building blocks of UIs. */
type WidgetLit = {
  title: Str;
  width: Size;
  height: Size;
  cornerRadius: Num | Str; // | [Num, Num, Num, Num];
  outlineColor: Color;
  outlineSize: Num; // | OutlineSize;
  background: Material;
  shadowSize: Num;
  shadowDirection: Align;
  onTap: (() => void) | undefined;
  //interaction: { onTap: function() {}, onDoubleTap: function() {}, onLongPress: function() {}, }
  padding: Padding;
  contentAlign: Align;
  contentAxis: Axis;
  contentIsScrollableX: Bool;
  contentIsScrollableY: Bool;
  contentSpacing: Spacing;
  // contentStyle: style.deferToParent,
  textSize: Num | Str;
  textIsBold: Bool;
  textIsItalic: Bool;
  textIsUnderlined: Bool;
  textColor: Color;
  href: Str;
  contents: WidgetContent;
  readonly htmlTag: string;
  readonly toString: () => string;
};
const _defaultWidget: WidgetLit = {
  title: `Untitled`,
  width: Size.shrink,
  height: Size.shrink,
  onTap: undefined,
  cornerRadius: 0,
  outlineColor: Color.transparent,
  outlineSize: 0,
  background: Color.transparent,
  shadowSize: 0,
  shadowDirection: Align.center,
  padding: 0,
  contentAlign: Align.center,
  contentAxis: Axis.vertical,
  contentIsScrollableX: false,
  contentIsScrollableY: false,
  contentSpacing: 0,
  href: ``,
  textSize: 1,
  textIsBold: false,
  textIsItalic: false,
  textIsUnderlined: false,
  textColor: textColorBody,
  contents: [],
  htmlTag: `div`,
};
type WidgetConfig = Partial<OmitToNever<WidgetLit, `htmlTag` | `contents`>>;
type WidgetParams<ExtraConfig extends { [key: string]: any } = {}> = Parameters<
  (
    options?: (Partial<ExtraConfig> & WidgetConfig) | WidgetContent,
    ...contents: WidgetContent[]
  ) => void
>;
const extractConfigAndContentsFromWidgetParams = <
  ExtraConfig extends { [key: string]: any } = {},
>(
  params: WidgetParams<ExtraConfig>,
): {
  config: Partial<ExtraConfig> & WidgetConfig;
  contents: WidgetContent[];
} => {
  let config: Partial<ExtraConfig> & WidgetConfig = {};
  const contents = params as WidgetContent[];
  if (!isContent(contents[0])) {
    config = contents[0] as Partial<ExtraConfig> & WidgetConfig;
    contents.splice(0, 1);
  }
  return { config, contents };
};
type Widget<P extends VarPerms = R> = VarOrLit<P, WidgetLit>;
const Widget = Var.newType({
  is: (x) => exists(x?.htmlTag),
  construct: (
    template: WidgetLit = _defaultWidget,
    ...widgetParams: WidgetParams
  ): WidgetLit => {
    const { config, contents } =
      extractConfigAndContentsFromWidgetParams(widgetParams);
    const newWidget: any = {};
    for (const key in template) {
      newWidget[key] = (config as any)?.[key] ?? (template as any)[key];
    }
    // If no invocation contents are provided then we should use the default contents instead.
    if (contents.length > 0) {
      newWidget.contents = contents;
    }
    /*newWidget.toString = function (): string {
      // Maybe swap to <MiwiWidget>{...json}</MiwiWidget>
      return `${_inlineContentOpenTag}${JSON.stringify(
        newWidget,
      )}${_inlineContentCloseTag}`;
    };*/
    newWidget.toString = function (): string {
      // Maybe swap to <MiwiWidget>{...json}</MiwiWidget>
      return (
        Var.toLit(
          Var.toLit(
            Var.toLit(
              compileContentsToHtml({
                contents: newWidget,
                parent: _defaultWidget,
              }),
            ).htmlElements,
          )[0],
        ) as any
      ).outerHTML;
    };
    return newWidget;
  },
  template: <P1 extends [{ call: (...args: []) => WidgetLit }] | WidgetParams>(
    ...templateParams: P1
  ): P1 extends [{ call: Function }]
    ? Callable<P1[0] & WidgetLit>
    : Callable<
        {
          call: (...invokeParams: WidgetParams) => WidgetLit;
          row: (...invokeParams: WidgetParams) => WidgetLit;
          column: (...invokeParams: WidgetParams) => WidgetLit;
        } & WidgetLit
      > =>
    exists((templateParams[0] as any)?.call)
      ? (callable({
          ...(templateParams as [any])[0],
          ...(templateParams as [any])[0].call(),
        }) as any)
      : (callable({
          call: (...invokeParams: WidgetParams) =>
            Widget.lit(
              Widget.lit(_defaultWidget, ...templateParams),
              ...invokeParams,
            ),
          row: (...invokeParams: WidgetParams) =>
            Widget.lit(
              Widget.lit(Widget.lit(_defaultWidget, ...templateParams), {
                contentAxis: Axis.horizontal,
              }),
              ...invokeParams,
            ),
          column: (...invokeParams: WidgetParams) =>
            Widget.lit(
              Widget.lit(Widget.lit(_defaultWidget, ...templateParams), {
                contentAxis: Axis.vertical,
              }),
              ...invokeParams,
            ),
          /*stack: (...invokeParams: WidgetParams) =>
            Widget.lit(
              Widget.lit(Widget.lit(_defaultWidget, ...templateParams), {
                contentAxis: Axis.vertical,
              }),
              ...invokeParams,
            ),*/
          ...Widget.lit(_defaultWidget, ...templateParams),
        }) as any),
});
type _WidgetConstructorOptions =
  | Partial<OmitToNever<WidgetLit, `htmlTag` | `contents`>>
  | WidgetContent;

//
//
//
//
//

// SECTION: Html Nodes
type HtmlNode<P extends VarPerms = R> = Type<P, typeof HtmlNode>;
const HtmlNode = Var.newType({
  // From: https://stackoverflow.com/a/384380
  is: (x: any) =>
    typeof Node === "object"
      ? x instanceof Node
      : x &&
        typeof x === "object" &&
        typeof x.nodeType === "number" &&
        typeof x.nodeName === "string",
  construct: (v: Node) => v,
});
const createTextNode = (str: Str) => {
  const newTextNode = document.createTextNode(``);
  doOnChange(() => (newTextNode.textContent = Var.toLit(str)), str);
  return newTextNode;
};
_addNewContentCompiler({
  isThisType: HtmlNode.isLit,
  compile: (params: {
    contents: Lit<HtmlNode>;
  }): _ContentCompilationResults => ({
    htmlElements: [params.contents],
    widthGrows: false,
    heightGrows: false,
  }),
});

//
//
//
//
//

// SECTION: Icons
type Icon<P extends VarPerms = R> = Type<P, typeof Icon>;
const Icon = Var.newType({
  is: (x) => exists((x as any)?.icon),
  construct: (v: { icon: string; toString: () => string }) => v,
  ..._iconsObj,
});
_addNewContentCompiler({
  isThisType: (x) => Var.toLit(Icon.is(x)),
  compile: function (params: {
    contents: Lit<Icon>;
    parent: Lit<Widget>;
  }): _ContentCompilationResults {
    const textNode = document.createTextNode(``);
    doOnChange(
      (x) => (textNode.nodeValue = x.toString()),
      params.contents.icon,
    );
    return {
      htmlElements: [
        createHtmlElement({
          tag: `span`,
          class: `material-symbols-outlined`,
          style: {
            cursor: `default`,
            width: ifel(
              Num.is(params.parent.textSize),
              numToIconSize(params.parent.textSize as Num),
              params.parent.textSize as Str,
            ),
            height: ifel(
              Num.is(params.parent.textSize),
              numToIconSize(params.parent.textSize as Num),
              params.parent.textSize as Str,
            ),
            color: params.parent.textColor,
            display: `inline-block`,
            verticalAlign: `middle`,
            textAlign: `center`,
            fontSize: ifel(
              Num.is(params.parent.textSize),
              numToIconSize(params.parent.textSize as Num),
              params.parent.textSize as Str,
            ),
          },
          content: textNode,
        }),
      ],
      widthGrows: false,
      heightGrows: false,
    };
  },
});

/** @About converts from standard Moa units to a size that makes sense for icons. */
const numToIconSize = (num: Num) => sizeToCss(mul(0.9, num));

//
//
//
//
//

// SECTION: Content Literals
_addNewContentCompiler({
  isThisType: (contents: WidgetContent) =>
    Var.toLit(Str.is(contents)) ||
    Var.toLit(Num.is(contents)) ||
    Var.toLit(Bool.is(contents)),
  compile: (params: {
    contents: string | number | boolean;
    parent: Lit<Widget>;
  }) => ({
    widthGrows: false,
    heightGrows: false,
    htmlElements: [
      //document.createTextNode(params.contents.toString()),
      createHtmlElement({
        // Use `a` when this is a link
        tag: `p`,
        style: {
          ...testStyleToCss({ widget: params.parent }),
          margin: 0,
          padding: 0,
        },
        href: params.parent.href,
        content: document.createTextNode(params.contents.toString()),
      }),
    ],
  }),
});

//
//
//
//
//

// SECTION: Compile Page
const pageStack = List<RW, Widget>();

// Provides an easy reffrence to the current page
const currentPage = computed(
  () => Var.toLit(List.last(pageStack)) ?? Widget.lit(),
  [pageStack],
);

/** @Note Opens the given page. */
const openPage = (w: WidgetLit = Widget.lit()) => List.push(pageStack, w);

/** @Note Closes the current page and opens the previous one. Note, this will not close the first page. */
const closePage = () => List.pop(pageStack);

// Set up page rendering reativity
// Using a function allows us to keep variables private
(() => {
  const pageParentElement = document.getElementById(`pageParent`)!;
  const pageElement = compileContentsToHtml({
    contents: isDebugMode
      ? Widget.lit(_defaultWidget, {
          width: Size.grow,
          height: Size.grow,
          contentSpacing: Spacing.spaceBetween,
          contents: [
            Widget.lit(_defaultWidget, {
              width: Size.grow,
              height: `5vmin`,
              contentAxis: Axis.horizontal,
              contentAlign: Align.topLeft,
              padding: concat(mul(1, 1 / fontSizeToHtmlUnit), `rem`),
              contentSpacing: 0,
              contents: [
                Widget.lit(_defaultWidget, {
                  textSize: concat(mul(2, 1 / fontSizeToHtmlUnit), `rem`),
                  textColor: ifel(isDesktopView, Color.blue, Color.black),
                  onTap: () => (isDesktopView.value = true),
                  contents: Icon.monitor,
                }),
                Widget.lit(_defaultWidget, {
                  width: concat(mul(1, 1 / fontSizeToHtmlUnit), `rem`),
                }),
                Widget.lit(_defaultWidget, {
                  textSize: concat(mul(2, 1 / fontSizeToHtmlUnit), `rem`),
                  textColor: ifel(isDesktopView, Color.black, Color.blue),
                  onTap: () => (isDesktopView.value = false),
                  contents: Icon.phone_android,
                }),
              ],
            }),
            Widget.lit(_defaultWidget, {
              width: concat(add(debugViewportWidth, 4), `vmin`),
              height: concat(add(debugViewportHeight, 4), `vmin`),
              cornerRadius: `1.66667vmin`,
              background: Color.black,
              contents: Widget.lit(_defaultWidget, {
                width: concat(debugViewportWidth, `vmin`),
                height: concat(debugViewportHeight, `vmin`),
                contents: currentPage,
              }),
            }),
            Widget.lit(_defaultWidget, {
              width: Size.grow,
              height: `5vmin`,
              contents: [],
            }),
          ],
        })
      : currentPage,
    parent: Widget.lit(),
  });

  // Redraw the page on changes
  doOnChange(() => {
    // Remove the old page
    pageParentElement.innerHTML = ``;
    pageParentElement.appendChild(
      Var.toLit(List.get(pageElement.htmlElements, 0)),
    );
  }, pageElement);

  // Update the document title
  doOnChange(() => {
    document.title = Var.toLit(currentPage.title);
  }, currentPage.title);
})();

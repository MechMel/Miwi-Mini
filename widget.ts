//
//
//
//
//

// SECTION: Contents
type WidgetContent = OneOrMore<R, Str | Bool | Num | Icon | Widget>;
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
    startZIndex: number;
  }) => _ContentCompilationResults;
};
type _ContentCompilationResults = {
  htmlElements: List<R, VarOrLit<R, Node>>;
  widthGrows: Bool;
  heightGrows: Bool;
  greatestZIndex: Num;
};
const _contentCompilers: _contentCompiler[] = [];
const _addNewContentCompiler = (newCompiler: _contentCompiler) =>
  _contentCompilers.push(newCompiler);
const compileContentsToHtml = function (params: {
  contents: WidgetContent;
  parent: Widget;
  startZIndex: number;
}): VarOrLit<R, _ContentCompilationResults> {
  return computed(() => {
    for (const i in _contentCompilers) {
      if (_contentCompilers[i].isThisType(params.contents)) {
        return _contentCompilers[i].compile({
          contents: Var.toLit(params.contents),
          parent: Var.toLit(params.parent),
          startZIndex: params.startZIndex,
        });
      }
    }
    throw `Encountered an error in "miwi/widget.ts.compileContentsToHtml". Could not find a content compiler for ${JSON.stringify(
      params.contents,
      null,
      2,
    )}`;
  }, [params.contents, params.parent]);
};
_addNewContentCompiler({
  isThisType: (contents: WidgetContent) => Var.toLit(List.is(contents)),
  compile: function (params: {
    contents: (Str | Bool | Num | Icon | Widget)[];
    parent: Lit<Widget>;
    startZIndex: number;
  }) {
    // We'll split arrays into their individual elements and recurssively convert them to html.
    const myInfo: _ContentCompilationResults = {
      htmlElements: [],
      widthGrows: false as Bool,
      heightGrows: false as Bool,
      greatestZIndex: params.startZIndex as number,
    };
    const htmlElementLists: List<R, VarOrLit<R, Node>>[] = [];
    for (let i in params.contents) {
      const thisWidgetInfo = compileContentsToHtml({
        contents: params.contents[i],
        parent: params.parent,
        startZIndex:
          Var.toLit(params.parent.contentAxis) === Axis.z
            ? Var.toLit(myInfo.greatestZIndex) + 1
            : params.startZIndex,
      });
      htmlElementLists.push(thisWidgetInfo.htmlElements);
      myInfo.widthGrows = or(thisWidgetInfo.widthGrows, myInfo.widthGrows);
      myInfo.heightGrows = or(thisWidgetInfo.heightGrows, myInfo.heightGrows);
      myInfo.greatestZIndex = max(
        myInfo.greatestZIndex,
        thisWidgetInfo.greatestZIndex,
      );
    }
    myInfo.htmlElements = htmlElementLists.reduce(
      // Replace with List.concat()
      (prev, curr) => List.concat(prev, curr),
      List<R, Var<R, Node>>(),
    );
    return myInfo;
  },
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
}) {
  const htmlElement = document.createElement(params.tag);

  // Set Id and Class
  if (exists(params.id)) htmlElement.setAttribute(`id`, params.id as any);
  if (exists(params.class))
    htmlElement.setAttribute(`class`, params.class as any);
  if (exists(params.elementType))
    htmlElement.setAttribute(`type`, params.elementType as any);

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

  // Add children
  if (exists(params.content)) {
    const oldTriggers = [];
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
  startZIndex: number;
}) => _WidgetStylePart)[] = [];
type _WidgetStylePart = {
  scripts?: ((parent: HTMLElement) => void)[];
  preferParent?: { [key: string]: _WidgetCompilerStyleProp };
  preferChild?: { [key: string]: _WidgetCompilerStyleProp };
};
type _WidgetCompilerStyleProp = Str | Num | Bool;

/** @About Converts a widget to an html element along with some other stats. */
_addNewContentCompiler({
  isThisType: (x) => {
    return Var.toLit(Widget.is(x));
  },
  compile: function (params: {
    contents: Lit<Widget>;
    parent: Lit<Widget>;
    startZIndex: number;
  }): _ContentCompilationResults {
    // Compile the children
    const childrenInfo = compileContentsToHtml({
      contents: params.contents.contents as WidgetContent,
      parent: params.contents,
      startZIndex: params.startZIndex,
    });

    // Compile the styles
    //const shouldCreateChild = Var.toLit(params.contents.contentAxis) === Axis.z;
    const parentStyle: any = {};
    const childStyle: any = {};
    for (const i in widgetStyleBuilders) {
      const newProps = widgetStyleBuilders[i]({
        widget: params.contents,
        parent: params.parent,
        childrenInfo: childrenInfo,
        startZIndex: params.startZIndex,
      });
      for (const key in newProps.preferParent) {
        parentStyle[key] = newProps.preferParent[key];
      }
      for (const key in newProps.preferChild) {
        /*if (shouldCreateChild) {
          childStyle[key] = newProps.preferChild[key];
        } else {*/
        parentStyle[key] = newProps.preferChild[key];
        /*}*/
      }
    }

    // Compile the widget
    return {
      widthGrows: _getSizeGrows(params.contents.width, childrenInfo.widthGrows),
      heightGrows: _getSizeGrows(
        params.contents.height,
        childrenInfo.heightGrows,
      ),
      greatestZIndex: childrenInfo.greatestZIndex,
      htmlElements: [
        createHtmlElement({
          tag: Var.toLit(Var.toLit(params.contents).htmlTag),
          onClick: params.contents.onTap,
          style: parentStyle,
          content:
            /*shouldCreateChild
            ? [
                createHtmlElement({
                  tag: `div`,
                  style: {
                    flexGrow: 1,
                    alignSelf: `stretch`,
                    backgroundColor: `green`,
                    ...childStyle,
                  },
                  content: childrenInfo.htmlElements,
                }),
              ]
            :*/ childrenInfo.htmlElements,
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
  construct: (x: { flex: Num<RW> }) => x,
  flex: 1,
});
type Size<P extends VarPerms = RW> = Type<P, typeof Size>;
const Size = Var.newType({
  is: (x) =>
    Var.toLit(Num.is(x)) || Var.toLit(Str.is(x)) || Var.toLit(FlexSize.is(x)),
  construct: (x: number | string | Lit<FlexSize>) => x,
  shrink: -1,
  grow: callable({
    call: (flex: number = 1) => ({ flex }),
    flex: 1,
  }),
});
const _getSizeGrows = (givenSize: Size, childGrows: Bool) =>
  or(FlexSize.is(givenSize), and(equ(givenSize, Size.shrink), childGrows));
widgetStyleBuilders.push(function (params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: _ContentCompilationResults;
}) {
  const computeSizeInfo = (givenSize: Size, childGrows: Bool) => {
    const sizeGrows = _getSizeGrows(givenSize, childGrows);
    const exactSize = ifel(
      Str.is(givenSize),
      givenSize as Str,
      ifel(
        and(not(equ(givenSize, Size.shrink)), not(sizeGrows)),
        numToStandardHtmlUnit(givenSize as Num),
        ``,
      ),
    );
    return [exactSize, sizeGrows] as const;
  };
  const [exactWidth, widthGrows] = computeSizeInfo(
    params.widget.width,
    params.childrenInfo.widthGrows,
  );
  const [exactHeight, heightGrows] = computeSizeInfo(
    params.widget.height,
    params.childrenInfo.heightGrows,
  );
  return {
    preferParent: {
      display: `flex`,
      boxSizing: `border-box`,
      // Using minWidth and maxWidth tells css to not override the size of this element
      width: exactWidth,
      minWidth: exactWidth,
      maxWidth: exactWidth,
      height: exactHeight,
      minHeight: exactHeight,
      maxHeight: exactHeight,
      flexGrow: ifel(
        equ(params.parent.contentAxis, Axis.vertical),
        ifel(
          FlexSize.is(params.widget.height),
          (params.widget.height as FlexSize).flex,
          ifel(heightGrows, 1, ``),
        ),
        ifel(
          FlexSize.is(params.widget.width),
          (params.widget.width as FlexSize).flex,
          ifel(widthGrows, 1, ``),
        ),
      ),
      alignSelf: ifel(
        or(
          and(equ(params.parent.contentAxis, Axis.horizontal), heightGrows),
          and(equ(params.parent.contentAxis, Axis.vertical), widthGrows),
        ),
        `stretch`,
        ``,
      ),
    },
    preferChild: {
      display: `flex`,
      boxSizing: `border-box`,
    },
  };
});

const old_numToStandardHtmlUnit = (num: Num) =>
  `${mul(num, div(_pageWidthVmin, 24))}vmin`;
const numToStandardHtmlUnit = (num: Num) =>
  computed(() => `${mul(num, div(_pageWidthVmin, 24))}vmin`, [num]);

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
widgetStyleBuilders.push((params: { widget: Widget }) => {
  const backgroundIsColor = Color.is(params.widget.background);
  return {
    preferParent: {
      // Corner Radius
      borderRadius: numToStandardHtmlUnit(params.widget.cornerRadius),

      // Outline
      border: `none`,
      outline: concat(
        numToStandardHtmlUnit(params.widget.outlineSize),
        ` solid `,
        params.widget.outlineColor,
      ),

      outlineOffset: concat(
        `-`,
        numToStandardHtmlUnit(params.widget.outlineSize),
      ),

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
        numToStandardHtmlUnit(
          mul(0.12, params.widget.shadowSize, params.widget.shadowDirection.x),
        ),
        ` `,
        numToStandardHtmlUnit(
          mul(-0.12, params.widget.shadowSize, params.widget.shadowDirection.y),
        ),
        ` `,
        numToStandardHtmlUnit(mul(0.225, params.widget.shadowSize)),
        ` 0 `,
        Color.grey,
      ),
    },
  };
});

//
//
//
//
//

// SECTION: Padding
type Padding = number; //Num | [Num, Num] | [Num, Num, Num, Num];
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
      padding: numToStandardHtmlUnit(params.widget.padding),
    },
  };
});

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
  }) => {
    const parentIsZAxis = equ(params.parent.contentAxis, Axis.z);
    const widgetIsZAxis = equ(params.widget.contentAxis, Axis.z);
    const myPosition = ifel(parentIsZAxis, `absolute`, `relative`);
    return {
      preferParent: {
        // Algin self when in a stack
        position: myPosition,
        margin: ifel(
          parentIsZAxis,
          concat(
            ifel(equ(params.parent.contentAlign.x, 0), `auto`, 0),
            ` `,
            ifel(equ(params.parent.contentAlign.y, 0), `auto`, 0),
          ),
          0,
        ),
        left: ifel(
          and(parentIsZAxis, equ(params.parent.contentAlign.x, -1)),
          0,
          ``,
        ),
        top: ifel(
          and(parentIsZAxis, equ(params.parent.contentAlign.y, 1)),
          0,
          ``,
        ),
        right: ifel(
          and(parentIsZAxis, equ(params.parent.contentAlign.x, 1)),
          0,
          ``,
        ),
        bottom: ifel(
          and(parentIsZAxis, equ(params.parent.contentAlign.y, -1)),
          0,
          ``,
        ),

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
            ifel(
              equ(params.widget.contentAlign.x, 0),
              `safe center`,
              `flex-end`,
            ),
          ),
          ifel(
            equ(params.widget.contentAlign.y, 1),
            `flex-start`,
            ifel(
              equ(params.widget.contentAlign.y, 0),
              `safe center`,
              `flex-end`,
            ),
          ),
        ),
        textAlign: ifel(
          equ(params.widget.contentAlign.x, -1),
          `left`,
          ifel(equ(params.widget.contentAlign.x, 0), `center`, `right`),
        ),
      },
      preferChild: {
        position: ifel(widgetIsZAxis, `relative`, myPosition),
      },
    };
  },
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
  z: `z`,
} as const);
type Axis<P extends VarPerms = R> = Type<P, typeof Axis>;
const Axis = Var.newType({
  is: (x) => Object.values(_axisOptions).includes(x),
  construct: (v: Values<typeof _axisOptions>) => v,
  toString: () => `vertical`,
  ..._axisOptions,
});
widgetStyleBuilders.push((params: { widget: Widget; startZIndex: number }) => {
  return {
    preferParent: {
      flexDirection: ifel(
        equ(params.widget.contentAxis, Axis.vertical),
        `column`,
        `row`,
      ),
      zIndex: params.startZIndex,
    },
  };
});

//
//
//
//
//

// SECTION: Content Is Scrollable
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
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
    },
  };
});

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
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferChild: {
      rowGap:
        params.widget.contentAxis === Axis.vertical &&
        typeof params.widget.contentSpacing === `number`
          ? old_numToStandardHtmlUnit(params.widget.contentSpacing)
          : ``,
      columnGap:
        params.widget.contentAxis === Axis.horizontal &&
        typeof params.widget.contentSpacing === `number`
          ? old_numToStandardHtmlUnit(params.widget.contentSpacing)
          : ``,
    },
  };
});

//
//
//
//
//

// SECTION: Text Style
// TODO: Change textColor to textMaterial. Then use text to mask a backdrop for gradiants or images.
// Also, have mask be a valid material so that the same back drop can be used for several different elements.
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
      fontFamily: `Roboto`,
    },
    preferChild: {
      fontFamily: `Roboto`,
      fontSize: numToFontSize(params.widget.textSize),
      fontWeight: params.widget.textIsBold ? `bold` : ``,
      fontStyle: params.widget.textIsItalic ? `italic` : ``,
      color: params.widget.textColor,
    },
  };
});

const numToFontSize = (num: Num) => numToStandardHtmlUnit(mul(0.825, num));

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
  cornerRadius: Num;
  outlineColor: Color;
  outlineSize: Num;
  background: Material;
  shadowSize: Num;
  shadowDirection: Align;
  onTap: (() => void) | undefined;
  //interaction: { onTap: function() {}, onDoubleTap: function() {}, onLongPress: function() {}, }
  padding: Num;
  contentAlign: Align;
  contentAxis: Axis;
  contentIsScrollableX: Bool;
  contentIsScrollableY: Bool;
  contentSpacing: Spacing;
  // contentStyle: style.deferToParent,
  textSize: Num;
  textIsBold: Bool;
  textIsItalic: Bool;
  textColor: Color;
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
  textSize: 1,
  textIsBold: false,
  textIsItalic: false,
  textColor: Color.black,
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
    newWidget.toString = function (): string {
      // Maybe swap to <MiwiWidget>{...json}</MiwiWidget>
      return `${_inlineContentOpenTag}${JSON.stringify(
        newWidget,
      )}${_inlineContentCloseTag}`;
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
    startZIndex: number;
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
            width: numToIconSize(params.parent.textSize),
            height: numToIconSize(params.parent.textSize),
            color: params.parent.textColor,
            display: `inline-block`,
            verticalAlign: `middle`,
            textAlign: `center`,
            fontSize: numToIconSize(params.parent.textSize),
          },
          content: textNode,
        }),
      ],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
    };
  },
});

/** @About converts from standard Moa units to a size that makes sense for icons. */
const numToIconSize = (num: Num) => numToStandardHtmlUnit(mul(0.9, num));

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
  compile: function (params: {
    contents: string | number | boolean;
    parent: Lit<Widget>;
    startZIndex: number;
  }): _ContentCompilationResults {
    const paragraphParts: VarOrLit<R, Node>[] = [];
    let greatestZIndex = params.startZIndex;
    /*if (typeof params.contents === `string`) {
      const contentsAsString = params.contents;
      let openTagIndex = contentsAsString.indexOf(_inlineContentOpenTag);
      let closeTagIndex = 0 - _inlineContentCloseTag.length;
      while (openTagIndex >= 0) {
        // Read in any trailing text
        if (openTagIndex - closeTagIndex + _inlineContentCloseTag.length > 0) {
          paragraphParts.push(
            document.createTextNode(
              contentsAsString.substring(
                closeTagIndex + _inlineContentCloseTag.length,
                openTagIndex,
              ),
            ),
          );
        }
        closeTagIndex =
          openTagIndex +
          contentsAsString
            .substring(openTagIndex)
            .indexOf(_inlineContentCloseTag);
        const embededContentInfo = compileContentsToHtml({
          contents: JSON.parse(
            contentsAsString.substring(
              openTagIndex + _inlineContentOpenTag.length,
              closeTagIndex,
            ),
          ) as Widget,
          parent: params.parent,
          startZIndex: params.startZIndex,
        });
        greatestZIndex = Math.max(
          greatestZIndex,
          embededContentInfo.greatestZIndex,
        );
        for (const i in embededContentInfo.htmlElements) {
          paragraphParts.push(embededContentInfo.htmlElements[i]);
        }
        openTagIndex = contentsAsString
          .substring(closeTagIndex)
          .indexOf(_inlineContentOpenTag);
        if (openTagIndex >= 0) {
          openTagIndex += closeTagIndex;
        }
      }
      if (
        closeTagIndex + _inlineContentCloseTag.length <
        contentsAsString.length
      ) {
        paragraphParts.push(
          document.createTextNode(
            contentsAsString.substring(
              closeTagIndex + _inlineContentCloseTag.length,
              contentsAsString.length,
            ),
          ),
        );
      }
    } else {*/
    paragraphParts.push(document.createTextNode(params.contents.toString()));
    //const textNode = document.createTextNode(params.contents.toString());
    //doOnChange((x) => (textNode.nodeValue = x.toString()), params.contents);
    /*paragraphParts.push(
      computed(
        () => document.createTextNode(params.contents.toString()),
        [params.contents],
      ),
    );*/
    //}

    const htmlElement = createHtmlElement({
      tag: `p`,
      style: {
        color: params.parent.textColor,
        fontFamily: `Roboto`,
        fontSize: numToFontSize(params.parent.textSize),
        fontWeight: ifel(params.parent.textIsBold, `bold`, ``),
        fontStyle: ifel(params.parent.textIsItalic, `italic`, ``),
        textAlign:
          params.parent.contentAlign.x === -1
            ? `left`
            : params.parent.contentAlign.x === 0
            ? `center`
            : `right`,
        margin: 0,
        padding: 0,
        zIndex: params.startZIndex,
      },
      content: paragraphParts,
    });
    return {
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
      htmlElements: [htmlElement],
    };
  },
});

//
//
//
//
//

// SECTION: Compile Page
const _pageWidthVmin = 40;
const pageStack = List<RW, Widget>();

doOnChange(() => {
  // Remove the old page
  const oldPageElement = document.getElementById(`currentPage`);
  if (exists(oldPageElement)) {
    oldPageElement.parentElement?.removeChild(oldPageElement);
  }

  // Load new page
  const newPageWidget = Var.toLit(
    Var.toLit(pageStack)[Var.toLit(pageStack).length - 1],
  );
  if (exists(newPageWidget)) {
    const newPageElement = compileContentsToHtml({
      contents: newPageWidget,
      parent: Widget.lit(),
      startZIndex: 0,
    });
    doOnChange(() => {
      const pageParentElement = document.getElementById(`pageParent`);
      while (pageParentElement?.firstChild) {
        pageParentElement?.removeChild(pageParentElement?.firstChild);
      }
      document
        .getElementById(`pageParent`)
        ?.appendChild(Var.toLit(List.get(newPageElement.htmlElements, 0)));
    }, newPageElement);
    document.title = Var.toLit(newPageWidget.title);
  }
}, pageStack);

const currentPage = Widget.fromFuncs<RW>({
  read: () =>
    Var.toLit(
      Var.toLit(pageStack)[Var.toLit(pageStack).length - 1] ?? Widget.lit(),
    ),
  write: (w: WidgetLit) => List.push(pageStack, w),
  onChange: pageStack.onChange,
});

/** @Note Opens the given page. */
const openPage = (widget: WidgetLit = Widget.lit()) =>
  (currentPage.value = widget);

/** @Note Opens the given page. */
const closePage = () => List.pop(pageStack);

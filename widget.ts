//
//
//
//
//

// SECTION: Contents
type Contents = OneOrMore<R, Str | Bool | Num | Icon | Widget>;
const isContent = function (possibleContent: any): possibleContent is Contents {
  let isActuallyContent = false;
  if (Array.isArray(possibleContent)) {
    isActuallyContent = true;
    for (const i in possibleContent) {
      isActuallyContent = isActuallyContent && isContent(possibleContent[i]);
    }
  } else {
    isActuallyContent =
      Var.toLit(Str.is(possibleContent)) ||
      Var.toLit(Bool.is(possibleContent)) ||
      Var.toLit(Num.is(possibleContent)) ||
      _isIcon(possibleContent) ||
      Var.toLit(Widget.is(possibleContent));
  }
  return isActuallyContent;
};
type _contentCompiler = {
  isThisType: (contents: Contents) => boolean;
  compile: (params: {
    contents: any;
    parent: Widget<R>;
    startZIndex: number;
  }) => _ContentCompilationResults;
};
type _ContentCompilationResults = {
  htmlElements: Node[];
  widthGrows: Bool<R>;
  heightGrows: Bool<R>;
  greatestZIndex: number;
};
const _contentCompilers: _contentCompiler[] = [];
const _addNewContentCompiler = (newCompiler: _contentCompiler) =>
  _contentCompilers.push(newCompiler);
const compileContentsToHtml = function (params: {
  contents: Contents;
  parent: Widget<R>;
  startZIndex: number;
}): _ContentCompilationResults {
  for (const i in _contentCompilers) {
    if (_contentCompilers[i].isThisType(params.contents)) {
      return _contentCompilers[i].compile({
        contents: params.contents,
        parent: params.parent,
        startZIndex: params.startZIndex,
      });
    }
  }
  throw `Encountered an error in "miwi/widget.ts.compileContentsToHtml". Could not find a content compiler for ${JSON.stringify(
    params.contents,
    null,
    2,
  )}`;
};
_addNewContentCompiler({
  isThisType: (contents: Contents) => Array.isArray(contents),
  compile: function (params: {
    contents: (Str<R> | Bool<R> | Num<R> | Required<IconLit> | Widget<R>)[];
    parent: Widget<R>;
    startZIndex: number;
  }): _ContentCompilationResults {
    // We'll split arrays into their individual elements and recurssively convert them to html.
    const myInfo: _ContentCompilationResults = {
      htmlElements: [],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
    };
    for (let i in params.contents) {
      const thisWidgetInfo = compileContentsToHtml({
        contents: params.contents[i],
        parent: params.parent,
        startZIndex:
          Var.toLit(params.parent.contentAxis) === Axis.z
            ? myInfo.greatestZIndex + 1
            : params.startZIndex,
      });
      for (const j in thisWidgetInfo.htmlElements) {
        myInfo.htmlElements.push(thisWidgetInfo.htmlElements[j]);
      }
      myInfo.widthGrows = thisWidgetInfo.widthGrows || myInfo.widthGrows;
      myInfo.heightGrows = thisWidgetInfo.heightGrows || myInfo.heightGrows;
      myInfo.greatestZIndex = Math.max(
        myInfo.greatestZIndex,
        thisWidgetInfo.greatestZIndex,
      );
    }
    return myInfo;
  },
});

/** @About Since we don't have access to JSX or React, we use this instead as a short hand
 * for creating HTML elements. */
function createHtmlElement(params: {
  tag: string;
  content?: Node[] | Node;
  onClick?: () => void;
  style?: { [key: string]: Str<R> | Num<R> | Bool<R> };
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
      setLWhenRChanges(
        // We need to do "?? ``" because setting a style prop to undefined doesn't clear the old value
        (x) => ((htmlElement.style as any)[key] = Var.toLit(x) ?? ``),
        params.style[key],
      );
    }
  }

  // Add children
  if (exists(params.content)) {
    if (Array.isArray(params.content)) {
      for (const child of params.content) {
        htmlElement.appendChild(child);
      }
    } else {
      htmlElement.appendChild(params.content);
    }
  }

  return htmlElement;
}

//
//
//
//
//

// SECTION: Widget Styler
/** @About Used to put all widget styling in one spot. */
const widgetStyleBuilders: ((params: {
  widget: Widget<R>;
  parent: Widget<R>;
  childrenInfo: _ContentCompilationResults;
  startZIndex: number;
}) => _WidgetStylePart)[] = [];
type _WidgetStylePart = {
  scripts?: ((parent: HTMLElement) => void)[];
  preferParent?: { [key: string]: _WidgetCompilerStyleProp };
  preferChild?: { [key: string]: _WidgetCompilerStyleProp };
};
type _BasicWidgetCompilerStyleProp = Str<R> | Num<R> | Bool<R>;
type _WidgetCompilerStyleProp =
  | Var<R, _BasicWidgetCompilerStyleProp>
  | _BasicWidgetCompilerStyleProp;

/** @About Converts a widget to an html element along with some other stats. */
_addNewContentCompiler({
  isThisType: (contents: Contents) => exists((contents as any)?.htmlTag),
  compile: function (params: {
    contents: Widget<R>;
    parent: Widget<R>;
    startZIndex: number;
  }): _ContentCompilationResults {
    // Compile the children
    const childrenInfo = compileContentsToHtml({
      contents: params.contents.contents as Contents,
      parent: params.contents,
      startZIndex: params.startZIndex,
    });

    // Compile the styles
    const shouldCreateChild = Var.toLit(params.contents.contentAxis) === Axis.z;
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
        if (shouldCreateChild) {
          childStyle[key] = newProps.preferChild[key];
        } else {
          parentStyle[key] = newProps.preferChild[key];
        }
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
          tag: Var.toLit(params.contents.htmlTag),
          onClick: params.contents.onTap,
          style: parentStyle,
          content: shouldCreateChild
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
            : childrenInfo.htmlElements,
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
type FlexSize<P extends VarPerms = RW> = VarSubtype<P, typeof FlexSize>;
const FlexSize = Var.subtype({
  isThisType: (x) => exists(x.flex),
  defaultInsts: [{ flex: 1 as Num<RW> }],
});
type Size<P extends VarPerms = RW> = VarSubtype<P, typeof Size>;
const Size = Var.subtype({
  isThisType: (x) =>
    Var.toLit(Num.is(x)) || Var.toLit(Str.is(x)) || Var.toLit(FlexSize.is(x)),
  defaultInsts: [0, ``, ...FlexSize.defaultInsts],
  staticProps: {
    shrink: -1,
    grow: callable({
      call: (flex: number) => ({ flex }),
      flex: 1,
    }),
  },
});
const _getSizeGrows = (givenSize: Size<R>, childGrows: Bool<R>) =>
  or(FlexSize.is(givenSize), and(equ(givenSize, Size.shrink), childGrows));
widgetStyleBuilders.push(function (params: {
  widget: Widget<R>;
  parent: Widget<R>;
  childrenInfo: _ContentCompilationResults;
}) {
  const computeSizeInfo = (givenSize: Size<R>, childGrows: Bool<R>) => {
    const sizeGrows = _getSizeGrows(givenSize, childGrows);
    const exactSize = ifel(
      Str.is(givenSize),
      givenSize as Str<R>,
      ifel(
        and(not(equ(givenSize, Size.shrink)), not(sizeGrows)),
        numToStandardHtmlUnit(givenSize as Num<R>),
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
          (params.widget.height as FlexSize<R>).flex,
          ifel(heightGrows, 1, ``),
        ),
        ifel(
          FlexSize.is(params.widget.width),
          (params.widget.width as FlexSize<R>).flex,
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

const old_numToStandardHtmlUnit = (num: Num<R>) =>
  `${mul(num, div(_pageWidthVmin, 24))}vmin`;
const numToStandardHtmlUnit = (num: Num<R>) =>
  computed(() => `${mul(num, div(_pageWidthVmin, 24))}vmin`, [num]);

//
//
//
//
//

// SECTION: Box Decoration
// type HSV = `${number} ${number} ${number}`;
type Color<P extends VarPerms = R> = VarSubtype<P, typeof Color>;
const Color = Var.subtype({
  isThisType: (v) => typeof v === `string` && v.startsWith(`#`),
  defaultInsts: [`#ffffffff` as `#${string}`],
  staticProps: {
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
  } as const,
});
const _imageExtensions = [`.ico`, `.svg`, `.png`, `.jpg`, `.jpeg`] as const;
type ImageRef<P extends VarPerms> = VarSubtype<P, typeof ImageRef>;
const ImageRef = Var.subtype({
  isThisType: function (v) {
    if (typeof v === `string`) {
      for (const ext of _imageExtensions) {
        if (v.endsWith(ext)) return true;
      }
    }
    return false;
  },
  defaultInsts: [`icon.png` as `${string}${typeof _imageExtensions[number]}`],
});
/** @Note Describes the styling of the background of a widget. */
type Material<P extends VarPerms> = VarSubtype<P, typeof Material>;
const Material = Var.subtype({
  isThisType: (v) => Var.toLit(Color.is(v)) || Var.toLit(ImageRef.is(v)),
  defaultInsts: [...Color.defaultInsts, ...ImageRef.defaultInsts],
});
widgetStyleBuilders.push((params: { widget: Widget<R> }) => {
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
widgetStyleBuilders.push((params: { widget: Widget<R> }) => {
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
type Align<P extends VarPerms = RW> = VarSubtype<P, typeof Align>;
const Align = Var.subtype({
  isThisType: (x) => exists(x?.x) && exists(x?.y),
  defaultInsts: [{ x: 0 as Num<RW>, y: 0 as Num<RW> }],
  staticProps: {
    topLeft: { x: -1, y: 1 },
    topCenter: { x: 0, y: 1 },
    topRight: { x: 1, y: 1 },
    centerLeft: { x: -1, y: 0 },
    center: { x: 0, y: 0 },
    centerRight: { x: 1, y: 0 },
    bottomLeft: { x: -1, y: -1 },
    bottomCenter: { x: 0, y: -1 },
    bottomRight: { x: 1, y: -1 },
  },
});
widgetStyleBuilders.push(
  (params: {
    widget: Widget<R>;
    parent: Widget<R>;
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
                equ(params.childrenInfo.htmlElements.length, 1),
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
});
type Axis<P extends VarPerms> = VarSubtype<P, typeof Axis>;
const Axis = Var.subtype({
  isThisType: (x) => Object.values(_axisOptions).includes(x),
  defaultInsts: [
    _axisOptions.vertical as typeof _axisOptions[keyof typeof _axisOptions],
  ],
  staticProps: _axisOptions,
});
widgetStyleBuilders.push(
  (params: { widget: Widget<R>; startZIndex: number }) => {
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
  },
);

//
//
//
//
//

// SECTION: Content Is Scrollable
widgetStyleBuilders.push((params: { widget: Widget<R> }) => {
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
type Spacing<P extends VarPerms> = VarSubtype<P, typeof Spacing>;
const Spacing = Var.subtype({
  isThisType: (x) =>
    typeof x === `number` || Object.values(_spacingOptions).includes(x),
  defaultInsts: [0 as number, ...Object.values(_spacingOptions)],
  staticProps: _spacingOptions,
});
widgetStyleBuilders.push((params: { widget: Widget<R> }) => {
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
widgetStyleBuilders.push((params: { widget: Widget<R> }) => {
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

const numToFontSize = (num: Num<R>) => numToStandardHtmlUnit(mul(0.825, num));

//
//
//
//
//

// SECTION: Widget
/** @About Widgets are the building blocks of UIs. */
type Widget<P extends VarPerms = R> = VarSubtype<P, typeof Widget>;
const Widget = Var.subtype({
  isThisType: (x) => exists(x?.htmlTag),
  defaultInsts: [
    {
      width: Size.shrink as Size<R>,
      height: Size.shrink as Size<R>,
      cornerRadius: 0 as Num<R>,
      outlineColor: Color.transparent as Color<R>,
      outlineSize: 0.15 as Num<R>,
      background: Color.transparent as Material<R>,
      shadowSize: 0 as Num<R>,
      shadowDirection: Align.bottomRight as Align<R>,
      onTap: undefined as (() => void) | undefined,
      //interaction: { onTap: function() {}, onDoubleTap: function() {}, onLongPress: function() {}, }
      padding: 0 as Num<R>,
      contentAlign: Align.center as Align<R>,
      contentAxis: Axis.vertical as Axis<R>,
      contentIsScrollableX: false as Bool<R>,
      contentIsScrollableY: false as Bool<R>,
      contentSpacing: 0 as Spacing<R>,
      // contentStyle: style.deferToParent,
      textSize: 1 as Num<R>,
      textIsBold: false as Bool<R>,
      textIsItalic: false as Bool<R>,
      textColor: Color.black as Color<R>,
      contents: [] as OneOrMore<
        R,
        | Str<R>
        | Bool<R>
        | Num<R>
        | Required<IconLit>
        | { htmlTag: string; [key: string]: any }
        | Var<R, { htmlTag: string; [key: string]: any }>
      >,
      htmlTag: `div` as string,
      toString: function (): string {
        // Maybe swap to <MiwiWidget>{...json}</MiwiWidget>
        return `$$#@%${JSON.stringify(this)}%@#$$`;
      },
    },
  ],
});

type _WidgetTemplate = Widget<R> & {
  (options?: _WidgetConstructorOptions, ...contents: Contents[]): Widget<R>;
};
type _WidgetConstructorOptions =
  | Partial<OmitToNever<Widget<R>, `htmlTag` | `contents`>>
  | Contents;
type OmitToNever<T, Keys extends string | symbol | number> = Omit<T, Keys> & {
  [key in Keys]: never;
};

/** @About This is a shorthand for creating custom widgets */
function widgetTemplate<T extends Required<Omit<Widget<R>, `toString`>>>(
  defaultWidget: T,
): _WidgetTemplate {
  const build: any = function (
    invocationOptions?: _WidgetConstructorOptions,
    ...invocationContents: Contents[]
  ): Widget<R> {
    if (isContent(invocationOptions)) {
      invocationContents.unshift(invocationOptions);
      invocationOptions = {};
    }
    const newWidget: any = {};
    for (const key in defaultWidget) {
      newWidget[key] =
        (invocationOptions as any)?.[key] ?? (defaultWidget as any)[key];
    }
    // If no invocation contents are provided then we should use the default contents instead.
    if (invocationContents.length > 0) {
      newWidget.contents = invocationContents;
    }
    newWidget.toString = function (): string {
      // Maybe swap to <MiwiWidget>{...json}</MiwiWidget>
      return `$$#@%${JSON.stringify(newWidget)}%@#$$`;
    };
    return newWidget;
  };
  for (const key in defaultWidget) {
    build[key] = defaultWidget[key];
  }
  return build as _WidgetTemplate;
}

//
//
//
//
//

// SECTION: Icons
type Icon<P extends VarPerms = R> = VarSubtype<P, IconLit>;
const Icon = Var.subtype({
  isThisType: (x) => exists((x as any)?.icon),
  defaultInsts: Object.values(_iconsObj),
  staticProps: _iconsObj,
});
const _inlineContentOpenTag = `$$#@%`;
const _inlineContentCloseTag = `%@#$$`;
_addNewContentCompiler({
  isThisType: (x) => Var.toLit(Icon.is(x)),
  compile: function (params: {
    contents: Icon;
    parent: Widget<R>;
    startZIndex: number;
  }): _ContentCompilationResults {
    const textNode = document.createTextNode(
      params.contents.icon.startsWith(_numIconTag)
        ? params.contents.icon.substring(_numIconTag.length)
        : params.contents.icon,
    );
    setLWhenRChanges((x) => undefined, params.contents)
    const htmlElement = createHtmlElement({
      tag: `span`,
      class: `material-symbols-outlined`,
      style: {
        width: numToIconSize(params.parent.textSize),
        height: numToIconSize(params.parent.textSize),
        color: params.parent.textColor,
        display: `inline-block`,
        verticalAlign: `middle`,
        textAlign: `center`,
        fontSize: numToIconSize(params.parent.textSize),
      },
      content: [
        document.createTextNode(
          params.contents.icon.startsWith(_numIconTag)
            ? params.contents.icon.substring(_numIconTag.length)
            : params.contents.icon,
        ),
      ],
    });
    return {
      htmlElements: [htmlElement],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
    };
  },
});

/** @ About converts from standard Moa units to a size that makes sense for icons. */
const numToIconSize = (num: Num<R>) => numToStandardHtmlUnit(mul(0.9, num));

//
//
//
//
//

// SECTION: Content Literals
_addNewContentCompiler({
  isThisType: (contents: Contents) =>
    Var.toLit(Str.is(contents)) ||
    Var.toLit(Num.is(contents)) ||
    Var.toLit(Bool.is(contents)),
  compile: function (params: {
    contents: string | number | boolean;
    parent: Widget<R>;
    startZIndex: number;
  }): _ContentCompilationResults {
    const paragraphParts: Node[] = [];
    let greatestZIndex = params.startZIndex;
    if (typeof params.contents === `string`) {
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
          ) as Widget<R>,
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
    } else {
      const textNode = document.createTextNode(params.contents.toString());
      setLWhenRChanges(
        (x) => (textNode.nodeValue = x.toString()),
        params.contents,
      );
      paragraphParts.push(textNode);
    }

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
const rootProjectPath = `./`;
const rootOutputPath = `./website`;

const _pageWidthVmin = 40;
const _pageWidget = widgetTemplate({
  width: `100%`,
  height: `100%`,
  onTap: undefined,
  textSize: 2,
  textIsBold: true,
  textIsItalic: false,
  textColor: Color.black,
  cornerRadius: 0,
  outlineColor: Color.transparent,
  outlineSize: 0,
  background: Color.almostWhite,
  shadowSize: 0,
  shadowDirection: Align.center,
  padding: 0,
  contentAlign: Align.topCenter,
  contentAxis: Axis.vertical,
  contentIsScrollableX: false,
  contentIsScrollableY: false,
  contentSpacing: 0,
  contents: [],
  htmlTag: `div`,
});
function _defaultPageParams() {
  const params: any = {};
  params.name = `Untitled`;
  const defaultPageWidget = _pageWidget();
  for (const key in defaultPageWidget) {
    if (key !== `htmlTag` && key !== `contents`) {
      params[key] = (defaultPageWidget as any)[key];
    }
  }
  return params as Partial<
    Omit<Widget<R>, `htmlTag` | `width` | `height` | `contents`> & {
      name: string;
    }
  >;
}

/** @Note Describes a web page. */
const openPage = function (
  options = _defaultPageParams() as ReturnType<typeof _defaultPageParams>,
  ...contents: Contents[]
) {
  const currentPage = document.getElementById(`currentPage`);
  if (!exists(currentPage)) {
    // Normalize Params
    if (isContent(options)) {
      contents.unshift(options);
      options = _defaultPageParams();
    }

    // Render page
    document.getElementById(`pageParent`)?.appendChild(
      compileContentsToHtml({
        contents: _pageWidget(options, contents as Contents),
        parent: {
          width: Size.shrink,
          height: Size.shrink,
          cornerRadius: 0,
          outlineColor: Color.transparent,
          outlineSize: 0,
          background: Color.transparent,
          shadowSize: 0,
          shadowDirection: Align.center,
          onTap: () => {},
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
        },
        startZIndex: 0,
      }).htmlElements[0],
    );
    document.title = options.name!;
  }
};

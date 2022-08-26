//
//
//
//
//

// SECTION: Contents
type Contents = _SingleContentTypes | Contents[]; //Text | Bool | Num | Widget | Contents[];
type _SingleContentTypes =
  | string
  | boolean
  | number
  | Required<Icon>
  | Required<Widget>;
const isContent = function (possibleContent: any): possibleContent is Contents {
  let isActuallyContent = false;
  if (Array.isArray(possibleContent)) {
    isActuallyContent = true;
    for (const i in possibleContent) {
      isActuallyContent = isActuallyContent && isContent(possibleContent[i]);
    }
  } else {
    isActuallyContent =
      typeof possibleContent === `string` ||
      typeof possibleContent === `boolean` ||
      typeof possibleContent === `number` ||
      _isIcon(possibleContent) ||
      isWidget(possibleContent);
  }
  return isActuallyContent;
};
type _contentCompiler = {
  isThisType: (contents: Contents) => boolean;
  compile: (params: {
    contents: any;
    parent: Widget;
    startZIndex: number;
  }) => _ContentCompilationResults;
};
type _ContentCompilationResults = {
  htmlElements: Node[];
  widthGrows: boolean;
  heightGrows: boolean;
  greatestZIndex: number;
};
const _contentCompilers: _contentCompiler[] = [];
const _addNewContentCompiler = (newCompiler: _contentCompiler) =>
  _contentCompilers.push(newCompiler);
const compileContentsToHtml = function (params: {
  contents: Contents;
  parent: Widget;
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
  throw `Encountered an error in "miwi/widget.tsx.compileContentsToHtml". Could not find a content compiler for ${JSON.stringify(
    params.contents,
    null,
    2,
  )}`;
};
_addNewContentCompiler({
  isThisType: (contents: Contents) => Array.isArray(contents),
  compile: function (params: {
    contents: _SingleContentTypes[];
    parent: Widget;
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
          Var.toLit(params.parent.contentAxis) === axis.z
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

//
//
//
//
//

// SECTION: Widget
/** @About Widgets are the building blocks of UIs. */
interface Widget {
  width: Size;
  height: Size;
  cornerRadius: Num<R>;
  outlineColor: Color<R>;
  outlineSize: Num<R>;
  background: Material<R>;
  shadowSize: Num<R>;
  shadowDirection: Align;
  onTap: (() => void) | undefined;
  //interaction: { onTap: function() {}, onDoubleTap: function() {}, onLongPress: function() {}, }
  padding: Num<R>;
  contentAlign: Align;
  contentAxis: Axis<R>;
  contentIsScrollableX: Bool<R>;
  contentIsScrollableY: Bool<R>;
  contentSpacing: Spacing<R>;
  // contentStyle: style.deferToParent,
  textSize: Num<R>;
  textIsBold: Bool<R>;
  textIsItalic: Bool<R>;
  textColor: Color<R>;
  contents: Contents;
  htmlTag: string;
  toString: () => string;
}

const isWidget = (possibleWidget: any): possibleWidget is Widget =>
  exists(possibleWidget?.htmlTag);

type _WidgetTemplate = Required<Widget> & {
  (
    options?: _WidgetConstructorOptions,
    ...contents: Contents[]
  ): Required<Widget>;
};
type _WidgetConstructorOptions =
  | Partial<OmitToNever<Widget, `htmlTag` | `contents`>>
  | Contents;
type OmitToNever<T, Keys extends string | symbol | number> = Omit<T, Keys> & {
  [key in Keys]: never;
};

/** @About This is a shorthand for creating custom widgets */
function widgetTemplate<T extends Required<Omit<Widget, `toString`>>>(
  defaultWidget: T,
): _WidgetTemplate {
  const build: any = function (
    invocationOptions?: _WidgetConstructorOptions,
    ...invocationContents: Contents[]
  ): Required<Widget> {
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

/** @About Used to put all widget styling in one spot. */
const widgetStyleBuilders: ((params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: _ContentCompilationResults;
  startZIndex: number;
}) => _WidgetStylePart)[] = [];
type _WidgetStylePart = {
  scripts?: ((parent: HTMLElement) => void)[];
  preferParent?: { [key: string]: _WidgetCompilerStyleProp };
  preferChild?: { [key: string]: _WidgetCompilerStyleProp };
};
type _BasicWidgetCompilerStyleProp = string | number | boolean | undefined;
type _WidgetCompilerStyleProp =
  | Var<R, _BasicWidgetCompilerStyleProp>
  | _BasicWidgetCompilerStyleProp;

/** @About Converts a widget to an html element along with some other stats. */
_addNewContentCompiler({
  isThisType: (contents: Contents) => exists((contents as any)?.htmlTag),
  compile: function (params: {
    contents: Widget;
    parent: Widget;
    startZIndex: number;
  }): _ContentCompilationResults {
    // Compile the children
    const childrenInfo = compileContentsToHtml({
      contents: params.contents.contents,
      parent: params.contents,
      startZIndex: params.startZIndex,
    });

    // Create the html elements
    const newChildElement =
      Var.toLit(params.contents.contentAxis) === axis.z
        ? createHtmlElement({
            tag: `div`,
            style: {
              flexGrow: 1,
              alignSelf: `stretch`,
              backgroundColor: `green`,
            },
            content: childrenInfo.htmlElements,
          })
        : undefined;
    const newParentElement = createHtmlElement({
      tag: params.contents.htmlTag,
      content: exists(newChildElement)
        ? [newChildElement]
        : childrenInfo.htmlElements,
    });
    if (exists(params.contents.onTap)) {
      newParentElement.onclick = params.contents.onTap;
    }

    // Compile the styles
    const setUpStyleProp = function (
      key: string,
      prop: _WidgetCompilerStyleProp,
      htmlElement: HTMLElement,
    ) {
      if (Var.isVar(prop)) {
        // We need to do "?? ``" because setting a style prop to undefined doesn't clear the old value
        prop.onChange.addListener(
          () => ((htmlElement.style as any)[key] = prop.value ?? ``),
        );
        (htmlElement.style as any)[key] = prop.value ?? ``;
      } else {
        (htmlElement.style as any)[key] = prop;
      }
    };
    for (const i in widgetStyleBuilders) {
      const newProps = widgetStyleBuilders[i]({
        widget: params.contents,
        parent: params.parent,
        childrenInfo: childrenInfo,
        startZIndex: params.startZIndex,
      });
      for (const key in newProps.preferParent) {
        setUpStyleProp(key, newProps.preferParent[key], newParentElement);
      }
      for (const key in newProps.preferChild) {
        setUpStyleProp(
          key,
          newProps.preferChild[key],
          exists(newChildElement) ? newChildElement : newParentElement,
        );
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
      htmlElements: [newParentElement],
    };
  },
});

//
//
//
//
//

// SECTION: Width & Height
type Size = number | string | _SizeGrowConfig;
type _SizeGrowConfig = {
  flex: number;
};
const _getSizeGrows = (givenSize: Size, childGrows: boolean) =>
  _isSizeGrowConfig(givenSize) ||
  (givenSize == size.basedOnContents && childGrows);
function _isSizeGrowConfig(
  possibleGrowth: any,
): possibleGrowth is _SizeGrowConfig {
  return exists(possibleGrowth.flex);
}
const size = readonlyObj({
  exactly: function (num: number): Size {
    return num;
  },
  basedOnContents: -1 as Size,
  grow: (function () {
    const buildGrowth = function (flex: number) {
      return { flex: flex };
    };
    buildGrowth.flex = 1;
    return buildGrowth;
  })(),
});
widgetStyleBuilders.push(function (params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: _ContentCompilationResults;
}) {
  const computeSizeInfo = (givenSize: Size, childGrows: boolean) => {
    const sizeGrows = _getSizeGrows(givenSize, childGrows);
    const exactSize =
      typeof givenSize === `string`
        ? givenSize
        : givenSize !== size.basedOnContents && !sizeGrows
        ? old_numToStandardHtmlUnit(givenSize as number)
        : undefined;
    return [exactSize, sizeGrows];
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
      flexGrow:
        Var.toLit(params.parent.contentAxis) === axis.vertical
          ? _isSizeGrowConfig(params.widget.height)
            ? params.widget.height.flex
            : heightGrows
            ? 1
            : undefined
          : _isSizeGrowConfig(params.widget.width)
          ? params.widget.width.flex
          : widthGrows
          ? 1
          : undefined,
      alignSelf:
        (Var.toLit(params.parent.contentAxis) === axis.horizontal &&
          heightGrows) ||
        (Var.toLit(params.parent.contentAxis) === axis.vertical && widthGrows)
          ? `stretch`
          : undefined,
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
/** @Note Describes the styling of the background of a widget. */
type MaterialLiteral = ColorLiteralRGB | ImageRefLiteral;
type Material<P extends R | RW> = VarSubtype<P, MaterialLiteral>;
const Material = Var.subtype(
  (v: any): v is MaterialLiteral =>
    Var.toLit(Color.is(v)) || Var.toLit(ImageRef.is(v)),
);

// type HSV = `${number} ${number} ${number}`;
type Color<P extends R | RW> = VarSubtype<P, ColorLiteralRGB>;
const Color = Var.subtype(
  (v: any): v is ColorLiteralRGB => typeof v === `string` && v.startsWith(`#`),
);
type ColorLiteralRGB = `#${string}`;
const colors = readonlyObj({
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
type ImageRefLiteral = `${string}${typeof _imageExtensions[number]}`;
type ImageRef<P extends R | RW> = VarSubtype<P, ImageRefLiteral>;
const ImageRef = Var.subtype(function (v: any): v is ImageRefLiteral {
  if (typeof v === `string`) {
    for (const ext of _imageExtensions) {
      if (v.endsWith(ext)) return true;
    }
  }
  return false;
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
      backgroundColor: ifel(
        backgroundIsColor,
        params.widget.background,
        undefined,
      ),
      backgroundImage: ifel(
        backgroundIsColor,
        undefined,
        concat(`url(/images/`, params.widget.background, `)`),
      ),
      backgroundPosition: ifel(backgroundIsColor, undefined, `center`),
      backgroundSize: ifel(backgroundIsColor, undefined, `cover`),
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
        colors.grey,
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
type Align = { x: number; y: number };
const align = readonlyObj({
  topLeft: { x: -1, y: 1 } as Align,
  topCenter: { x: 0, y: 1 } as Align,
  topRight: { x: 1, y: 1 } as Align,
  centerLeft: { x: -1, y: 0 } as Align,
  center: { x: 0, y: 0 } as Align,
  centerRight: { x: 1, y: 0 } as Align,
  bottomLeft: { x: -1, y: -1 } as Align,
  bottomCenter: { x: 0, y: -1 } as Align,
  bottomRight: { x: 1, y: -1 } as Align,
});
widgetStyleBuilders.push(
  (params: {
    widget: Widget;
    parent: Widget;
    childrenInfo: _ContentCompilationResults;
  }) => {
    const myPosition =
      Var.toLit(params.parent.contentAxis) === axis.z ? `absolute` : `relative`;
    return {
      preferParent: {
        // Algin self when in a stack
        position: myPosition,
        margin:
          Var.toLit(params.parent.contentAxis) === axis.z
            ? `${params.parent.contentAlign.x === 0 ? `auto` : 0} ${
                params.parent.contentAlign.y === 0 ? `auto` : 0
              }`
            : 0,
        left:
          Var.toLit(params.parent.contentAxis) === axis.z &&
          params.parent.contentAlign.x === -1
            ? 0
            : undefined,
        top:
          Var.toLit(params.parent.contentAxis) === axis.z &&
          params.parent.contentAlign.y === 1
            ? 0
            : undefined,
        right:
          Var.toLit(params.parent.contentAxis) === axis.z &&
          params.parent.contentAlign.x === 1
            ? 0
            : undefined,
        bottom:
          Var.toLit(params.parent.contentAxis) === axis.z &&
          params.parent.contentAlign.y === -1
            ? 0
            : undefined,

        // Content Alignment: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
        justifyContent:
          // Exact spacing is handled through grid gap
          typeof params.widget.contentSpacing === `number`
            ? params.widget.contentAxis === axis.vertical
              ? params.widget.contentAlign.y === 1
                ? `flex-start`
                : params.widget.contentAlign.y === 0
                ? `safe center`
                : `flex-end`
              : params.widget.contentAlign.x === -1
              ? `flex-start`
              : params.widget.contentAlign.x === 0
              ? `safe center`
              : `flex-end`
            : params.widget.contentSpacing === spacing.spaceBetween &&
              params.childrenInfo.htmlElements.length === 1
            ? // For whatever reason, space-between with one item puts it at the start instead of centering it.
              spacing.spaceAround
            : params.widget.contentSpacing,
        alignItems:
          params.widget.contentAxis === axis.vertical
            ? params.widget.contentAlign.x === -1
              ? `flex-start`
              : params.widget.contentAlign.x === 0
              ? `safe center`
              : `flex-end`
            : params.widget.contentAlign.y === 1
            ? `flex-start`
            : params.widget.contentAlign.y === 0
            ? `safe center`
            : `flex-end`,
        textAlign:
          params.widget.contentAlign.x === -1
            ? `left`
            : params.widget.contentAlign.x === 0
            ? `center`
            : `right`,
      },
      preferChild: {
        position:
          params.widget.contentAxis === axis.z ? `relative` : myPosition,
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
type AxisLiteral = typeof axis[keyof typeof axis];
type Axis<P extends R | RW> = VarSubtype<P, AxisLiteral>;
const Axis = Var.subtype((x: any): x is AxisLiteral =>
  Object.values(axis).includes(x),
);
const axis = readonlyObj({
  horizontal: `horizontal`,
  vertical: `vertical`,
  z: `z`,
} as const);
widgetStyleBuilders.push((params: { widget: Widget; startZIndex: number }) => {
  return {
    preferParent: {
      flexDirection: ifel(
        equ(params.widget.contentAxis, axis.vertical),
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
        undefined, //`hidden`,
      ),
      overflowY: ifel(
        params.widget.contentIsScrollableY,
        `auto`, // Scroll when nesscary, and float above contents
        undefined, //`hidden`,
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
type SpacingLiteral = number | typeof spacing[keyof typeof spacing];
type Spacing<P extends R | RW> = VarSubtype<P, SpacingLiteral>;
const Spacing = Var.subtype(
  (x: any): x is SpacingLiteral =>
    typeof x === `number` || Object.values(spacing).includes(x),
);
const spacing = readonlyObj({
  spaceBetween: `space-between`,
  spaceAround: `space-around`,
  spaceEvenly: `space-evenly`,
} as const);
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferChild: {
      rowGap:
        params.widget.contentAxis === axis.vertical &&
        typeof params.widget.contentSpacing === `number`
          ? old_numToStandardHtmlUnit(params.widget.contentSpacing)
          : undefined,
      columnGap:
        params.widget.contentAxis === axis.horizontal &&
        typeof params.widget.contentSpacing === `number`
          ? old_numToStandardHtmlUnit(params.widget.contentSpacing)
          : undefined,
    },
  };
});

//
//
//
//
//

// SECTION: Text Style
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
      fontFamily: `Roboto`,
    },
    preferChild: {
      fontFamily: `Roboto`,
      fontSize: numToFontSize(params.widget.textSize),
      fontWeight: params.widget.textIsBold ? `bold` : undefined,
      fontStyle: params.widget.textIsItalic ? `italic` : undefined,
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

// SECTION: Icons
const icons = _iconsObj;
const _inlineContentOpenTag = `$$#@%`;
const _inlineContentCloseTag = `%@#$$`;
_addNewContentCompiler({
  isThisType: (contents: Contents) => exists((contents as any)?.icon),
  compile: function (params: {
    contents: Icon;
    parent: Widget;
    startZIndex: number;
  }): _ContentCompilationResults {
    return {
      htmlElements: [
        createHtmlElement({
          tag: `span`,
          class: `material-symbols-outlined`,
          style: {
            width: Var.toLit(numToIconSize(params.parent.textSize)),
            height: Var.toLit(numToIconSize(params.parent.textSize)),
            color: Var.toLit(params.parent.textColor),
            display: `inline-block`,
            verticalAlign: `middle`,
            textAlign: `center`,
            fontSize: Var.toLit(numToIconSize(params.parent.textSize)),
          },
          content: [
            document.createTextNode(
              params.contents.icon.startsWith(_numIconTag)
                ? params.contents.icon.substring(_numIconTag.length)
                : params.contents.icon,
            ),
          ],
        }),
      ],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
    };
  },
});

const numToIconSize = (num: Num<R>) => numToStandardHtmlUnit(mul(0.9, num));

//
//
//
//
//

// SECTION: Content Literals
_addNewContentCompiler({
  isThisType: (contents: Contents) =>
    typeof contents === `string` ||
    typeof contents === `number` ||
    typeof contents === `boolean`,
  compile: function (params: {
    contents: string | number | boolean;
    parent: Widget;
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
    } else {
      paragraphParts.push(document.createTextNode(params.contents.toString()));
    }
    return {
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
      htmlElements: [
        createHtmlElement({
          tag: `p`,
          style: {
            color: Var.toLit(params.parent.textColor),
            fontFamily: `Roboto`,
            fontSize: Var.toLit(numToFontSize(params.parent.textSize)),
            fontWeight: Var.toLit(
              ifel(params.parent.textIsBold, `bold`, undefined),
            ),
            fontStyle: Var.toLit(
              ifel(params.parent.textIsItalic, `italic`, undefined),
            ),
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
  textColor: colors.black,
  cornerRadius: 0,
  outlineColor: colors.transparent,
  outlineSize: 0,
  background: colors.almostWhite,
  shadowSize: 0,
  shadowDirection: align.center,
  padding: 0,
  contentAlign: align.topCenter,
  contentAxis: axis.vertical,
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
    Omit<Widget, `htmlTag` | `width` | `height` | `contents`> & { name: string }
  >;
}

/** @Note Describes a web page. */
const page = function (
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
        contents: _pageWidget(options, contents),
        parent: {
          width: size.basedOnContents,
          height: size.basedOnContents,
          cornerRadius: 0,
          outlineColor: colors.transparent,
          outlineSize: 0,
          background: colors.transparent,
          shadowSize: 0,
          shadowDirection: align.center,
          onTap: () => {},
          padding: 0,
          contentAlign: align.center,
          contentAxis: axis.vertical,
          contentIsScrollableX: false,
          contentIsScrollableY: false,
          contentSpacing: 0,
          textSize: 1,
          textIsBold: false,
          textIsItalic: false,
          textColor: colors.black,
          contents: [],
          htmlTag: `div`,
        },
        startZIndex: 0,
      }).htmlElements[0],
    );
    document.title = options.name!;
  }
};

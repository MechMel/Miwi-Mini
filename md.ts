const primaryMaterial = Color<RW>(Color.blue);
const hintMaterial = Color<RW>(`#c4c4c4`);

/** @About A box is the simplest UI widget. */
const box = Widget.template();

const link = ({ text = `link`, url = `tke.us` }) =>
  createHtmlElement({
    tag: `a`,
    href: url,
    target: "_blank",
    content: createTextNode(text),
  });

/** @About Describes a card. */
const card = Widget.template({
  width: Size.grow,
  height: Size.shrink,
  cornerRadius: 1,
  shadowSize: 1,
  shadowDirection: Align.bottomRight,
  padding: 1,
  background: Color.white,
  contentAlign: Align.center,
  contentAxis: Axis.vertical,
  contentSpacing: 1,
});

/** @About All the different kinds of buttons. */
const button = Widget.template({
  call: (...params: WidgetParams) =>
    Widget.lit(
      Widget.lit(
        _defaultWidget,
        {
          width: Size.shrink,
          height: Size.shrink,
          textColor: Color.white,
          cornerRadius: 0.5,
          outlineColor: Color.transparent,
          //outlineSize: 0.15,
          background: primaryMaterial,
          shadowSize: 0,
          shadowDirection: Align.bottomRight,
          padding: 0.5,
          contentAlign: Align.center,
          contentAxis: Axis.horizontal,
          contentSpacing: 0.5,
        },
        `Button`,
      ),
      ...params,
    ),

  /** @About A button with a solid, colored background. */
  solid: Widget.template(
    {
      width: Size.shrink,
      height: Size.shrink,
      textColor: Color.white,
      cornerRadius: 0.5,
      outlineColor: Color.transparent,
      outlineSize: 0.15,
      background: primaryMaterial,
      shadowSize: 0,
      shadowDirection: Align.bottomRight,
      padding: 0.5,
      contentAlign: Align.center,
      contentAxis: Axis.horizontal,
      contentSpacing: 0.5,
    },
    `Button`,
  ),

  /** @About A white button with colored text and a colored outline. */
  outlined: Widget.template(
    {
      width: Size.shrink,
      height: Size.shrink,
      textColor: primaryMaterial,
      cornerRadius: 0.5,
      outlineColor: primaryMaterial,
      outlineSize: 0.15,
      background: Color.white,
      shadowSize: 0,
      shadowDirection: Align.bottomRight,
      padding: 0.5,
      contentAlign: Align.center,
      contentAxis: Axis.horizontal,
      contentSpacing: 0.5,
    },
    `Button`,
  ),

  /** @About All button where both ends are circular. */
  pill: Widget.template(
    {
      width: Size.shrink,
      height: 2,
      textColor: Color.white,
      cornerRadius: 1,
      outlineColor: Color.transparent,
      outlineSize: 0.15,
      background: primaryMaterial,
      shadowSize: 0,
      shadowDirection: Align.bottomRight,
      padding: 0.5,
      contentAlign: Align.center,
      contentAxis: Axis.horizontal,
      contentSpacing: 0.5,
    },
    `Button`,
  ),

  /** @About A circular button. */
  round: Widget.template(
    {
      width: 4,
      height: 4,
      textColor: Color.white,
      textSize: 3,
      cornerRadius: 2,
      outlineColor: Color.transparent,
      outlineSize: 0.15,
      background: primaryMaterial,
      shadowSize: 0,
      shadowDirection: Align.bottomRight,
      padding: 0,
      contentAlign: Align.center,
      contentAxis: Axis.horizontal,
      contentSpacing: 0.5,
    },
    Icon.add,
  ),
});

/** @About Provides a back button that automatically appears and disappears when there are pages to return from. */
const backButton = Widget.template(
  {
    width: 1,
    height: 1,
    textSize: 2,
    textColor: Color.white,
    onTap: () => closePage(),
  },
  ifel(equ(List.len(pageStack), 1), [], Icon.arrow_back) as any,
);

/** @About An app bar is the colored bar at the top of a lot of apps. */
const appBar = Widget.template({
  call: (...params: WidgetParams) =>
    Widget.lit(
      Widget.lit(
        _defaultWidget,
        {
          width: Size.grow,
          height: Size.shrink,
          onTap: undefined,
          textSize: 2,
          textIsBold: true,
          textIsItalic: false,
          textColor: Color.white,
          cornerRadius: 0,
          outlineColor: Color.transparent,
          outlineSize: 0,
          background: primaryMaterial,
          shadowSize: 2,
          shadowDirection: Align.bottomCenter,
          padding: 1,
          contentAlign: Align.center,
          contentAxis: Axis.horizontal,
          overflowX: Overflow.clip,
          overflowY: Overflow.clip,
          contentSpacing: Spacing.spaceBetween,
          //htmlTag: `nav`,
        },
        backButton,
        computed(
          () =>
            extractConfigAndContentsFromWidgetParams(params)?.config?.title ??
            currentPage.title,
          [currentPage],
        ),
        box({ width: 1, height: 1 }),
      ),
      ...params,
    ),
});

/** @About This is how must page bodies are configured. */
const page = Widget.template({
  call: (
    ...params: WidgetParams<{
      title: Str;
      appBar: WidgetContent;
      floatingActionButton: WidgetContent;
      bottomNavBar: WidgetContent;
    }>
  ) => {
    const { config, contents } =
      extractConfigAndContentsFromWidgetParams(params);
    return box(
      {
        title: config?.title,
        width: `100%`,
        height: `100%`,
      },
      config?.appBar ?? appBar,
      Widget.lit(
        Widget.lit(_defaultWidget, {
          width: Size.grow,
          height: Size.grow,
          padding: 1,
          contentSpacing: 1,
          contentAlign: Align.topCenter,
          contentAxis: Axis.vertical,
          overflowY: Overflow.scroll,
        }),
        config,
        contents,
      ),
      /*box(
        {
          width: Size.grow,
          height: Size.shrink,
          padding: 1,
          contentAlign: Align.bottomRight,
        },
        config?.floatingActionButton ?? [],
      ),*/
      config?.bottomNavBar ?? [],
    );
  },
});

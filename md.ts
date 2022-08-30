/** @About A box is the simplest UI widget. */
// box.row([...]);
// box.column([...]);
// box.stack([...]);
const box = widgetTemplate({
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
});

/** @About A box is the simplest UI widget. */
const pageBody = widgetTemplate({
  width: Size.grow,
  height: Size.grow,
  onTap: undefined,
  cornerRadius: 0,
  outlineColor: Color.transparent,
  outlineSize: 0,
  background: Color.transparent,
  shadowSize: 0,
  shadowDirection: Align.center,
  padding: 1,
  contentAlign: Align.topCenter,
  contentAxis: Axis.vertical,
  contentIsScrollableX: false,
  contentIsScrollableY: true,
  contentSpacing: 1,
  textSize: 1,
  textIsBold: false,
  textIsItalic: false,
  textColor: Color.black,
  contents: [],
  htmlTag: `div`,
});

/** @About Describes a card. */
// card.row(...);
// card.column(...);
// card.stack(...);
const card = widgetTemplate({
  width: Size.grow,
  height: Size.shrink,
  onTap: undefined,
  textSize: 1,
  textIsBold: false,
  textIsItalic: false,
  textColor: Color.black,
  cornerRadius: 1,
  outlineColor: Color.transparent,
  outlineSize: 0,
  background: Color.white,
  shadowSize: 1,
  shadowDirection: Align.bottomRight,
  padding: 1,
  contentAlign: Align.center,
  contentAxis: Axis.vertical,
  contentIsScrollableX: false,
  contentIsScrollableY: false,
  contentSpacing: 1,
  contents: [],
  htmlTag: `div`,
});

/** @About All the different kinds of buttons. */
const button = readonlyObj({
  /** @About A button with a solid, colored background. */
  solid: widgetTemplate({
    width: Size.shrink,
    height: Size.shrink,
    onTap: undefined,
    textSize: 1,
    textIsBold: false,
    textIsItalic: false,
    textColor: Color.white,
    cornerRadius: 0.5,
    outlineColor: Color.transparent,
    outlineSize: 1.5,
    background: Color.blue,
    shadowSize: 0,
    shadowDirection: Align.bottomRight,
    padding: 0.5,
    contentAlign: Align.center,
    contentAxis: Axis.horizontal,
    contentIsScrollableX: false,
    contentIsScrollableY: false,
    contentSpacing: 0,
    contents: `Button`,
    htmlTag: `button`,
  }),

  /** @About A white button with colored text and a colored outline. */
  outlined: widgetTemplate({
    width: Size.shrink,
    height: Size.shrink,
    onTap: undefined,
    textSize: 1,
    textIsBold: false,
    textIsItalic: false,
    textColor: Color.blue,
    cornerRadius: 0.5,
    outlineColor: Color.blue,
    outlineSize: 0.15,
    background: Color.white,
    shadowSize: 0,
    shadowDirection: Align.bottomRight,
    padding: 0.5,
    contentAlign: Align.center,
    contentAxis: Axis.horizontal,
    contentIsScrollableX: false,
    contentIsScrollableY: false,
    contentSpacing: 0,
    contents: `Button`,
    htmlTag: `button`,
  }),

  /** @About All button where both ends are circular. */
  pill: widgetTemplate({
    width: Size.shrink,
    height: 2,
    onTap: undefined,
    textSize: 1,
    textIsBold: false,
    textIsItalic: false,
    textColor: Color.white,
    cornerRadius: 1,
    outlineColor: Color.transparent,
    outlineSize: 1.5,
    background: Color.blue,
    shadowSize: 0,
    shadowDirection: Align.bottomRight,
    padding: 0.75,
    contentAlign: Align.center,
    contentAxis: Axis.horizontal,
    contentIsScrollableX: false,
    contentIsScrollableY: false,
    contentSpacing: 0,
    contents: `Button`,
    htmlTag: `button`,
  }),

  /** @About A circular button. */
  round: widgetTemplate({
    width: 2,
    height: 2,
    onTap: undefined,
    textSize: 1,
    textIsBold: false,
    textIsItalic: false,
    textColor: Color.white,
    cornerRadius: 1,
    outlineColor: Color.transparent,
    outlineSize: 1.5,
    background: Color.blue,
    shadowSize: 0,
    shadowDirection: Align.bottomRight,
    padding: 0.5,
    contentAlign: Align.center,
    contentAxis: Axis.horizontal,
    contentIsScrollableX: false,
    contentIsScrollableY: false,
    contentSpacing: 0,
    contents: Icon.add,
    htmlTag: `button`,
  }),
});

/** @About An app bar is the colored bar at the top of a lot of apps. */
const appBar = widgetTemplate({
  width: Size.grow,
  height: Size.shrink,
  onTap: undefined,
  textSize: 1.5,
  textIsBold: true,
  textIsItalic: false,
  textColor: Color.white,
  cornerRadius: 0,
  outlineColor: Color.transparent,
  outlineSize: 0,
  background: Color.blue,
  shadowSize: 2,
  shadowDirection: Align.bottomCenter,
  padding: 0.75,
  contentAlign: Align.center,
  contentAxis: Axis.horizontal,
  contentIsScrollableX: false,
  contentIsScrollableY: false,
  contentSpacing: Spacing.spaceBetween,
  contents: `Untitled`,
  htmlTag: `nav`,
});

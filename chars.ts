/** @About A reactive, characters variable. */
type Chars<P extends R | RW = RW> = VarSubtype<P, string>;
const Chars = Var.subtype((x: any): x is string => typeof x === `string`);

/** @About Stacks a bunch of chars together. */
const concat = (...args: Chars<R>[]) =>
  computed(
    () => args.reduce((x, y) => Var.toLit(x).concat(Var.toLit(y))) as string,
    args,
  );

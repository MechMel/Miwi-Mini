/** @About A reactive, characters variable. */
type Str<P extends VarPerms = R> = VarSubtype<P, string>;
const Str = Var.newType({
  is: (x) => typeof x === `string`,
  construct: (val: string = ``) => val,
});

// Str.space & Str.empty

/** @About Stacks a bunch of chars together. */
const concat = (...args: VarOrLit<R, string | number | boolean>[]) =>
  computed(
    () =>
      args.reduce((x, y) =>
        Var.toLit(x).toString().concat(Var.toLit(y).toString()),
      ) as string,
    args,
  );

/** @About Pads the start of x with up to y z's. */
const padStart = (
  x: VarOrLit<R, string | number>,
  y: Num<R>,
  z: VarOrLit<R, string | number>,
) =>
  computed(
    () =>
      Var.toLit(x).toString().padStart(Var.toLit(y), Var.toLit(z).toString()),
    [x, y, z],
  );

/** @About Pads the end of x with up to y z's. */
const padEnd = (
  x: VarOrLit<R, string | number>,
  y: Num<R>,
  z: VarOrLit<R, string | number>,
) =>
  computed(
    () => Var.toLit(x).toString().padEnd(Var.toLit(y), Var.toLit(z).toString()),
    [x, y, z],
  );

/** @About A reactive, numeric variable. */
type Num<P extends VarPerms = R> = Type<P, typeof Num>;
const Num = Var.newType({
  is: (x) => typeof x === `number`,
  construct: (v: number = 0) => v,
});

/** @About A numeric addition operator that automatically determines whether to be reative or not. */
const add = (...args: Num[]) =>
  computed(
    () => args.reduce((x, y) => Var.toLit(x) + Var.toLit(y)) as number,
    args,
  );

/** @About A numeric subtraction operator that automatically determines whether to be reative or not. */
const sub = (x: Num, y: Num) =>
  computed(() => Var.toLit(x) - Var.toLit(y), [x, y]);

/** @About A numeric multiplication operator that automatically determines whether to be reative or not. */
const mul = (...args: Num[]) =>
  computed(
    () => args.reduce((x, y) => Var.toLit(x) * Var.toLit(y)) as number,
    args,
  );

/** @About A numeric division operator that automatically determines whether to be reative or not. */
const div = (x: Num, y: Num) =>
  computed(() => Var.toLit(x) / Var.toLit(y), [x, y]);

/** @About A numeric modulus operator that automatically determines whether to be reative or not. */
const mod = (x: Num, y: Num) =>
  computed(() => Var.toLit(x) % Var.toLit(y), [x, y]);

/** @About Round up to integer. */
const ceil = (x: Num) => computed(() => Math.ceil(Var.toLit(x)), [x]);

/** @About Round to integer. */
const round = (x: Num) => computed(() => Math.round(Var.toLit(x)), [x]);

/** @About Round down to integer. */
const floor = (x: Num) => computed(() => Math.floor(Var.toLit(x)), [x]);

/** @About Returns the maximum. */
const max = (...args: Num[]) =>
  computed(() => Math.max(...args.map((x) => Var.toLit(x))), args);

/** @About Returns the maximum. */
const min = (...args: Num[]) =>
  computed(() => Math.min(...args.map((x) => Var.toLit(x))), args);

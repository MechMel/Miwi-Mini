/** @About A reactive, numeric variable. */
type Num<P extends VarPerms = R> = VarSubtype<P, typeof Num>;
const Num = Var.subtype({
  isThisType: (x) => typeof x === `number`,
  defaultInsts: [0],
});

/** @About A numeric addition operator that automatically determines whether to be reative or not. */
const add = (...args: Num<R>[]) =>
  computed(
    () => args.reduce((x, y) => Var.toLit(x) + Var.toLit(y)) as number,
    args,
  );

/** @About A numeric subtraction operator that automatically determines whether to be reative or not. */
const sub = (x: Num<R>, y: Num<R>) =>
  computed(() => Var.toLit(x) - Var.toLit(y), [x, y]);

/** @About A numeric multiplication operator that automatically determines whether to be reative or not. */
const mul = (...args: Num<R>[]) =>
  computed(
    () => args.reduce((x, y) => Var.toLit(x) * Var.toLit(y)) as number,
    args,
  );

/** @About A numeric division operator that automatically determines whether to be reative or not. */
const div = (x: Num<R>, y: Num<R>) =>
  computed(() => Var.toLit(x) / Var.toLit(y), [x, y]);

/** @About A numeric modulus operator that automatically determines whether to be reative or not. */
const mod = (x: Num<R>, y: Num<R>) =>
  computed(() => Var.toLit(x) % Var.toLit(y), [x, y]);

/** @About Round up to integer. */
const ceil = (x: Num<R>) => computed(() => Math.ceil(Var.toLit(x)), [x]);

/** @About Round to integer. */
const round = (x: Num<R>) => computed(() => Math.round(Var.toLit(x)), [x]);

/** @About Round down to integer. */
const floor = (x: Num<R>) => computed(() => Math.floor(Var.toLit(x)), [x]);

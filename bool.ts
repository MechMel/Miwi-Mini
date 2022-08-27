/** @About A reactive, boolean variable. */
type Bool<P extends R | RW = RW> = VarSubtype<P, boolean>;
const Bool = Var.subtype((x: any): x is boolean => typeof x === `boolean`);

/** @About A boolean "and" operator that automatically determines whether to be reactive or not. */
const and = (...args: Bool<R>[]) =>
  computed(
    () => args.reduce((x, y) => x && Var.toLit(y), true) as boolean,
    args,
  );

/** @About A boolean "or" operator that automatically determines whether to be reactive or not. */
const or = (...args: Bool<R>[]) =>
  computed(
    () => args.reduce((x, y) => x || Var.toLit(y), false) as boolean,
    args,
  );

/** @About A boolean "not" operator that automatically determines whether to be reactive or not. */
const not = (x: Bool<R>) => computed(() => !Var.toLit(x), [x]);

/** @About A variant of "C ? T: F" that automatically determines whether to be reactive or not. */
const ifel = <T, F>(
  condition: Bool<R>,
  onTrue: VarOrLit<R, T>,
  onFalse: VarOrLit<R, F>,
) =>
  computed(
    () => (Var.toLit(condition) ? Var.toLit(onTrue) : Var.toLit(onFalse)),
    // If the condition is not reactive, then might as well simplify the reaction chain
    Var.isVar(condition)
      ? [condition, onTrue, onFalse]
      : condition
      ? [onTrue]
      : [onFalse],
  );

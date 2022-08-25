/** @About A reactive, boolean variable. */
type Bool<P extends R | RW = RW> = Var<P, boolean>;
const Bool = Var.subtype((x: any): x is boolean => typeof x === `boolean`);

/** @About A boolean "and" operator that automatically determines whether to be reative or not. */
const and = function <X extends VarOrLit<Bool<R>>, Y extends VarOrLit<Bool<R>>>(
  x: X,
  y: Y,
): X extends Bool<R> ? Bool<R> : Y extends Bool<R> ? Bool<R> : boolean {
  if (Var.isThisType(x) && Var.isThisType(y)) {
    return computed(() => x.value && y.value, [x.onChange, y.onChange]) as any;
  } else if (Var.isThisType(x)) {
    return computed(() => x.value && y, [x.onChange]) as any;
  } else if (Var.isThisType(y)) {
    return computed(() => x && y.value, [y.onChange]) as any;
  } else {
    return (x && y) as any;
  }
};

/** @About A boolean "or" operator that automatically determines whether to be reative or not. */
const or = function <X extends VarOrLit<Bool<R>>, Y extends VarOrLit<Bool<R>>>(
  x: X,
  y: Y,
): X extends Bool<R> ? Bool<R> : Y extends Bool<R> ? Bool<R> : boolean {
  if (Var.isThisType(x) && Var.isThisType(y)) {
    return computed(() => x.value || y.value, [x.onChange, y.onChange]) as any;
  } else if (Var.isThisType(x)) {
    return computed(() => x.value || y, [x.onChange]) as any;
  } else if (Var.isThisType(y)) {
    return computed(() => x || y.value, [y.onChange]) as any;
  } else {
    return (x || y) as any;
  }
};

/** @About A boolean "not" operator that automatically determines whether to be reative or not. */
const not = <X extends VarOrLit<Bool<R>>>(x: X): X =>
  (Var.isThisType(x) ? computed(() => !x.value, [x.onChange]) : x) as any;

/** @About A variant of "C ? T: F" that automatically determines whether to be reative or not. */
const ifel = function <C extends VarOrLit<Bool<R>>, T, F>(
  condition: C,
  onTrue: T,
  onFalse: F,
): C extends Bool<R>
  ? T extends Var<R, any>
    ? F extends Var<R, any>
      ? T | F
      : T | Var<R, F>
    : F extends Var<R, any>
    ? Var<R, T> | F
    : Var<R, T> | Var<R, F>
  : C extends true
  ? T
  : F {
  if (Var.isThisType(condition)) {
    if (Var.isThisType(onTrue) && Var.isThisType(onFalse)) {
      return computed(
        () => (condition.value ? onTrue.value : onFalse.value),
        [condition.onChange, onTrue.onChange, onFalse.onChange],
      ) as any;
    } else if (Var.isThisType(onTrue)) {
      return computed(
        () => (condition.value ? onTrue.value : onFalse),
        [condition.onChange, onTrue.onChange],
      ) as any;
    } else if (Var.isThisType(onFalse)) {
      return computed(
        () => (condition.value ? onTrue : onFalse.value),
        [condition.onChange, onFalse.onChange],
      ) as any;
    } else {
      return computed(
        () => (condition.value ? onTrue : onFalse),
        [condition.onChange],
      ) as any;
    }
  } else {
    return (condition ? onTrue : onFalse) as any;
  }
};

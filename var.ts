/** @About Represents a basic event that can be listened to. */
type VarEvent = ReturnType<typeof VarEvent>;
const VarEvent = callable({
  call: function ({
    listeners = [] as (() => any)[],
    triggers = [] as { addListener: (listener?: () => any) => void }[],
  } = {}) {
    const trigger = () => listeners.forEach((listener) => listener());
    for (const t of triggers) t.addListener(trigger);
    return {
      addListener: function (listener?: () => any) {
        if (exists(listener) && !listeners.includes(listener!)) {
          listeners.push(listener!);
        }
      },

      removeListener: (listenerToRemove?: () => any) =>
        listeners.filter((listener) => listener !== listenerToRemove),

      trigger: trigger,
    };
  },

  /** @About Checks whether or not the given value is a VarEvent. */
  isThisType: (x: any): boolean => exists(x?.addListener),
});

/** @About Provides read access to a Var. */
type R = { r: true };
/** @About Provides write access to a Var. */
type W = { w: true };
/** @About Provides both read and write access to a Var. */
type RW = R & W;

// TypeScript doesn't yet suport write only
type VarFromFuncsParams<P extends R | RW, T> = {
  read(): T;
  readonly onChange: VarEvent;
} & (P extends W ? { write(newVal: T): void } : {});

/** @About Represents a simple variable. */
type Var<P extends R | RW, T> = {
  get value(): T;
  get onChange(): VarEvent;
  toString(): string;
} & (P extends W
  ? {
      _assertRW: undefined;
      set value(newVal: T);
    }
  : {});
const Var = callable({
  /** @About Creates a Var from an inital value. */
  call: <P extends R | RW, T>(val: T) =>
    Var.fromFuncs<P, T>({
      read: () => val,
      onChange: VarEvent(),
      write: function (newVal: T) {
        // Ideally, we don't want to trigger the onChange event unless something has actually changed.
        if (newVal !== val) {
          val = newVal;
          this.onChange.trigger();
        }
      },
    } as any),

  /** @About Creates a Var from read and write functions. */
  fromFuncs: <P extends R | RW, T>(funcs: VarFromFuncsParams<P, T>) =>
    ({
      get value() {
        return funcs.read();
      },

      set value(newVal: any) {
        (funcs as any).write?.(newVal);
      },

      get onChange() {
        return funcs.onChange;
      },

      toString() {
        return String(this.value);
      },

      // https://stackoverflow.com/a/71560711
      // We can't infer this yet beacuse Prettier doesn't like "ReturnType<typeof Var<P, T>>".
    } as Var<P, T>),

  /** @About Checks whether or not the given value is a variable of any sort. */
  // We can't check "exists(x?.value)" beacuse sometimes value exists, but returns undefined.
  isVar: (x: any): x is Var<any, any> => exists((x as any)?.onChange),

  toLit: <T>(x: T): VarToLit<T> => (Var.isVar(x) ? x.value : x) as any,

  /** @About Creates a var for a specific, literal type. The standard format is:
   *
   * type Num<P extends R | RW = RW> = VarSubtype<P, number>;
   * const Num = Var.subtype((x: any): x is number => typeof x === `number`);
   */
  subtype: <T = any>(isThisType: (v: any) => v is T) =>
    callable({
      /** @About Creates a Var from an inital value. */
      call: <P extends R | RW = RW>(initVal: T) => Var<P, T>(initVal),

      /** @About Creates a Var from read and write functions. */
      fromFuncs: <P extends R | RW>(funcs: VarFromFuncsParams<P, T>) =>
        Var.fromFuncs<P, T>(funcs),

      /** @About Checks whether or not the given value is a variable of this type and returns a
       * reactive boolean. */
      is: (x: any) => computed(() => isThisType(Var.toLit(x)), [x]),

      // TODO: Allow subtypes of subtypes of var. For example, Color could be a subtype of Chars.
    }),
});

/** @About Accepts either a Var with its literal type. e.g. "Bool<R> | boolean" */
type VarOrLit<V extends Var<R, any>> = V | V[`value`];

/** @About Converts the given type from a var to a lit or from a lit to a itself. */
type VarToLit<V> = V extends Var<R, any> ? V[`value`] : V;

/** @About This is how we usually handle subtypes of Var.
 *
 * type Num<P extends R | RW = RW> = VarSubtype<P, number>;
 */
type VarSubtype<P extends R | RW, T> = VarOrLit<Var<P, T>>;

/** @About Checks whether or not the two given Vars are equal. */
const equ = (x: VarOrLit<Var<R, any>>, y: VarOrLit<Var<R, any>>) =>
  computed(() => Var.toLit(x) === Var.toLit(y), [x, y]);

/** @About Sets the left hand value to the right hand value. */
/*const set = <T>(
  l: Var<RW, T> | ((newVal: T) => void),
  r: VarOrLit<Var<R, T>>,
) => (Var.isVar(l) ? (l.value = Var.toLit(r)) : l(Var.toLit(r)));*/

/** @About Calls the left hand set function whenever the right hand value changes. */
const setLWhenRChanges = <T>(
  l: (newVal: T) => void,
  r: VarOrLit<Var<R, T>>,
) => {
  if (Var.isVar(r)) r.onChange.addListener(() => l(Var.toLit(r)));
  l(Var.toLit(r));
};

/** @About An easy short hand to create a computed, read-only Var. */
const computed = function <T>(
  compute: () => T,
  triggers: (VarOrLit<Var<R, any>> | VarEvent)[],
): VarOrLit<Var<R, T>> {
  const normalizedTriggers: VarEvent[] = triggers
    // Convert vars to events
    .map((x) => (Var.isVar(x) ? x.onChange : x))
    // Ignore literals
    .filter(VarEvent.isThisType);
  // If there is nothing to react to, just return a literal
  if (normalizedTriggers.length === 0) {
    return compute();
  } else {
    // Caching the computed value has significat performance benefits
    let cachedVal: T;
    let haveCachedVal = false;
    const onChange = VarEvent();
    const trypUpdateCachedVal = () => {
      const newVal = compute();
      // Ideally, we don't want to trigger the onChange event unless something has actually changed.
      if (!haveCachedVal || cachedVal !== newVal) {
        cachedVal = newVal;
        haveCachedVal = true;
        onChange.trigger();
      }
    };
    for (const t of normalizedTriggers) t.addListener(trypUpdateCachedVal);
    return Var.fromFuncs<R, T>({
      read: function () {
        if (!haveCachedVal) trypUpdateCachedVal();
        return cachedVal;
      },
      onChange: onChange,
    });
  }
};

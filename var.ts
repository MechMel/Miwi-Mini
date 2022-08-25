/** @About Represents a basic event that can be listened to. */
type VarEvent = ReturnType<typeof VarEvent>;
const VarEvent = function ({
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
};

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
} & (P extends W
  ? {
      _assertRW: undefined;
      set value(newVal: T);
    }
  : {});
const Var = callable({
  /** @About Creates a Var from an inital value. */
  call: <P extends R | RW, T>(initVal: T) =>
    Var.fromFuncs<P, T>({
      read: () => initVal,
      onChange: VarEvent(),
      write: function (newVal: T) {
        initVal = newVal;
        this.onChange.trigger();
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

      // https://stackoverflow.com/a/71560711
      // We can't infer this yet beacuse Prettier doesn't like "ReturnType<typeof Var<P, T>>".
    } as Var<P, T>),

  /** @About Checks whether or not the given value is a variable of any sort. */
  // We can't check "exists(x?.value)" beacuse sometimes value exists, but returns undefined.
  isThisType: (x: any): x is Var<any, any> => exists(x?.onChange),

  /** @About Creates a var for a specific, literal type. The standard format is:
   *
   * type Num<P extends R | RW = RW> = Var<P, number>;
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
      isThisType: (x: any) =>
        computed(
          () => Var.isThisType(x) && isThisType(x.value),
          Var.isThisType(x) ? [x.onChange] : [],
        ),
    }),
});

/** @About Accepts either a Var with its literal type. e.g. "Bool<R> | boolean" */
type VarOrLit<V extends Var<R, any>> = V | V[`value`];

/** @About An easy short hand to create a computed, read-only var. */
const computed = function <T = any>(
  compute: () => T,
  triggers: VarEvent[],
): Var<R, T> {
  // Caching the value has significat performance beenfits
  let cachedVal: T;
  let haveCachedVal = false;
  const tryCompute = function () {
    try {
      cachedVal = compute();
      haveCachedVal = true;
    } catch (e) {
      console.log(e);
    }
  };
  const onChange = VarEvent();
  onChange.addListener(tryCompute);
  for (const t of triggers) t.addListener(onChange.trigger);
  return Var.fromFuncs<R, T>({
    read: function () {
      if (!haveCachedVal) tryCompute();
      return cachedVal;
    },
    onChange: onChange,
  });
};

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
  [Key in  // We get rid of string's props because TypeScript `#${string}` counts as a string object not a string literal
    | (keyof (T extends string
        ? {}
        : T extends { [key: string]: any }
        ? T
        : {}) &
        string)
    | `toString`
    | `value`
    | `onChange`
    | `_assertRW`]: Key extends `toString`
    ? () => string
    : Key extends `value`
    ? T
    : Key extends `onChange`
    ? VarEvent
    : Key extends `_assertRW`
    ? undefined
    : Key extends keyof T
    ? T[Key] extends Function | undefined
      ? T[Key]
      : Var<
          GetVarPerms<T[Key]>,
          T[Key] extends Var<R, any> ? T[Key][`value`] : T[Key]
        >
    : undefined;
};
type Wrap<T> = Map<string, T>;
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
  fromFuncs: <P extends R | RW, T>(
    funcs: VarFromFuncsParams<P, T>,
  ): Var<P, T> =>
    new Proxy(
      {
        toString() {
          return String(funcs.read());
        },
      } as any,
      {
        get(obj, prop, reciever): any {
          switch (prop) {
            case `value`:
              return funcs.read();
            case `onChange`:
              return funcs.onChange;
            case `_assertRW`:
              return undefined;
            case `toString`:
              return () => String(funcs.read());
            // This should only get triggered if this is an object Var.
            default:
              const propVal = (funcs.read() as any)[prop];
              if (propVal === undefined || typeof propVal === `function`) {
                return propVal;
              } else {
                const onChange = VarEvent();
                let oldPropOnChange: VarEvent | undefined = undefined;
                funcs.onChange.addListener(() => {
                  if (exists(oldPropOnChange))
                    oldPropOnChange.removeListener(onChange.trigger);
                  const inst: any = funcs.read();
                  if (Var.isVar(inst[prop])) {
                    inst[prop].onChange.addListener(onChange.trigger);
                    oldPropOnChange = inst[prop].onChange;
                  }
                  onChange.trigger;
                });
                return Var.fromFuncs({
                  read: () => Var.toLit((funcs.read() as any)[prop]),
                  write: (newVal) => {
                    const inst: any = funcs.read();
                    if (Var.isVar(inst[prop])) {
                      inst[prop].value = newVal;
                    } else {
                      inst[prop] = newVal;
                    }
                  },
                  onChange: onChange,
                });
              }
          }
        },

        set(obj, prop, newVal) {
          switch (prop) {
            case `value`:
              (funcs as any).write?.(newVal);
              break;
            default:
              throw `Props of Var<R | RW, Obj> should not be set.`;
          }
          return true;
        },

        // https://stackoverflow.com/a/71560711
        // We can't infer this yet beacuse Prettier doesn't like "ReturnType<typeof Var<P, T>>".
      },
    ) as Var<P, T>,

  /** @About Checks whether or not the given value is a variable of any sort. */
  // We can't check "exists(x?.value)" beacuse sometimes value exists, but returns undefined.
  isVar: <P extends R | RW, T>(x: Var<P, T> | T): x is Var<P, T> =>
    exists((x as any)?.onChange),

  toLit: <T>(x: VarOrLit<R, T>): T => (Var.isVar(x) ? x.value : x) as any,

  /** @About Creates a var for a specific, literal type. The standard format is:
   *
   * type Num<P extends R | RW = RW> = VarSubtype<P, number>;
   * const Num = Var.subtype((x: any): x is number => typeof x === `number`);
   */
  subtype: <T = any>(isThisType: (v: any) => v is T) =>
    callable({
      /** @About Creates a Var from an inital value. */
      call: <P extends R | RW = RW>(val: T) => Var<P, T>(val),

      /** @About Creates a Var from read and write functions. */
      fromFuncs: <P extends R | RW>(funcs: VarFromFuncsParams<P, T>) =>
        Var.fromFuncs<P, T>(funcs),

      /** @About Checks whether or not the given value is a variable of this type and returns a
       * reactive boolean. */
      is: (x: any) => computed(() => isThisType(Var.toLit(x)), [x]),

      // TODO: Allow subtypes of subtypes of var. For example, Color could be a subtype of Chars.
    }),
});

/** @About Accepts either a Var or its literal type. e.g. "Bool<R> | boolean" */
type VarOrLit<P extends R | RW, T> = T | Var<P, T>;

/** @About Retrieves the read/write permissions of any type. */
// We assume that literals should be treated as read-only, because they are used when a value doesn't change.
type GetVarPerms<V> = V extends Var<RW, any> ? RW : R;

/** @About This is how we usually handle subtypes of Var.
 *
 * type Num<P extends R | RW = RW> = VarSubtype<P, number>;
 */
type VarSubtype<P extends R | RW, T> = VarOrLit<P, T>;

/** @About Checks whether or not the two given Vars are equal. */
const equ = (x: VarOrLit<R, any>, y: VarOrLit<R, any>) =>
  computed(() => Var.toLit(x) === Var.toLit(y), [x, y]);

/** @About Calls the left hand set function whenever the right hand value changes. */
const setLWhenRChanges = <T>(l: (newVal: T) => void, r: VarOrLit<R, T>) => {
  if (Var.isVar(r)) r.onChange.addListener(() => l(Var.toLit(r)));
  l(Var.toLit(r));
};

/** @About An easy short hand to create a computed, read-only Var. */
const computed = function <T>(
  compute: () => T,
  triggers: (VarOrLit<R, any> | VarEvent)[],
): VarOrLit<R, T> {
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

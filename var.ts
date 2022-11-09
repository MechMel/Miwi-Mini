/** @About Represents a basic event that can be listened to. */
type OnChange = ReturnType<typeof OnChange>;
const OnChange = callable({
  call: function ({
    listeners = [] as (() => any)[],
    triggers = [] as { addListener: (listener?: () => any) => void }[],
  } = {}) {
    const trigger = () => listeners.forEach((listener) => listener());
    for (const t of triggers) t.addListener(trigger);
    return {
      // Maybe provide an add and run options
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
/** @About A union of all the legal Var permissions. */
type VarPerms = R | RW;

// TypeScript doesn't yet suport write only
type VarFromFuncsParams<P extends VarPerms, T> = {
  // Have these to return VarOrLits. We can wrap vars and adapt to changes.
  read(): T;
  // Maybe have >>> cleanUp(): void
  readonly onChange: OnChange;
} & (P extends W ? { write(newVal: T): void } : {});

/** @About Represents a simple variable. */
type Var<P extends VarPerms, T extends NotVar> = {
  [Key in  // We get rid of string's props because TypeScript `#${string}` counts as a string object not a string literal
    | (keyof (T extends string | any[] // Convert lists into functions
        ? {}
        : T extends { [key: string]: any }
        ? T
        : {}) &
        (string | number))
    | `toString`
    | `value`
    | `onChange`
    | `_assertRW`
    | `_assertMiwiVar`]: Key extends `toString`
    ? () => string
    : Key extends `value`
    ? T
    : Key extends `onChange`
    ? OnChange
    : Key extends `_assertRW` | `_assertMiwiVar`
    ? true
    : Key extends keyof T
    ? T[Key] extends (...args: any) => any
      ? T[Key] //(...args: Parameters<T[Key]>) => VarOrLit<R, Lit<ReturnType<T[Key]>>>
      : T[Key] extends undefined
      ? undefined
      : Var<
          GetVarPerms<T[Key]>,
          T[Key] extends VarOrLit<R, infer T2> ? T2 : T[Key] & NotVar
        >
    : undefined;
};
const Var = callable({
  /** @About Creates a Var from an inital value. */
  call: <P extends VarPerms, T extends NotVar>(val: T) =>
    Var.fromFuncs<P, T>({
      read: () => val,
      onChange: OnChange(),
      write: function (newVal: T) {
        // Ideally, we don't want to trigger the onChange event unless something has actually changed.
        if (newVal !== val) {
          val = newVal;
          this.onChange.trigger();
        }
      },
    } as any),

  /** @About Creates a Var from read and write functions. */
  fromFuncs: <P extends VarPerms, T extends NotVar>(
    funcs: VarFromFuncsParams<P, T>,
  ): Var<P, T> => {
    const _gettersMap: { [key: string | symbol | number]: Var<RW, any> } = {};
    return new Proxy(
      {
        toString() {
          return String(funcs.read());
        },
      } as any,
      {
        get(obj, propKey, reciever): any {
          switch (propKey) {
            case `value`:
              return funcs.read();
            case `onChange`:
              return funcs.onChange;
            case `_assertMiwiVar`:
            case `_assertRW`:
              return undefined;
            case `toString`:
              return () => String(funcs.read());
            // This should only get triggered if this is an object Var.
            default:
              const propVal = (funcs.read() as any)[propKey];
              if (propVal === undefined || typeof propVal === `function`) {
                return propVal;
              } else {
                // We store getters in a map to prevent having to recreate them every time
                if (!Object.keys(_gettersMap).includes(propKey.toString())) {
                  const onChange = OnChange();
                  let oldPropOnChange: OnChange | undefined = undefined;
                  const updateGetter = () => {
                    if (exists(oldPropOnChange)) {
                      oldPropOnChange.removeListener(onChange.trigger);
                      oldPropOnChange = undefined;
                    }
                    const propVal = (funcs.read() as any)[propKey];
                    if (Var.isVar(propVal)) {
                      propVal.onChange.addListener(onChange.trigger);
                      oldPropOnChange = propVal.onChange;
                    }
                    onChange.trigger();
                  };
                  funcs.onChange.addListener(updateGetter);
                  updateGetter();
                  _gettersMap[propKey] = Var.fromFuncs({
                    read: () => Var.toLit((funcs.read() as any)[propKey]),
                    write: (newVal) => {
                      const inst: any = funcs.read();
                      if (Var.isVar(inst[propKey])) {
                        inst[propKey].value = newVal;
                      } else {
                        inst[propKey] = newVal;
                      }
                    },
                    onChange: onChange,
                  });
                }
                return _gettersMap[propKey];
              }
          }
        },

        set(obj, prop, newVal) {
          switch (prop) {
            case `value`:
              (funcs as any).write?.(newVal);
              break;
            default:
              throw `Props of Var<VarPerms, Obj> should not be set.`;
          }
          return true;
        },

        // https://stackoverflow.com/a/71560711
        // We can't infer this yet beacuse Prettier doesn't like "ReturnType<typeof Var<P, T>>".
      },
    ) as Var<P, T>;
  },

  /** @About Checks whether or not the given value is a variable of any sort. */
  // We can't check "exists(x?.value)" beacuse sometimes value exists, but returns undefined.
  isVar: <T extends NotVar>(x: NotVar | Var<R, T>): x is Var<R, T> =>
    exists((x as any)?.onChange),

  toLit: <T extends NotVar>(x: VarOrLit<R, T>): T =>
    (Var.isVar(x) ? x.value : x) as any,

  /** @About Creates a var for a specific, literal type.
   * @example
   * type Num<P extends VarPerms = R> = Type<P, typeof Num>;
   * const Num = Var.subtype({
   *   is: (x) => typeof x === `number`,
   *   construct: (v: number) => v,
   * });
   */
  newType: <T extends NotVar, S extends { readonly [key: string]: any }>(
    ntParams: {
      readonly is: (v: any) => boolean;
      readonly construct: (...x: any) => T;
    } & S,
  ) =>
    callable({
      /** @About Creates a Var from an inital value. */
      call: <P extends VarPerms = RW>(
        ...cParams: Parameters<typeof ntParams.construct>
      ) => Var<P, T>(ntParams.construct(...cParams)),

      /** @About Creates a Var from an inital value. */
      lit: (...cParams: Parameters<typeof ntParams.construct>) =>
        ntParams.construct(...cParams),

      /** @About Creates a Var from an inital value. */
      r: (...cParams: Parameters<typeof ntParams.construct>) =>
        Var<R, T>(ntParams.construct(...cParams)),

      /** @About Creates a Var from an inital value. */
      rw: (...cParams: Parameters<typeof ntParams.construct>) =>
        Var<RW, T>(ntParams.construct(...cParams)),

      /** @About Creates a Var from read and write functions. */
      fromFuncs: <P extends VarPerms>(funcs: VarFromFuncsParams<P, T>) =>
        Var.fromFuncs<P, T>(funcs),

      /** @About Checks whether or not the given value is a variable of this type and returns a
       * reactive boolean. */
      is: (x: any) => computed(() => ntParams.is(Var.toLit(x)), [x]),

      /** @About Checks whether or not the given value is a literal instance of this type and
       * returns a non-reactive boolean. */
      isLit: (x: any) => ntParams.is(Var.toLit(x)),

      ...(() => {
        const staticProps: any = {};
        for (const k in ntParams) {
          if (k !== `is` && k !== `construct`) {
            staticProps[k] = ntParams[k];
          }
        }
        return staticProps as Omit<typeof ntParams, `is` | `construct`>;
      })(),
    }),
});

type NotVar =
  | string
  | number
  | boolean
  | any[]
  | {
      _assertMiwiVar?: never | undefined;
      [key: string | symbol | number]: any;
    };

/** @About Accepts either a Var or its literal type. e.g. "Bool<R> | boolean" */
type VarOrLit<P extends VarPerms, T extends NotVar> = T | Var<P, T>;

/** @About Accepts either a Var or its literal type. e.g. "Bool<R> | boolean" */
type Lit<T> = NotVar & (T extends VarOrLit<R, infer T2> ? T2 : T);

/** @About A shorthand to create a common VarOrLit<> type.
 * @example
 * type Num<P extends VarPerms = R> = Type<P, typeof Num>;
 * const Num = Var.subtype({
 *   is: (x) => typeof x === `number`,
 *   construct: (v: number) => v,
 * });
 */
type Type<
  P extends VarPerms,
  S extends {
    (...args: any): { value: NotVar };
    is(x: any): VarOrLit<P, boolean>;
  },
> = ReturnType<S>[`value`] | Var<P, ReturnType<S>[`value`]>;

/** @About Retrieves the read/write permissions of any type. */
// We assume that literals should be treated as read-only, because they are used when a value doesn't change.
type GetVarPerms<V extends VarOrLit<R, any>> = V extends Var<RW, any> ? RW : R;

/** @About Checks whether or not the two given Vars are equal. */
const equ = (x: VarOrLit<R, any>, y: VarOrLit<R, any>) =>
  computed(() => Var.toLit(x) === Var.toLit(y), [x, y]);

/** @About Calls the left hand set function whenever the right hand value changes. */
const doOnChange = <T extends NotVar>(
  f: (newVal: T) => void,
  v: VarOrLit<R, T>,
) => {
  if (Var.isVar(v)) v.onChange.addListener(() => f(Var.toLit(v)));
  f(Var.toLit(v));
};

/** @About An easy short hand to create a computed, read-only Var. */
const computed = function <T extends NotVar>(
  compute: () => VarOrLit<R, T>,
  triggers: (VarOrLit<R, any> | OnChange)[],
): VarOrLit<R, T> {
  const normalizedTriggers: OnChange[] = triggers
    // Convert vars to events
    .map((x) => (Var.isVar(x) ? x.onChange : x))
    // Ignore literals
    .filter(OnChange.isThisType);
  // If there is nothing to react to, just return a literal
  if (normalizedTriggers.length === 0) {
    return compute();
  } else {
    // Caching the computed value has significat performance benefits
    let cachedVal: T;
    let haveCachedVal = false;
    const onChange = OnChange();
    let oldPropOnChange: OnChange | undefined = undefined;
    const trypUpdateCachedVal = () => {
      // Because "ifel" isn't actually conditional, this might fail on type unions.
      try {
        const newVal = compute();
        // Ideally, we only want to trigger the onChange event when the value has actually changed.
        if (!haveCachedVal || cachedVal !== newVal) {
          if (exists(oldPropOnChange)) {
            oldPropOnChange.removeListener(onChange.trigger);
            oldPropOnChange = undefined;
          }
          cachedVal = Var.toLit(newVal);
          haveCachedVal = true;
          if (Var.isVar(newVal)) {
            newVal.onChange.addListener(onChange.trigger);
            oldPropOnChange = newVal.onChange;
          }
          onChange.trigger();
        }
      } catch (e) {}
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

/** @About Represents a basic event that can be listened to. */
type VarEvent = ReturnType<typeof VarEvent>;
const VarEvent = function () {
  let _listeners: (() => void)[] = [];
  return {
    addListener: function (listener?: () => void) {
      if (exists(listener) && !_listeners.includes(listener!)) {
        _listeners.push(listener!);
      }
    },

    removeListener: (listenerToRemove?: () => void) =>
      _listeners.filter((listener) => listener !== listenerToRemove),

    trigger: () => _listeners.forEach((listener) => listener()),
  };
};

function isVar(x: any): x is Var<any, any> {
  return exists(x?.onChange);
}

type R = { r: true };
type W = { w: true };
type RW = R & W;
/** @About Represents a simple variable. */
type Var<P extends R | RW = RW, T = any> = ReturnType<
  _VarWrapper<P, T>["invoke"]
>;
type VarFromFuncsParams<P extends R | RW, T> = P extends W
  ? {
      readonly read: () => T;
      readonly onChange: VarEvent;
      readonly write: (newVal: T) => void;
    }
  : {
      readonly read: () => T;
      readonly onChange: VarEvent;
    };
const Var = (function () {
  const varFromFuncs = function <P extends R | RW, T>(
    funcs: VarFromFuncsParams<P, T>,
  ) {
    return {
      get value() {
        return funcs.read();
      },

      set value(newVal: T) {
        (funcs as any).write?.(newVal);
      },

      get onChange() {
        return funcs.onChange;
      },

      // Typescript doesn't yet suport write only
    } as P extends W
      ? {
          _assertRW: undefined;
          get value(): T;
          set value(newVal: T);
          get onChange(): VarEvent;
        }
      : {
          get value(): T;
          get onChange(): VarEvent;
        };
  };
  const varConstructor = function <P extends R | RW, T>(initVal: T) {
    let _val = initVal;
    const onChange = VarEvent();
    return varFromFuncs<P, T>({
      read: () => _val,
      write: (newVal: T) => {
        _val = newVal;
        onChange.trigger();
      },
      onChange: onChange,
    } as any);
  };
  const returnObj: any = varConstructor;
  returnObj.fromFuncs = varFromFuncs;
  const staticMembers = {
    isThisType: isVar,
    variant: <T = any>(isThisType: (v: any) => v is T) => {
      const returnObj = <P extends R | RW = RW>(initVal: T) =>
        varConstructor<P, T>(initVal);
      const variantFromFuncs = <P extends R | RW = RW>(
        funcs: VarFromFuncsParams<P, T>,
      ) => varFromFuncs<P, T>(funcs);
      returnObj.fromFuncs = variantFromFuncs;
      returnObj.isThisType = (x: any) =>
        computed(
          () => isVar(x) && isThisType(x.value),
          isVar(x) ? [x.onChange] : [],
        );
      returnObj.variant = staticMembers.variant;
      return returnObj as typeof returnObj &
        typeof staticMembers & { fromFuncs: typeof variantFromFuncs };
    },
  };
  for (const k in staticMembers) {
    returnObj[k] = (staticMembers as any)[k];
  }
  return returnObj as typeof varConstructor &
    typeof staticMembers & { fromFuncs: typeof varFromFuncs };
})();

// Because prettier doesn't like ReturnType<typeof Var<T>>
class _VarWrapper<P extends R | RW, T> {
  invoke(_: T) {
    return Var<P, T>(_);
  }
}

type VarOrLiteral<V extends Var<P, T>, P extends R | RW = RW, T = any> = V | T;

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

const and = function <
  X extends Var<R, boolean> | boolean,
  Y extends Var<R, boolean> | boolean,
>(
  x: X,
  y: Y,
): X extends Var<R, boolean>
  ? Var<R, boolean>
  : Y extends Var<R, boolean>
  ? Var<R, boolean>
  : boolean {
  if (isVar(x) && isVar(y)) {
    return computed(() => x.value && y.value, [x.onChange, y.onChange]) as any;
  } else if (isVar(x)) {
    return computed(() => x.value && y, [x.onChange]) as any;
  } else if (isVar(y)) {
    return computed(() => x && y.value, [y.onChange]) as any;
  } else {
    return (x && y) as any;
  }
};

const or = function <
  X extends Var<R, boolean> | boolean,
  Y extends Var<R, boolean> | boolean,
>(
  x: X,
  y: Y,
): X extends Var<R, boolean>
  ? Var<R, boolean>
  : Y extends Var<R, boolean>
  ? Var<R, boolean>
  : boolean {
  if (isVar(x) && isVar(y)) {
    return computed(() => x.value || y.value, [x.onChange, y.onChange]) as any;
  } else if (isVar(x)) {
    return computed(() => x.value || y, [x.onChange]) as any;
  } else if (isVar(y)) {
    return computed(() => x || y.value, [y.onChange]) as any;
  } else {
    return (x || y) as any;
  }
};

const ifel = function <C extends Var<R, boolean> | boolean, T, F>(
  condition: C,
  onTrue: T,
  onFalse: F,
): C extends Var<R, boolean>
  ? T extends Var<R, any>
    ? F extends Var<R, any>
      ? T | F
      : T | Var<R, F>
    : F extends Var<any>
    ? Var<R, T> | F
    : Var<R, T> | Var<R, F>
  : C extends true
  ? T
  : F {
  if (isVar(condition)) {
    if (isVar(onTrue) && isVar(onFalse)) {
      return computed(
        () => (condition.value ? onTrue.value : onFalse.value),
        [condition.onChange, onTrue.onChange, onFalse.onChange],
      ) as any;
    } else if (isVar(onTrue)) {
      return computed(
        () => (condition.value ? onTrue.value : onFalse),
        [condition.onChange, onTrue.onChange],
      ) as any;
    } else if (isVar(onFalse)) {
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

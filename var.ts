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

function _isVar(x: any): x is Var<any> {
  return exists(x?.value) && exists(x?.onChange);
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
    isThisType: _isVar,
    variant: <T = any>(isThisType: (v: any) => v is T) => {
      const returnObj = <P extends R | RW = RW>(initVal: T) =>
        varConstructor<P, T>(initVal);
      const variantFromFuncs = <P extends R | RW = RW>(
        funcs: VarFromFuncsParams<P, T>,
      ) => varFromFuncs<P, T>(funcs);
      returnObj.fromFuncs = variantFromFuncs;
      returnObj.isThisType = function <P extends R | RW = R>(
        x: any,
      ): x is Var<P, T> {
        return _isVar(x) && isThisType(x.value);
      };
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

const computed = function <T = any>(
  compute: () => T,
  triggers: VarEvent[],
): Var<R, T> {
  const onChange = VarEvent();
  for (const t of triggers) t.addListener(onChange.trigger);
  return Var.fromFuncs<R, T>({
    read: compute,
    onChange: onChange,
  });
};

/*const ifEl = function <C extends Var<R, boolean> | boolean, T, F>(
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
  if (Var.isThisType(condition)) {
    return onTrue;
  } else {
    return (condition ? onTrue : onFalse) as any;
  }
};*/

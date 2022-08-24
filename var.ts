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

/** @About Represents a simple variable. */
type Var<T> = ReturnType<_VarWrapper<T>["invoke"]>;
const Var = (function () {
  const varConstructor = function <T>(initVal: T) {
    let _val = initVal;
    const _onChange = VarEvent();
    return {
      get value() {
        return _val;
      },

      set value(newVal: T) {
        _val = newVal;
        _onChange.trigger();
      },

      get onChange() {
        return _onChange;
      },
    };
  };
  const returnObj: any = varConstructor;
  const staticMembers = {
    isThisType: _isVar,
    variant: <T>(isThisType: (v: any) => v is T) => {
      const returnObj: any = (initVal: T) => varConstructor<T>(initVal);
      returnObj.isThisType = function (x: any): x is T {
        return _isVar(x) && isThisType(x.value);
      };
      returnObj.variant = staticMembers.variant;
      return returnObj as typeof varConstructor<T> & typeof staticMembers;
    },
  };
  for (const k in staticMembers) {
    returnObj[k] = (staticMembers as any)[k];
  }
  return returnObj as typeof varConstructor & typeof staticMembers;
})();

// Because prettier doesn't like ReturnType<typeof Var<T>>
class _VarWrapper<T> {
  invoke(_: T) {
    return Var(_);
  }
}

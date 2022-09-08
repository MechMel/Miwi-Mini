type List<
  P extends R | RW = R,
  T extends VarOrLit<R, NotVar> = VarOrLit<R, NotVar>,
> = VarOrLit<P, T[]>;
const List = callable({
  call: <
    P extends R | RW = RW,
    T extends VarOrLit<R, NotVar> = VarOrLit<R, NotVar>,
  >(
    list: T[] = [],
  ) => Var<P, T[]>(list),

  fromFuncs: <
    P extends R | RW = RW,
    T extends VarOrLit<R, NotVar> = VarOrLit<R, NotVar>,
  >(
    params: VarFromFuncsParams<P, Lit<T[]>>,
  ) => Var.fromFuncs<P, T[]>(params),

  is: (x: any) => computed(() => Array.isArray(Var.toLit(x)), [x]),

  get: <T extends NotVar = NotVar>(
    list: List<R, VarOrLit<R, T>>,
    i: VarOrLit<R, number>,
  ) => computed(() => (list as any)[Var.toLit(i)], [list, i]),

  push: <T extends NotVar = NotVar>(
    list: List<RW, VarOrLit<R, T>>,
    x: VarOrLit<R, T>,
  ) => {
    Var.toLit(list).push(x);
    if (Var.isVar(list)) list.onChange.trigger();
  },

  pop: <T extends NotVar = NotVar>(list: List<RW, VarOrLit<R, T>>) => {
    Var.toLit(list).pop();
    if (Var.isVar(list)) list.onChange.trigger();
  },
  len: <T extends NotVar = NotVar>(list: List<R, VarOrLit<R, T>>) =>
    computed(() => Var.toLit(list).length, [list]),

  concat: <T extends NotVar = NotVar>(
    x: List<R, VarOrLit<R, T>>,
    y: List<R, VarOrLit<R, T>>,
  ): List<R, VarOrLit<R, T>> =>
    computed(() => {
      const list = [];
      for (const i in Var.toLit(x)) list.push((x as any)[i]);
      for (const i in Var.toLit(y)) list.push((y as any)[i]);
      return list;
    }, [x, y]),

  reduce: <K1 extends string | number, T1 extends NotVar, T2 extends NotVar>(
    obj: VarOrLit<R, { [Key in K1]: VarOrLit<R, T1> }>,
    initVal: VarOrLit<R, T2>,
    func: (p: VarOrLit<R, T2>, v: VarOrLit<R, T1>, k: K1) => VarOrLit<R, T2>,
  ): VarOrLit<R, T2> => {
    return computed(() => {
      const litObj = Var.toLit(obj);
      return computed(
        () => {
          let newVal = initVal;
          for (const k in litObj) {
            newVal = func(newVal, Var.toLit(litObj[k]), k);
          }
          return newVal;
        },
        Array.isArray(litObj) ? litObj : Object.values(litObj),
      );
    }, [obj]);
  },

  map: <K1 extends string | number, T1 extends NotVar, T2 extends NotVar>(
    list: VarOrLit<R, { [Key in K1]: VarOrLit<R, T1> }>,
    func: (v: VarOrLit<R, T1>, k: K1) => VarOrLit<R, T2>,
  ): List<R, VarOrLit<R, T2>> => {
    return computed(() => {
      const newList: VarOrLit<R, T2>[] = [];
      const litList = Var.toLit(list);
      for (const k in litList) {
        newList.push(
          func(
            computed(() => Var.toLit(litList[k]), [list, litList[k]]),
            k,
          ),
        );
      }
      return newList;
    }, [list]);
  },
  // for (list: List, do: () => any, undo: () => void);
});

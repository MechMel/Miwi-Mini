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
  is: (x: any) => computed(() => Array.isArray(Var.toLit(x)), [x]),

  get: <T extends NotVar = NotVar>(
    list: List<R, VarOrLit<R, T>>,
    i: VarOrLit<R, number>,
  ) => computed(() => (list as any)[Var.toLit(i)], [list, i]),

  len: <T extends NotVar = NotVar>(list: List<R, VarOrLit<R, T>>) =>
    computed(() => Var.toLit(list).length, [list]),

  concat: <T extends NotVar = NotVar>(
    x: List<R, VarOrLit<R, T>>,
    y: List<R, VarOrLit<R, T>>,
  ) =>
    computed(() => {
      const list = [];
      for (const i in Var.toLit(x)) list.push((x as any)[i]);
      for (const i in Var.toLit(y)) list.push((y as any)[i]);
      return list;
    }, [x, y]),

  /*map: <T extends NotVar = NotVar, RT extends NotVar = NotVar>(
    list: List<R, VarOrLit<R, T>>,
    func: (v: VarOrLit<R, T>, i: number) => VarOrLit<R, RT>,
  ): List<R, VarOrLit<R, RT>> => {
    return computed(
      () =>
        (Var.isVar(list) ? list.value : list).map((v, i) =>
          func(
            computed(() => Var.toLit(v), [list, v]),
            i,
          ),
        ),
      [list],
    );
  },*/
  // for (list: List, do: () => any, undo: () => void);
});

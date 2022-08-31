type List<
  P extends VarPerms = R,
  T extends VarOrLit<R, any> = VarOrLit<R, any>,
> = VarOrLit<P, Var<GetVarPerms<T>, Lit<T>>[]>;
const List = Var.newType({
  is: (x) => Array.isArray(x),
  construct: <T>(v: T[]) => v,
});

type Enum = string[];
const Enum = <T extends string[]>(...values: T) =>
  Var.newType({
    is: (x) => values.includes(x),
    construct: (v: T[number]) => v,
    // Embed the enum values in the static object.
    ...(values.reduce(
      (p, c) => ({
        ...p,
        [c]: c,
      }),
      {},
    ) as { [Key in T[number]]: Key }),
  });

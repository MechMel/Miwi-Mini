/** @About A reactive, numeric variable. */
type Num<P extends R | RW = RW> = Var<P, number>;
const Num = Var.subtype((x: any): x is number => typeof x === `number`);

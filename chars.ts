/** @About A reactive, characters variable. */
type Chars<P extends R | RW = RW> = Var<P, string>;
const Chars = Var.subtype((x: any): x is string => typeof x === `string`);

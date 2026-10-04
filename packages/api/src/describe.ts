import { describeAt, type Description } from "@sini/core";
import { plan } from "./project.js";

export function describe(target: string, time: number): Description {
  return describeAt(plan(target).plan, time);
}

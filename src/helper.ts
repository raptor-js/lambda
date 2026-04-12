import { type Kernel, LambdaAdapter, type LambdaEvent } from "./adapter.ts";

/**
 * Process a Lambda event (either V1 or V2).
 *
 * @param kernel The kernel instance.
 *
 * @returns A valid Lambda response object.
 */
export default function lambda(
  kernel: Kernel,
): (event: LambdaEvent) => Promise<unknown> {
  const adapter = new LambdaAdapter(kernel);

  return (event) => adapter.handle(event);
}

import { Buffer } from "node:buffer";

export type V1Event = {
  path: string;
  httpMethod: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
};

export type V2Event = {
  rawPath: string;
  requestContext: {
    domainName: string;
    http: { method: string };
  };
  body?: string | null;
  rawQueryString?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string> | null;
};

export type LambdaEvent = V1Event | V2Event;

/**
 * A minimal interface for integrating with Kernel.
 */
export interface Kernel {
  /**
   * Response with a valid HTTP response.
   *
   * @param request The request instnace.
   */
  respond(request: Request): Promise<Response>;
}

/**
 * The Lambda adapter for HTTP events.
 */
export class LambdaAdapter {
  /**
   * @constructor
   *
   * @param kernel The kernel instance to handle.
   */
  constructor(private readonly kernel: Kernel) {}

  /**
   * Handle a Lambda HTTP event
   *
   * @param event The lambda event, either V1 or V2.
   *
   * @returns A valid Lambda response object.
   */
  public async handle(event: LambdaEvent): Promise<unknown> {
    const request = this.buildRequest(event);

    const response = await this.kernel.respond(request);

    return this.buildResponse(response);
  }

  /**
   * Build a new request instance for the Lambda event.
   *
   * @param event The Lambda event.
   *
   * @returns A request instance for the event.
   */
  private buildRequest(event: LambdaEvent): Request {
    const method = this.getHttpMethod(event);
    const url = this.buildUrl(event);
    const body = this.buildBody(event, method);

    return new Request(url, {
      method,
      headers: new Headers((event.headers ?? {}) as HeadersInit),
      body,
    });
  }

  /**
   * Get the HTTP method from the Lambda event.
   *
   * @param event The Lambda event.
   *
   * @returns The HTTP method from event.
   */
  private getHttpMethod(event: LambdaEvent): string {
    if (this.isV2Event(event)) {
      return event.requestContext?.http?.method ?? "GET";
    }

    return event.httpMethod ?? "GET";
  }

  /**
   * Build a URL from the Lambda event.
   *
   * @param event The Lambda event.
   *
   * @returns The URL built from the event.
   */
  private buildUrl(event: LambdaEvent): string {
    if (this.isV2Event(event)) {
      const host = event.requestContext?.domainName ??
        event.headers?.host ??
        "localhost";

      const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";

      return `https://${host}${event.rawPath ?? "/"}${qs}`;
    }

    const host = event.headers?.host ?? "localhost";
    const params = event.queryStringParameters;
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";

    return `https://${host}${event.path ?? "/"}${qs}`;
  }

  /**
   * Build the HTTP body.
   *
   * @param event The Lambda event.
   * @param method The HTTP method from the event.
   *
   * @returns A BodyInit object from the request.
   */
  private buildBody(event: LambdaEvent, method: string): BodyInit | undefined {
    if (["GET", "HEAD"].includes(method) || !event.body) {
      return undefined;
    }

    if (event.isBase64Encoded) {
      return Uint8Array.from(Buffer.from(event.body, "base64")) as BodyInit;
    }

    return event.body;
  }

  /**
   * Build a valid Lambda response.
   *
   * @param response The HTTP response.
   *
   * @returns A valid Lambda response object.
   */
  private async buildResponse(response: Response) {
    const headers: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = response.headers.get("content-type") ?? "";

    const isBinary = !/^(text\/|application\/(json|xml|x-www-form-urlencoded))/
      .test(contentType);

    const buffer = await response.arrayBuffer();

    return {
      statusCode: response.status,
      headers,
      body: isBinary
        ? btoa(String.fromCharCode(...new Uint8Array(buffer)))
        : new TextDecoder().decode(buffer),
      isBase64Encoded: isBinary,
    };
  }

  /**
   * Check if the event is V1 or V2.
   *
   * @param event The Lambda event.
   *
   * @returns A boolean indicating whether it's a V1 or V2 event.
   */
  private isV2Event(event: LambdaEvent): event is V2Event {
    return "rawPath" in event;
  }
}

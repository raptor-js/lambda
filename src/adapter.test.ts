/// <reference lib="deno.ns" />
// deno-lint-ignore-file

import { assertEquals } from "@std/assert";
import { Kernel } from "@raptor/kernel";
import type { Context } from "@raptor/types";

import { LambdaAdapter } from "./adapter.ts";
import lambda from "./helper.ts";

type LambdaResponse = {
  statusCode: number;
  headers: Record<string, string>;
  cookies: string[];
  body: string;
  isBase64Encoded: boolean;
};

Deno.test("test adapter returns lambda response shape for V1 event", async () => {
  const app = new Kernel();

  app.add(() => "OK");

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(typeof result.statusCode, "number");
  assertEquals(typeof result.body, "string");
  assertEquals(typeof result.headers, "object");
  assertEquals(typeof result.isBase64Encoded, "boolean");
});

Deno.test("test adapter returns lambda response shape for V2 event", async () => {
  const app = new Kernel();

  app.add(() => "OK");

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: "example.com",
      http: { method: "GET" },
    },
  }) as LambdaResponse;

  assertEquals(typeof result.statusCode, "number");
  assertEquals(typeof result.body, "string");
  assertEquals(typeof result.headers, "object");
  assertEquals(typeof result.isBase64Encoded, "boolean");
});

// HTTP Method Extraction.

Deno.test("test adapter extracts http method from V1 event", async () => {
  const app = new Kernel();

  let capturedMethod = "";

  app.add((ctx: Context) => {
    capturedMethod = ctx.request.method;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({ path: "/", httpMethod: "POST" });

  assertEquals(capturedMethod, "POST");
});

Deno.test("test adapter extracts http method from V2 event", async () => {
  const app = new Kernel();

  let capturedMethod = "";

  app.add((ctx: Context) => {
    capturedMethod = ctx.request.method;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: "example.com",
      http: { method: "DELETE" },
    },
  });

  assertEquals(capturedMethod, "DELETE");
});

Deno.test("test adapter defaults http method to GET for V1 event", async () => {
  const app = new Kernel();

  let capturedMethod = "";

  app.add((ctx: Context) => {
    capturedMethod = ctx.request.method;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({ path: "/", httpMethod: null as unknown as string });

  assertEquals(capturedMethod, "GET");
});

Deno.test("test adapter builds url from V1 event path", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/users/123",
    httpMethod: "GET",
    headers: { host: "api.example.com" },
  });

  assertEquals(capturedUrl, "https://api.example.com/users/123");
});

Deno.test("test adapter builds url from V2 event rawPath", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/items/456",
    requestContext: {
      domainName: "api.example.com",
      http: { method: "GET" },
    },
  });

  assertEquals(capturedUrl, "https://api.example.com/items/456");
});

Deno.test("test adapter uses domainName over host header for V2 event url", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: "domain.example.com",
      http: { method: "GET" },
    },
    headers: { host: "header.example.com" },
  });

  assertEquals(capturedUrl.startsWith("https://domain.example.com"), true);
});

Deno.test("test adapter falls back to host header when no domainName in V2 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: null as unknown as string,
      http: { method: "GET" },
    },
    headers: { host: "fallback.example.com" },
  });

  assertEquals(capturedUrl.startsWith("https://fallback.example.com"), true);
});

Deno.test("test adapter falls back to localhost when no host in V1 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({ path: "/", httpMethod: "GET" });

  assertEquals(capturedUrl.startsWith("https://localhost"), true);
});

Deno.test("test adapter falls back to localhost when no host or domainName in V2 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: null as unknown as string,
      http: { method: "GET" },
    },
  });

  assertEquals(capturedUrl.startsWith("https://localhost"), true);
});

Deno.test("test adapter appends query string parameters for V1 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/search",
    httpMethod: "GET",
    queryStringParameters: { q: "raptor", page: "2" },
  });

  const url = new URL(capturedUrl);

  assertEquals(url.searchParams.get("q"), "raptor");
  assertEquals(url.searchParams.get("page"), "2");
});

Deno.test("test adapter appends raw query string for V2 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/search",
    requestContext: {
      domainName: "example.com",
      http: { method: "GET" },
    },
    rawQueryString: "q=raptor&page=2",
  });

  assertEquals(capturedUrl.includes("?q=raptor&page=2"), true);
});

Deno.test("test adapter omits query string when no parameters in V1 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({ path: "/", httpMethod: "GET" });

  assertEquals(capturedUrl.includes("?"), false);
});

Deno.test("test adapter omits query string when no rawQueryString in V2 event", async () => {
  const app = new Kernel();

  let capturedUrl = "";

  app.add((ctx: Context) => {
    capturedUrl = ctx.request.url;

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: "example.com",
      http: { method: "GET" },
    },
  });

  assertEquals(capturedUrl.includes("?"), false);
});

Deno.test("test adapter does not attach body for GET requests", async () => {
  const app = new Kernel();

  let capturedBody: string | null = null;

  app.add(async (ctx: Context) => {
    capturedBody = await ctx.request.text();

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/",
    httpMethod: "GET",
    body: '{"should":"be ignored"}',
  });

  assertEquals(capturedBody, "");
});

Deno.test("test adapter does not attach body for HEAD requests", async () => {
  const app = new Kernel();

  let capturedBody: string | null = null;

  app.add(async (ctx: Context) => {
    capturedBody = await ctx.request.text();

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/",
    httpMethod: "HEAD",
    body: "ignored",
  });

  assertEquals(capturedBody, "");
});

Deno.test("test adapter forwards text body for POST requests", async () => {
  const app = new Kernel();

  let capturedBody = "";

  app.add(async (ctx: Context) => {
    capturedBody = await ctx.request.text();

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/",
    httpMethod: "POST",
    body: '{"name":"raptor"}',
  });

  assertEquals(capturedBody, '{"name":"raptor"}');
});

Deno.test("test adapter decodes base64-encoded body", async () => {
  const app = new Kernel();

  let capturedBody = "";

  app.add(async (ctx: Context) => {
    capturedBody = await ctx.request.text();

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/",
    httpMethod: "POST",
    body: btoa("hello world"),
    isBase64Encoded: true,
  });

  assertEquals(capturedBody, "hello world");
});

Deno.test("test adapter returns undefined body when event body is null", async () => {
  const app = new Kernel();

  let capturedBody = "";

  app.add(async (ctx: Context) => {
    capturedBody = await ctx.request.text();

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/",
    httpMethod: "POST",
    body: null,
  });

  assertEquals(capturedBody, "");
});

Deno.test("test adapter forwards request headers from V1 event", async () => {
  const app = new Kernel();

  let capturedHeader = "";

  app.add((ctx: Context) => {
    capturedHeader = ctx.request.headers.get("x-custom-header") ?? "";

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    path: "/",
    httpMethod: "GET",
    headers: { "x-custom-header": "my-value" },
  });

  assertEquals(capturedHeader, "my-value");
});

Deno.test("test adapter forwards request headers from V2 event", async () => {
  const app = new Kernel();

  let capturedHeader = "";

  app.add((ctx: Context) => {
    capturedHeader = ctx.request.headers.get("authorization") ?? "";

    return "OK";
  });

  const adapter = new LambdaAdapter(app);

  await adapter.handle({
    rawPath: "/",
    requestContext: {
      domainName: "example.com",
      http: { method: "GET" },
    },
    headers: { authorization: "Bearer token123" },
  });

  assertEquals(capturedHeader, "Bearer token123");
});

Deno.test("test adapter handles null headers without throwing", async () => {
  const app = new Kernel();

  app.add(() => "OK");

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
    headers: null,
  }) as LambdaResponse;

  assertEquals(result.statusCode, 200);
});

Deno.test("test adapter response statusCode matches kernel response", async () => {
  const app = new Kernel();

  app.add(() => new Response("Created", { status: 201 }));

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "POST",
  }) as LambdaResponse;

  assertEquals(result.statusCode, 201);
});

Deno.test("test adapter response includes headers from kernel response", async () => {
  const app = new Kernel();

  app.add(() => new Response("OK", { headers: { "x-request-id": "abc-123" } }));

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.headers["x-request-id"], "abc-123");
});

Deno.test("test adapter response preserves multiple set-cookie headers as cookies array", async () => {
  const app = new Kernel();

  app.add(() => {
    const headers = new Headers();
    headers.append("set-cookie", "access-token=abc; HttpOnly; Path=/");
    headers.append("set-cookie", "refresh-token=xyz; HttpOnly; Path=/");

    return new Response("OK", { headers });
  });

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.cookies.length, 2);
  assertEquals(result.cookies[0].startsWith("access-token="), true);
  assertEquals(result.cookies[1].startsWith("refresh-token="), true);
  assertEquals("set-cookie" in result.headers, false);
});

Deno.test("test adapter response body is plain text for text content type", async () => {
  const app = new Kernel();

  app.add(() =>
    new Response("Hello, world!", {
      headers: { "content-type": "text/plain" },
    })
  );

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.body, "Hello, world!");
  assertEquals(result.isBase64Encoded, false);
});

Deno.test("test adapter response body is plain text for application/json content type", async () => {
  const app = new Kernel();

  app.add(() =>
    new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    })
  );

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.body, '{"ok":true}');
  assertEquals(result.isBase64Encoded, false);
});

Deno.test("test adapter response body is base64 encoded for binary content type", async () => {
  const app = new Kernel();

  app.add(() =>
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/png" },
    })
  );

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.isBase64Encoded, true);
  assertEquals(typeof result.body, "string");
});

Deno.test("test adapter response body is plain text for application/xml content type", async () => {
  const app = new Kernel();

  app.add(() =>
    new Response("<root/>", {
      headers: { "content-type": "application/xml" },
    })
  );

  const adapter = new LambdaAdapter(app);

  const result = await adapter.handle({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.isBase64Encoded, false);
});

Deno.test("test lambda helper returns a callable function", () => {
  const app = new Kernel();

  const handler = lambda(app);

  assertEquals(typeof handler, "function");
});

Deno.test("test lambda helper processes V1 events", async () => {
  const app = new Kernel();

  app.add(() => "OK");

  const handler = lambda(app);

  const result = await handler({
    path: "/",
    httpMethod: "GET",
  }) as LambdaResponse;

  assertEquals(result.statusCode, 200);
  assertEquals(result.body, "OK");
});

Deno.test("test lambda helper processes V2 events", async () => {
  const app = new Kernel();

  app.add(() => "OK");

  const handler = lambda(app);

  const result = await handler({
    rawPath: "/",
    requestContext: {
      domainName: "example.com",
      http: { method: "GET" },
    },
  }) as LambdaResponse;

  assertEquals(result.statusCode, 200);
  assertEquals(result.body, "OK");
});

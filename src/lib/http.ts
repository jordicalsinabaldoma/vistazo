import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: "Datos no válidos", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  };
}

export const bad = (m: string) => new HttpError(400, m);
export const unauthorized = (m = "Inicia sesión") => new HttpError(401, m);
export const forbidden = (m = "Sin acceso") => new HttpError(403, m);
export const notFound = (m = "No existe") => new HttpError(404, m);

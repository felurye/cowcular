"use client";

import type { AppRouter } from "@cowcular/trpc";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();

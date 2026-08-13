"use client";

import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./permissions";

export const authClient = createAuthClient({
  plugins: [organizationClient(), adminClient({ ac, roles })],
});

export const { signIn, signOut, useSession } = authClient;

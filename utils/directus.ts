import { createDirectus, rest, authentication, staticToken } from "@directus/sdk";

export const getDirectusClient = (token?: string) => {
  const client = createDirectus("http://localhost:8055")
    .with(authentication("json"))
    .with(rest());

  if (token) {
    client.setToken(token);
  }

  return client;
};

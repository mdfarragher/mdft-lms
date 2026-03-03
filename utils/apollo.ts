import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, concat } from "@apollo/client";

export const createClient = (token?: string) => {
  const httpLink = new HttpLink({ uri: "http://localhost:8055/graphql" });

  const authMiddleware = new ApolloLink((operation, forward) => {
    if (token) {
      operation.setContext({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    }
    return forward(operation);
  });

  return new ApolloClient({
    link: concat(authMiddleware, httpLink),
    cache: new InMemoryCache(),
  });
};

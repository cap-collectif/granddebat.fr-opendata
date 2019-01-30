const GraphQLClient = require("graphql-request").GraphQLClient;

const API_URL = "https://granddebat.fr/graphql";

module.exports = token =>
  new GraphQLClient(API_URL, {
    headers: {
      "content-type": "application/json",
      authorization: token ? `Bearer ${token}` : undefined,
      // This enable schema previews see: https://granddebat.fr/developer/previews/
      accept: "application/vnd.cap-collectif.preview+json"
    }
  });

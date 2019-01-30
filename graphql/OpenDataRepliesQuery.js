const AuthorFragment = require("./AuthorFragment");

module.exports = /* GraphQL */ `
  query OpenDataRepliesQuery($id: ID!, $count: Int!, $cursor: String) {
    node(id: $id) {
      ... on Questionnaire {
        replies(first: $count, after: $cursor) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              createdAt
              publishedAt
              updatedAt
              author {
                ...AuthorFragment
              }
              responses {
                question {
                  id
                  title
                  __typename
                }
                ... on ValueResponse {
                  value
                }
                ... on MediaResponse {
                  medias {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ${AuthorFragment}
`;

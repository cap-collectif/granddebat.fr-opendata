const AuthorFragment = require("./AuthorFragment");

module.exports = /* GraphQL */ `
  query OpenDataProposalsQuery(
    $id: ID!
    $count: Int!
    $cursor: String
    $trashedStatus: ProposalTrashedStatus
    $orderBy: ProposalOrder!
  ) {
    node(id: $id) {
      id
      ... on CollectStep {
        proposals(
          trashedStatus: $trashedStatus
          orderBy: $orderBy
          first: $count
          after: $cursor
        ) {
          totalCount
          edges {
            node {
              id
              reference
              title
              createdAt
              publishedAt
              updatedAt
              trashed
              trashedStatus
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
                  formattedValue
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
  ${AuthorFragment}
`;

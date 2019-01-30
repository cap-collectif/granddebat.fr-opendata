const AuthorFragment = require("./AuthorFragment");

module.exports = /* GraphQL */ `
  query OpenDataEventsQuery($count: Int!, $cursor: String) {
    events(first: $count, after: $cursor) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          createdAt
          updatedAt
          startAt
          endAt
          enabled
          fullAddress
          lat
          lng
          zipCode
          body
          url
          link
          author {
            ...AuthorFragment
          }
        }
      }
    }
  }
  ${AuthorFragment}
`;

module.exports = /* GraphQL */ `
  query OpenDataUsersQuery($count: Int!, $cursor: String) {
    users(first: $count, after: $cursor) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          username
          email
          consentInternalCommunication
          avatarUrl
          linkedInUrl
          twitterUrl
          websiteUrl
          facebookUrl
          createdAt
          updatedAt
          deletedAccountAt
          enabled
          biography
          url
          userType {
            name
          }
          responses {
            edges {
              node {
                ... on ValueResponse {
                  value
                  formattedValue
                }
              }
            }
          }
        }
      }
    }
  }
`;

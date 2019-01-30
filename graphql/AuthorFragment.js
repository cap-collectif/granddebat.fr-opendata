module.exports = /* GraphQL */ `
  fragment AuthorFragment on User {
    id
    username
    email
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
`;

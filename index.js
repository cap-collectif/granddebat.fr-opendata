require("babel-polyfill");
const fs = require("fs");
const moment = require("moment");
const program = require("commander");
const OpenDataProposalsQuery = require("./graphql/OpenDataProposalsQuery");
const OpenDataRepliesQuery = require("./graphql/OpenDataRepliesQuery");
const OpenDataEventsQuery = require("./graphql/OpenDataEventsQuery");
const OpenDataUsersQuery = require("./graphql/OpenDataUsersQuery");
const createStreams = require("./utils/createStreams");
const isJson = require("./utils/isJson");
const cleanNewLine = require("./utils/cleanNewLine");
const generateProgressBar = require("./utils/generateProgressBar");

program.option("-t, --token [string]", "Public API token").parse(process.argv);

const client = require("./utils/createGraphQLClient")(program.token);

// Toggle a not anonymized export.
// Setting to `false` requires to use an admin API token.
// The archive must therefore benefit from a specific status, justified by the purpose of the preservation of the archives (to bring evidence, to document the history) which implies the preservation of non-anonymized archives.
const ANONYMIZE = !program.token;

// This is used to separate multiple choice responses.
const SEPARATOR = "|";

// This is the directory of generated files.
const GENERATED_DIR = `./__generated__/${moment().format(
  "YYYY-MM-DD HH-mm-ss"
)}`;

// If an API request failed, time to wait before retrying.
const API_RETRY_TIMEOUT = 1000;

// The ids of open questions files.
const PROPOSALS_TO_EXPORT = {
  LA_TRANSITION_ECOLOGIQUE:
    "Q29sbGVjdFN0ZXA6OTgxZmM3MDUtMWNlMC0xMWU5LTk0ZDItZmExNjNlZWIxMWUx",
  LA_FISCALITE_ET_LES_DEPENSES_PUBLIQUES:
    "Q29sbGVjdFN0ZXA6ZjhlYWUxYmMtMWNlMC0xMWU5LTk0ZDItZmExNjNlZWIxMWUx",
  DEMOCRATIE_ET_CITOYENNETE:
    "Q29sbGVjdFN0ZXA6OTNhODAyZmQtMWNkZC0xMWU5LTk0ZDItZmExNjNlZWIxMWUx",
  ORGANISATION_DE_LETAT_ET_DES_SERVICES_PUBLICS:
    "Q29sbGVjdFN0ZXA6MjNmY2UwNjMtMWNlMS0xMWU5LTk0ZDItZmExNjNlZWIxMWUx"
};

// The ids of closed questions files.
const QUESTIONNAIRES_TO_EXPORT = {
  QUESTIONNAIRE_RESTITUER_UNE_RIL:
    "UXVlc3Rpb25uYWlyZToxNGNhMTIyNi0xZTEzLTExZTktOTRkMi1mYTE2M2VlYjExZTE=",
  QUESTIONNAIRE_ORGANISER_UNE_RIL:
    "UXVlc3Rpb25uYWlyZTo4ZDk1ZjQ1My0xMmEyLTExZTktODljYy0wMjQyYWMxMTAwMDQ=",
  QUESTIONNAIRE_LA_TRANSITION_ECOLOGIQUE:
    "UXVlc3Rpb25uYWlyZTo5ZTVkY2Q0ZC0xYzlmLTExZTktOTRkMi1mYTE2M2VlYjExZTE=",
  QUESTIONNAIRE_LA_FISCALITE_ET_LES_DEPENSES_PUBLIQUES:
    "UXVlc3Rpb25uYWlyZTo5NTFhMTZkZS0xY2EyLTExZTktOTRkMi1mYTE2M2VlYjExZTE=",
  QUESTIONNAIRE_DEMOCRATIE_ET_CITOYENNETE:
    "UXVlc3Rpb25uYWlyZTo5NTNjYjdjYS0xY2E0LTExZTktOTRkMi1mYTE2M2VlYjExZTE=",
  QUESTIONNAIRE_ORGANISATION_DE_LETAT_ET_DES_SERVICES_PUBLICS:
    "UXVlc3Rpb25uYWlyZTowN2I3ZTNiOC0xY2E3LTExZTktOTRkMi1mYTE2M2VlYjExZTE="
};

// We start the pagination from the beginning.
const INITIAL_CURSOR = null;

const removeAnonymiseAuthorColumns = row => {
  if (ANONYMIZE) {
    // We do not show the username on open data files.
    delete row.authorUsername;
    // These columns will be empty so we delete them.
    delete row.authorEmail;
  }
  return row;
};
const formatAuthor = author => ({
  authorId: author.id,
  authorUsername: author.username,
  authorEmail: author.email,
  authorType: author.userType ? author.userType.name : null,
  authorZipCode: author.responses.edges.length
    ? author.responses.edges[0].node.value
    : null
});

const formatResponses = responses => {
  return (
    responses
      // We remove sections.
      .filter(response => response.question.__typename !== "SectionQuestion")
      .map(response => ({
        questionId: response.question.id,
        questionTitle: cleanNewLine(response.question.title),
        value:
          response.question.__typename !== "MediaQuestion"
            ? cleanNewLine(response.value)
            : response.medias.map(media => media.url).join(` ${SEPARATOR} `),
        formattedValue: cleanNewLine(response.formattedValue)
      }))
  );
};

const formatResponse = (row, response) => {
  let value = null;
  if (!response.value || !isJson(response.value)) {
    // This is a plain value.
    value = response.value;
  } else {
    // This is a JSON value.
    const json = JSON.parse(response.value);
    if (json.labels) {
      value = json.labels.reduce((v, r) => {
        return v.length ? v + SEPARATOR + r : r;
      }, "");
    }
    if (json.other) {
      if (value && value.length) {
        value = value + SEPARATOR + json.other;
      } else {
        value = json.other;
      }
    }
  }
  row[`Q${response.questionId} - ${response.questionTitle}`] = value;
  return row;
};

const clearCsvRawResponses = row => {
  const cleaned = {
    ...row,
    ...row.responses.reduce(formatResponse, {})
  };
  delete cleaned.responses;
  return cleaned;
};

const exploreReplies = async (
  key,
  jsonStream,
  csvStream,
  cursor,
  progress = null
) => {
  try {
    const data = await client.request(OpenDataRepliesQuery, {
      id: QUESTIONNAIRES_TO_EXPORT[key],
      cursor,
      count: 100
    });
    if (!progress) {
      progress = generateProgressBar(
        key,
        data.node.replies.totalCount,
        program.offset
      );
    }
    const json = [];
    for (const edge of data.node.replies.edges) {
      const node = edge.node;
      progress.tick();
      const newLine = removeAnonymiseAuthorColumns({
        id: node.id,
        createdAt: node.createdAt,
        publishedAt: node.publishedAt,
        updatedAt: node.updatedAt,
        ...formatAuthor(node.author),
        responses: formatResponses(node.responses)
      });
      json.push(newLine);
      csvStream.push(clearCsvRawResponses(newLine));
    }
    json.forEach(jsonStream.write);

    const pageInfo = data.node.replies.pageInfo;
    if (pageInfo.hasNextPage) {
      await exploreReplies(
        key,
        jsonStream,
        csvStream,
        pageInfo.endCursor,
        progress
      );
    }
  } catch (e) {
    setTimeout(async () => {
      await exploreReplies(key, jsonStream, csvStream, cursor, progress);
    }, API_RETRY_TIMEOUT);
  }
};

const exploreUsers = async (
  jsonStream,
  csvStream,
  cursor = null,
  progress = null
) => {
  try {
    const data = await client.request(OpenDataUsersQuery, {
      count: 100,
      cursor
    });
    if (!progress) {
      progress = generateProgressBar("USERS", data.users.totalCount);
    }
    const json = [];
    for (const edge of data.users.edges) {
      const node = edge.node;
      progress.tick();

      const newLine = {
        id: node.id,
        email: node.email,
        username: cleanNewLine(node.username),
        type: node.userType ? node.userType.name : null,
        zipCode: node.responses.edges.length
          ? node.responses.edges[0].node.value
          : null,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        deletedAccountAt: node.deletedAccountAt,
        enabled: node.enabled,
        biography: cleanNewLine(node.biography),
        consentInternalCommunication: node.consentInternalCommunication,
        url: node.url,
        avatarUrl: node.avatarUrl,
        websiteUrl: node.websiteUrl,
        linkedInUrl: node.linkedInUrl,
        twitterUrl: node.twitterUrl,
        facebookUrl: node.facebookUrl
      };
      if (ANONYMIZE) {
        // These columns will be empty so we delete them.
        delete newLine.email;
        delete newLine.consentInternalCommunication;
      }
      csvStream.push(newLine);
      json.push(newLine);
    }

    json.forEach(jsonStream.write);

    const pageInfo = data.users.pageInfo;
    if (pageInfo.hasNextPage) {
      await exploreUsers(jsonStream, csvStream, pageInfo.endCursor, progress);
    }
  } catch (e) {
    setTimeout(async () => {
      await exploreUsers(jsonStream, csvStream, cursor, progress);
    }, API_RETRY_TIMEOUT);
  }
};

const exploreEvents = async (
  jsonStream,
  csvStream,
  cursor = null,
  progress = null
) => {
  try {
    const data = await client.request(OpenDataEventsQuery, {
      count: 100,
      cursor
    });
    if (!progress) {
      progress = generateProgressBar("EVENTS", data.events.totalCount);
    }
    const json = [];
    for (const edge of data.events.edges) {
      const node = edge.node;
      progress.tick();
      const newLine = removeAnonymiseAuthorColumns({
        id: node.id,
        title: cleanNewLine(node.title),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        startAt: node.startAt,
        endAt: node.endAt,
        enabled: node.enabled,
        lat: node.lat,
        lng: node.lng,
        fullAddress: node.fullAddress,
        link: node.link,
        url: node.url,
        body: cleanNewLine(node.body),
        ...formatAuthor(node.author)
      });
      csvStream.push(newLine);
      json.push(newLine);
    }
    json.forEach(jsonStream.write);

    const pageInfo = data.events.pageInfo;
    if (pageInfo.hasNextPage) {
      await exploreEvents(jsonStream, csvStream, pageInfo.endCursor, progress);
    }
  } catch (e) {
    setTimeout(async () => {
      await exploreEvents(jsonStream, csvStream, cursor, progress);
    }, API_RETRY_TIMEOUT);
  }
};

const exploreProposals = async (
  key,
  jsonStream,
  csvStream,
  cursor,
  progress
) => {
  try {
    const data = await client.request(OpenDataProposalsQuery, {
      id: PROPOSALS_TO_EXPORT[key],
      cursor,
      count: 100,
      orderBy: { field: "PUBLISHED_AT", direction: "ASC" }
    });
    if (!progress) {
      progress = generateProgressBar(
        key,
        data.node.proposals.totalCount,
        program.offset
      );
    }
    const json = [];
    for (const edge of data.node.proposals.edges) {
      const node = edge.node;
      progress.tick();
      const newLine = removeAnonymiseAuthorColumns({
        id: node.id,
        reference: node.reference,
        title: cleanNewLine(node.title),
        createdAt: node.createdAt,
        publishedAt: node.publishedAt,
        updatedAt: node.updatedAt,
        trashed: node.trashed,
        trashedStatus: node.trashedStatus,
        ...formatAuthor(node.author),
        responses: formatResponses(node.responses)
      });
      json.push(newLine);
      csvStream.push(clearCsvRawResponses(newLine));
    }
    json.forEach(jsonStream.write);

    const pageInfo = data.node.proposals.pageInfo;
    const endCursor = pageInfo.endCursor;
    if (pageInfo.hasNextPage) {
      await exploreProposals(key, jsonStream, csvStream, endCursor, progress);
    }
  } catch (e) {
    setTimeout(async () => {
      await exploreProposals(key, jsonStream, csvStream, cursor, progress);
    }, API_RETRY_TIMEOUT);
  }
};

(async function() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
  const openData = {};

  const { csvSteam, jsonStream } = createStreams(`${GENERATED_DIR}/EVENTS`);
  openData["EVENTS"] = exploreEvents(jsonStream, csvSteam);

  const userStreams = createStreams(`${GENERATED_DIR}/USERS`);
  openData["USERS"] = exploreUsers(
    userStreams.jsonStream,
    userStreams.csvSteam
  );

  for (const key in PROPOSALS_TO_EXPORT) {
    const { csvSteam, jsonStream } = createStreams(`${GENERATED_DIR}/${key}`);
    openData[key] = exploreProposals(key, jsonStream, csvSteam, INITIAL_CURSOR);
  }

  for (const key in QUESTIONNAIRES_TO_EXPORT) {
    const { csvSteam, jsonStream } = createStreams(`${GENERATED_DIR}/${key}`);
    openData[key] = exploreReplies(key, jsonStream, csvSteam, INITIAL_CURSOR);
  }

  // Let's wait all streams to finish…
  [
    await openData["USERS"],
    // RIL
    await openData["QUESTIONNAIRE_RESTITUER_UNE_RIL"],
    await openData["QUESTIONNAIRE_ORGANISER_UNE_RIL"],
    // RILs available on https://granddebat.fr/events
    await openData["EVENTS"],
    // open questions files
    await openData["LA_TRANSITION_ECOLOGIQUE"],
    await openData["LA_FISCALITE_ET_LES_DEPENSES_PUBLIQUES"],
    await openData["DEMOCRATIE_ET_CITOYENNETE"],
    await openData["ORGANISATION_DE_LETAT_ET_DES_SERVICES_PUBLICS"],
    // closed questions files
    await openData["QUESTIONNAIRE_LA_TRANSITION_ECOLOGIQUE"],
    await openData["QUESTIONNAIRE_LA_FISCALITE_ET_LES_DEPENSES_PUBLIQUES"],
    await openData["QUESTIONNAIRE_DEMOCRATIE_ET_CITOYENNETE"],
    await openData[
      "QUESTIONNAIRE_ORGANISATION_DE_LETAT_ET_DES_SERVICES_PUBLICS"
    ]
  ];
})().catch(error => console.error(error));

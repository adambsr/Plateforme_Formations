/* global db, quit, rs, sleep, tojson */

const replicaSetName = 'rs0';
const memberHost = 'mongodb:27017';
const configuration = {
  _id: replicaSetName,
  members: [{ _id: 0, host: memberHost }],
};

try {
  const existingConfiguration = rs.conf();
  const existingMember = existingConfiguration.members?.[0];

  if (
    existingConfiguration._id !== replicaSetName ||
    existingConfiguration.members?.length !== 1 ||
    existingMember?.host !== memberHost
  ) {
    throw new Error(
      'The existing MongoDB replica-set configuration is unexpected.',
    );
  }
} catch (error) {
  if (error.code !== 94 && error.codeName !== 'NotYetInitialized') {
    throw error;
  }

  const result = rs.initiate(configuration);

  if (result.ok !== 1) {
    throw new Error(
      `MongoDB replica-set initialization failed: ${tojson(result)}`,
    );
  }
}

const maximumAttempts = 60;

for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
  if (db.hello().isWritablePrimary) {
    print(`Replica set ${replicaSetName} is ready.`);
    quit(0);
  }

  sleep(500);
}

throw new Error(
  `Replica set ${replicaSetName} did not elect a primary in time.`,
);

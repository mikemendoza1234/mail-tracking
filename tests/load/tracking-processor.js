const { faker } = require('@faker-js/faker');

// We need valid Org IDs and Email IDs for the database to accept/log them meaningfully, 
// OR we rely on the implementation not strictly checking FKs for "fire and forget" logs (which is common for speed).
// However, our implementation DOES check or at least expects types.
// For load testing, checking FKs is expensive. 
// Let's assume we pre-seeded some orgs or we generate random UUIDs. 
// Postgres often errors on invalid UUID syntax, but if random string is UUID-like it passes until FK check.
// If DB enforces FK, we need valid IDs. 
// Strategy: use a fixed known UUID from seeding, or generate one valid-looking UUID.

function generateTrackingData(requestParams, ctx, ee, next) {
    ctx.vars.orgId = faker.string.uuid(); // Random UUID, will fail FK if enforced but tests 'attempt' load
    ctx.vars.emailId = faker.number.int({ min: 1, max: 100000 }); // Integer for legacy emails table
    ctx.vars.userAgent = faker.internet.userAgent();
    ctx.vars.ip = faker.internet.ipv4();
    return next();
}

module.exports = {
    generateTrackingData,
};

'use strict';

const _ = require('lodash');
const format = require('pg-format');

const client = require('./client');
const storymock = require('storymock');

/**
 * Create a new mocked connection pool. Returns a scriptable storymock mock.
 */
exports.newPool = function () {
    const mock = storymock()
        .asyncEvent('connect')
        .asyncEvent('query', (expectedSql, sql) => {
            if (_.isRegExp(expectedSql)) {
                return expectedSql.test(sql);
            }
            return compareQueries(sql, expectedSql);
        })
        .asyncEvent('close');

    return mock.configure({
        connect() {
            return mock.outcomeOf('connect')
                .then(() => client.createClient(function (fmt) {
                    const args = Array.prototype.slice.call(arguments).slice(1);
                    const sql = format.withArray(fmt, args);
                    return mock.outcomeOf('query', sql);
                }))
                .disposer(() => mock.outcomeOf('close'));
        }
    });
};

/**
 * Compare two SQL queries in a whitespace insensitive manner.
 * This is achieved by normalizing all whitespace to single spaces.
 * It's not a perfect approach, (there might be whitespace in string literals) but should do the trick for assertions.
 */
function compareQueries(a, b) {
    return a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ');
}
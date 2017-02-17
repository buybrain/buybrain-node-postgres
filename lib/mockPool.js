'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const format = require('pg-format');

const client = require('./client');

exports.newPool = newPool;

// Create a new mock connection pool
function newPool() {
    const scenario = [];

    let nextEvent = null;

    function logAndThrow(errorMessage) {
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    function outcomeOf(event, data) {
        // Next event in the scenario should be of the correct type
        const remainingSteps = scenario.length;
        if (remainingSteps === 0) {
            logAndThrow('Got event of type "' + event + '", but scenario is empty');
        }
        const next = scenario.shift();
        if (next.type !== event) {
            logAndThrow(
                'Expected scenario event of type "' + next.type +
                '", but got "' + event +
                '" (remainingSteps = ' + remainingSteps + ')'
            );
        }
        if (next.matcher && !next.matcher(data)) {
            logAndThrow(
                'Failed to assert that ' + JSON.stringify(data) +
                ' matched the next expected event data "' + next.matcherDescription +
                '" (remainingSteps = ' + remainingSteps + ')'
            );
        }
        return next.outcome;
    }

    const handle = {
        connect() {
            return Promise.resolve()
                .then(() => {
                    return new Promise((accept, reject) => {
                        if (outcomeOf('connect')) {
                            const query = function (fmt) {
                                const args = Array.prototype.slice.call(arguments).slice(1);
                                const sql = format.withArray(fmt, args);

                                return new Promise((accept, reject) => {
                                    const outcome = outcomeOf('query', sql);
                                    if (outcome.success) {
                                        accept(outcome.result);
                                    } else {
                                        reject(new Error(outcome.err));
                                    }
                                });
                            };

                            accept(client.createClient(query));
                        } else {
                            reject('Connect failed (mock)');
                        }
                    });
                })
                .disposer(() => {
                    outcomeOf('close');
                });
        },
        assertScenarioDone() {
            if (scenario.length > 0) {
                throw new Error('Failed to assert scenario is done (remaining = ' + JSON.stringify(scenario) + ')');
            }
        }
    };

    function setOutcome(outcome) {
        nextEvent.outcome = outcome;
        scenario.push(nextEvent);
        return handle;
    }

    const connectOutcome = {
        willSucceed: () => setOutcome(true),
        willFail: () => setOutcome(false)
    };

    const queryOutcome = {
        willSucceed: () => setOutcome({success: true, result: []}),
        willReturn: result => setOutcome({success: true, result: result}),
        willFail: () => setOutcome({success: false, err: 'Query failed (mock)'}),
        willRaise: err => setOutcome({success: false, err: err})
    };

    handle.expect = {
        connect() {
            nextEvent = {type: 'connect'};
            return connectOutcome;
        },
        query(expectedQuery) {
            nextEvent = {
                type: 'query', matcher: sql => {
                    if (expectedQuery === undefined) {
                        return true;
                    }
                    if (_.isRegExp(expectedQuery)) {
                        return expectedQuery.test(sql);
                    }
                    return compareQueries(sql, expectedQuery);
                }, matcherDescription: expectedQuery
            };
            return queryOutcome;
        },
        close() {
            nextEvent = {type: 'close'};
            return setOutcome(true);
        }
    };

    return handle;
}

/**
 * Compare two SQL queries in a whitespace insensitive manner.
 * This is achieved by normalizing all whitespace to single spaces.
 * It's not a perfect approach, (there might be whitespace in string literals) but should do the trick for assertions.
 */
function compareQueries(a, b) {
    return a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ');
}
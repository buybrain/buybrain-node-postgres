'use strict';

/**
 * Wrapper around the node-pg module, exposing a promise API and a slightly more convenient interface.
 * Uses node-config for easy default configuration and pg-format for dynamic query building.
 */

const pg = require('pg');
const Promise = require('bluebird');
const format = require('pg-format');

exports.newPool = newPool;
exports.using = Promise.using;

// Create a new connection pool, passing the same kinds of options one would pass to pg.Pool()
function newPool(options) {
    const pool = new pg.Pool(options);

    pool.on('error', console.error);

    return {
        connect() {
            let clientDone = () => {
            };

            return Promise.resolve()
                .then(() => {
                    return new Promise((accept, reject) => {
                        pool.connect((err, client, done) => {
                            if (err) {
                                reject(err);
                            } else {
                                clientDone = () => {
                                    done();
                                };
                                accept(decorateClient(client));
                            }
                        });
                    });
                })
                .disposer(() => {
                    clientDone();
                });
        }
    };
}

// Create the client wrapper around the node-pg client
function decorateClient(client) {
    // Run a query. Arguments are as used by pg-format
    const query = function (fmt) {
        let args = Array.prototype.slice.call(arguments);
        const sql = format.withArray(fmt, args.slice(1));

        return new Promise((accept, reject) => {
            client.query(sql, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    accept(res.rows);
                }
            })
        });
    };

    // Begin a transaction
    const begin = function () {
        return query('BEGIN');
    };

    // Commit a transaction
    const commit = function () {
        return query('COMMIT');
    };

    // Rollback a transaction
    const rollback = function () {
        return query('ROLLBACK');
    };

    return {
        begin: begin,
        commit: commit,
        rollback: rollback,
        query: query,
        // Perform some operation in a database transaction. Automatically commits on success and rolls back on errors.
        transactional(operation) {
            return begin()
                .then(() => {
                    return operation();
                })
                .then(commit)
                .catch(err => {
                    rollback();
                    throw err;
                });
        }
    };
}
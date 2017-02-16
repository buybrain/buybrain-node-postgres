'use strict';

/**
 * Wrapper around the node-pg module, exposing a promise API and a slightly more convenient interface.
 * Uses node-config for easy default configuration and pg-format for dynamic query building.
 */

const pg = require('pg');
const Promise = require('bluebird');
const format = require('pg-format');

const client = require('./client');

exports.newPool = newPool;

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
                        pool.connect((err, pgClient, done) => {
                            if (err) {
                                reject(err);
                            } else {
                                clientDone = () => {
                                    done();
                                };
                                accept(decorateClient(pgClient));
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
function decorateClient(pgClient) {
    // Run a query. Arguments are as used by pg-format
    const query = function (fmt) {
        const args = Array.prototype.slice.call(arguments).slice(1);
        const sql = format.withArray(fmt, args);

        return new Promise((accept, reject) => {
            pgClient.query(sql, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    accept(res.rows);
                }
            })
        });
    };

    return client.createClient(query);
}
'use strict';

/**
 * Module for adding some global pool functionality
 */

const using = require('bluebird').using;

exports.enhance = function(pool) {
    pool.with = function(callback) {
        return using(pool.connect(), conn => callback(conn));
    };

    pool.query = function(fmt) {
        return pool.with(conn => conn.query.apply(conn, arguments));
    };

    return pool;
};
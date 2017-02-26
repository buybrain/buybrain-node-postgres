'use strict';

/**
 * For these tests a running postgres instance is required. An easy way to get it up and running is by using docker.
 *
 * docker run --rm -p 5433:5432 -e POSTGRES_DB=test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test postgres
 */

const db = require('../lib/db');

const SUT = db.newPool({
    user: 'test',
    password: 'test',
    database: 'test',
    host: 'localhost',
    port: 5433,
    max: 2
});

exports.testSimpleSelect = function (test) {
    test.expect(1);

    db.using(SUT.connect(), client => client.query('SELECT 1 AS a'))
        .then(res => {
            test.deepEqual(res, [{a: 1}]);
            test.done();
        });
};

exports.testTransactions = function (test) {
    test.expect(2);

    // Testing transactional behavior by setting up 2 connections that try to read each others data
    db.using(SUT.connect(), SUT.connect(), (client1, client2) => {
        return prepareTestTable(client1)
            .then(client1.begin)
            .then(() => client1.query('INSERT INTO test SELECT 1'))
            .then(() => client2.query('SELECT * FROM test'))
            .then(data => {
                test.deepEqual([], data);
            })
            .then(client1.commit)
            .then(() => client2.query('SELECT * FROM test'))
            .then(data => {
                test.deepEqual([{a: 1}], data);
                test.done();
            })
    });
};

exports.testTransactional = function (test) {
    test.expect(3);

    // First we will test that two statements in a transactional block work, then we will test that when the second
    // operation fails, the first one doesn't have effect. Together, that proves atomicity.
    db.using(SUT.connect(), client => {
        return prepareTestTable(client)
            .then(() => client.transactional(() => {
                return client.query('INSERT INTO test SELECT 1')
                    .then(() => client.query("INSERT INTO test SELECT 2"));
            }))
            .then(() => client.query("SELECT * FROM test"))
            .then(data => test.deepEqual([{a: 1}, {a: 2}], data))
            .then(() => prepareTestTable(client))
            .then(() => client.transactional(() => {
                return client.query('INSERT INTO test SELECT 1')
                    .then(() => client.query("INSERT INTO this_table_does_not_exist SELECT 2"));
            }))
            .catch(err => test.equal('relation "this_table_does_not_exist" does not exist', err.message))
            .then(() => client.query("SELECT * FROM test"))
            .then(data => test.deepEqual([], data))
            .then(() => test.done())
    });
};

exports.testPoolQuery = function (test) {
    test.expect(1);

    SUT.query('SELECT 1 AS a')
        .then(res => {
            test.deepEqual(res, [{a: 1}]);
            test.done();
        });
};

function prepareTestTable(client) {
    return client.query('DROP TABLE IF EXISTS test')
        .then(() => client.query('CREATE TABLE test (a integer)'));
}
'use strict';

const db = require('../lib/db');

exports.testSimpleSelect = function (test) {
    test.expect(1);

    const SUT = db.newMockPool()
        .expect('connect')
        .expect('query', 'SELECT 1 AS a').ok([{a: 1}])
        .expect('close');

    db.using(SUT.connect(), client => client.query('SELECT 1 AS a'))
        .then(res => {
            test.deepEqual(res, [{a: 1}]);
            SUT.assertStoryDone();
            test.done();
        });
};

exports.testTransactions = function (test) {
    test.expect(2);

    const SUT = db.newMockPool()
        .expect('connect')
        .expect('connect')
        .expect('query', /DROP TABLE/)
        .expect('query', /CREATE TABLE/)
        .expect('query', 'BEGIN')
        .expect('query', 'INSERT INTO test SELECT 1')
        .expect('query', 'SELECT * FROM test').ok([])
        .expect('query', 'COMMIT')
        .expect('query', 'SELECT * FROM test').ok([{a: 1}])
        .expect('close')
        .expect('close');

    // Testing transactional behavior by setting up 2 connections that try to read each others data
    db.using(SUT.connect(), SUT.connect(), (client1, client2) => {
        return prepareTestTable(client1)
            .then(client1.begin)
            .then(() => client1.query('INSERT INTO test   SELECT 1'))
            .then(() => client2.query('SELECT * FROM test'))
            .then(data => {
                test.deepEqual([], data);
            })
            .then(client1.commit)
            .then(() => client2.query('SELECT * FROM test'))
            .then(data => {
                test.deepEqual([{a: 1}], data);
            })
    }).then(() => {
        SUT.assertStoryDone();
        test.done();
    })
};

exports.testTransactional = function (test) {
    test.expect(3);

    const SUT = db.newMockPool()
        .expect('connect').ok()

        .expect('query', /DROP TABLE/)
        .expect('query', /CREATE TABLE/)

        .expect('query', `
            BEGIN
        `)
        .expect('query', `INSERT INTO test SELECT '1'`)
        .expect('query', `INSERT INTO test SELECT '2', '2', '3'`)
        .expect('query', 'COMMIT')
        .expect('query', 'SELECT * FROM test').ok([{a: 1}, {a: 2}])

        .expect('query', /DROP TABLE/)
        .expect('query', /CREATE TABLE/)

        .expect('query', 'BEGIN')

        .expect('query', 'INSERT INTO test SELECT 1')
        .expect('query', 'INSERT INTO this_table_does_not_exist SELECT 2')
        .fail('relation "this_table_does_not_exist" does not exist')
        .expect('query', 'ROLLBACK')
        .expect('query', 'SELECT * FROM test').ok([])

        .expect('close');

    // First we will test that two statements in a transactional block work, then we will test that when the second
    // operation fails, the first one doesn't have effect. Together, that proves atomicity.
    db.using(SUT.connect(), client => {
        return prepareTestTable(client)
            .then(() => client.transactional(() => {
                return client.query('INSERT INTO test SELECT %L', 1)
                    .then(() => client.query("INSERT INTO test SELECT %1$L, %1$L, %2$L", 2, 3));
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
    }).then(() => {
        SUT.assertStoryDone();
        test.done()
    });
};

exports.testPoolQuery = function (test) {
    test.expect(1);

    const SUT = db.newMockPool()
        .expect('connect')
        .expect('query', 'SELECT 1 AS a').ok([{a: 1}])
        .expect('close');

    SUT.query('SELECT 1 AS a')
        .then(res => {
            test.deepEqual(res, [{a: 1}]);
            SUT.assertStoryDone();
            test.done();
        });
};

function prepareTestTable(client) {
    return client.query('DROP TABLE IF EXISTS test')
        .then(() => client.query('CREATE TABLE test (a integer)'));
}

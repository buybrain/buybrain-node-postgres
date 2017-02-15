Buybrain postgres
===

This is a ergonomic wrapper around the [pg](https://github.com/brianc/node-postgres) module for interacting with 
Postgres databases.

- Promise based interface (with [bluebird](http://bluebirdjs.com/docs/getting-started.html))
- More flexible argument handling with [pg-format](https://github.com/datalanche/node-pg-format) rather than using 
  prepared statements.
- Automatically releases client resources to prevent leakage
- Convenient transactions

Getting started
---

Install by running

```
npm install --save buybrain-pg
```

Import with
```javascript
const db = require('buybrain-pg');
```

Examples
---

buybrain-pg relies on [Bluebird resource management](http://bluebirdjs.com/docs/api/resource-management.html)
and the `using()` function. For convenience, it is re-exported in the buybrain-pg module.

**Create a new pool**
```javascript
const pool = db.newPool({
    user: 'test',
    password: 'test',
    database: 'test',
    host: 'localhost'
});
```

**Run a query and output the result**
```javascript
db.using(pool.connect(), client => client.query('SELECT 1'))
    .then(res => {
        console.log(res);
    });
```

**Run multiple queries in a transaction**
```javascript
db.using(pool.connect(), client => {
    return client.transactional(() => {
        return client.query('INSERT INTO test SELECT 1')
            .then(() => client.query("INSERT INTO test SELECT 2"));
    });
});
```

Running tests
---

The tests are run against a real Postgres instance. An easy way to get this up and running with
the correct credentials and database is by using Docker. After installing it, just run

```bash
docker run --rm -p 5433:5432 -e POSTGRES_DB=test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test postgres
```

Tests are written for nodeunit. Make sure nodeunit is installed by running 
``` 
npm install -g nodeunit
```
Then, from the project root, run

``` 
nodeunit
```

License
---
MIT